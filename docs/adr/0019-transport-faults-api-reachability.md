# Transport faults are client-minted; surfacing splits by origin, default quiet

The Fault envelope (`docs/adr/0017`) assumes the server _responded_. But the most
common real failure has no response at all: the API is down and `fetch` rejects
with `ERR_CONNECTION_REFUSED` / `TypeError: Failed to fetch`. There is no
`{ code, message, statusCode }` to read. Today these escape as **uncaught promise
rejections** — and the worst offenders ride the **BetterAuth client** path
(`/api/auth/get-session` on window focus, `/api/auth/sign-in/social` on click),
which never touches `lib/api.ts` at all.

Two decisions close this gap.

**One shared low-level fetch mints transport faults.** A single wrapper catches a
rejected `fetch` and synthesizes a Fault in the standard envelope shape with a
reserved client-only `NET_*` code (`NET_UNREACHABLE`, `NET_TIMEOUT`). Both
`lib/api.ts` and the BetterAuth client are routed through it (BetterAuth via its
`customFetchImpl`/`fetchOptions`), so neither path can leak a raw `TypeError` and
all downstream handling is uniform. A `NET_*` fault means **API Reachability:
unreachable** — a concept kept deliberately distinct from the in-call **Call
Connection** lifecycle, which LiveKit owns (`CONTEXT.md`).

**Surfacing splits by origin, not by code.** The same `NET_UNREACHABLE` is loud
or quiet depending on who triggered the request:

- **User-initiated** (clicked Sign in, Create meeting) → the dedup'd Fault toast
  with a code-driven recovery action. Opt in per request (`{ surfaceFault: true }`).
- **Passive/background** (the on-focus session refetch, polling) → **no toast**,
  only a single quiet, persistent **Server Unreachable** banner that clears when
  reachability returns.

Origin is an **explicit per-request flag that defaults to passive**: a forgotten
flag degrades to the quiet banner, never to toast spam. This is the direct answer
to the failure log that motivated the work — a backgrounded `get-session`
refetch firing on every window focus must not raise a toast each time, while a
deliberate sign-in click must fail visibly.

On mount, an unreachable `get-session` resolves to the **signed-out** Lobby plus
the banner — never an indefinite spinner or a blocking error screen.

## Considered Options

- **Single shared fetch + origin-split surfacing, default passive** — chosen.
  Covers both fetch paths from one place; background outages stay quiet; user
  actions fail loudly with a recovery action.
- **Only wrap `lib/api.ts`** — rejected: leaves the exact failures in the log (the
  BetterAuth path) uncentralized and still escaping as uncaught rejections.
- **All transport faults toast, rely on dedup** — rejected: dedup coalesces a
  burst, but a sustained outage re-toasts every cooldown even with no user action;
  the on-focus refetch makes this especially noisy.
- **Default active (toast), opt out for background** — rejected: symmetric, but a
  forgotten flag spams instead of going quiet — the wrong way to fail.
- **Treat reachability as part of Call Connection** — rejected: API reachability
  fails on the lobby with no call in existence; conflating them muddies both the
  glossary and the UI ownership.

## Consequences

- A new shared low-level fetch is the one chokepoint for transport faults; both
  `lib/api.ts` and the BetterAuth client must route through it (no direct `fetch`
  for backend calls).
- Every click-driven call site must opt in with `surfaceFault: true`; reads and
  polls inherit the quiet default.
- A global **Server Unreachable** indicator (banner) and the **API Reachability**
  state it reflects are new shared UI/state, separate from the in-call connection
  UI.
- `NET_*` codes exist only on the client and never appear in a server response;
  `docs/API_CONTRACT.md` lists them as client-synthesized.
- The mount-time signed-out-plus-banner rule means "logged out" and "can't tell
  yet" render the same Lobby; the banner is the only signal of the difference.
