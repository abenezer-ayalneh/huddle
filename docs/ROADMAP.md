# Roadmap

Phased build order. **Finish a phase before starting the next.** Each phase ends
with something you can actually use. The MVP is Phases 0–3.

## Phase 0 — Foundations

- [x] Init monorepo (pnpm workspaces): `apps/web`, `apps/api`.
- [x] Scaffold Next.js app (`apps/web`, TypeScript, App Router, Tailwind).
- [x] Scaffold NestJS app (`apps/api`, TypeScript).
- [x] Bring up self-hosted LiveKit + Redis via `infra/docker-compose.yml`.
- [x] `.env` files from `.env.example`; confirm LiveKit reachable on :7880.
- **Done when:** all three services start locally and the api `/health` responds.

## Phase 1 — Token + connect (thin slice)

- [x] `POST /token` in NestJS using `livekit-server-sdk` (see API_CONTRACT).
- [x] Frontend lobby: enter room + display name.
- [x] Frontend fetches a token and connects with `<LiveKitRoom>`.
- [x] Render `<VideoConference>` (prebuilt grid + controls).
- **Done when:** one browser can join a room and see its own published video.

## Phase 2 — Multi-participant call (MVP core)

- [x] Two+ browsers join the same room and see/hear each other.\*
- [x] Participant grid updates on join/leave (F4).\*
- [x] Mute/unmute audio (F5) and camera on/off (F6), reflected to others.\*
- [x] Leave call returns to lobby cleanly (F8).
- **Done when:** PRD acceptance criteria for a 2–3 person call pass.

> Implemented via the prebuilt `<VideoConference>` (grid + control bar + audio
> renderer) wired with `video audio connect` and `onDisconnected → lobby`.
> Rooms create on demand (verified server-side).
>
> \*Items marked with an asterisk depend on live WebRTC media, which **cannot be
> exercised in a headless/CI browser** (PeerConnection fails to establish). The
> code path is complete and the UI renders; final A/V acceptance is a **manual
> two-device test** — see `docs/SETUP.md` §"Smoke test a call".
>
> Note: the prebuilt control bar shows Screen-share and Chat buttons (Phase 4/5).
> We deliberately leave them visible for the MVP rather than build a custom
> control bar — they come free with `<VideoConference>`. Don't "fix" this.
> (The Screen-share button is the Phase 4 control — see below.)

## Phase 3 — Polish the MVP

- [x] Device pre-join screen with self-preview + device pickers (F7).
- [x] Connection-state UI: connecting / reconnecting / disconnected (F9).
- [x] Basic error handling (denied permissions, token failure, server down).
- [x] Responsive layout for mobile web.
- [x] Light pass on styling/branding.
- **Done when:** the full PRD MVP acceptance checklist passes against self-hosted
  LiveKit. **This is the MVP milestone.**

> Implemented in `apps/web/src/app/rooms/[room]/RoomClient.tsx`: a three-step
> flow — prebuilt `<PreJoin>` (self-preview + camera/mic pickers, F7) → token
> fetch → `<LiveKitRoom>` publishing the chosen devices. `<ConnectionStateToast>`
> surfaces connecting/reconnecting/disconnected (F9). Errors (denied
> camera/mic via `PreJoin onError`, token/API failure via the fetch catch, lost
> connection via `LiveKitRoom onError`) render a retry / back-to-lobby screen.
> Pre-join, lobby, and the call grid use responsive layouts; `<PreJoin>` /
> `<VideoConference>` come responsively styled from `@livekit/components-styles`.
>
> Live A/V acceptance remains a **manual two-window test** (headless browsers
> can't establish WebRTC) — see `docs/SETUP.md`.

---

## Post-MVP (later — do not build until MVP ships)

### Phase 4 — Screen sharing ✅ (delivered by the prebuilt component)

Publish/stop a screen-share track; show it prominently in the grid.

- [x] Publish / stop a screen-share track.
- [x] Show the shared screen prominently.

> Like Phase 2's multi-participant grid, this needs **no new feature code**: the
> prebuilt `<VideoConference>` (already wired in `RoomClient.tsx`) ships a
> screen-share toggle in its control bar (publish/stop) and **auto-focuses** the
> screen-share track into the prominent focus layout when it starts. The token
> grant already permits it (`canPublish: true`, no `canPublishSources`
> restriction in `apps/api/src/token/token.service.ts`), so no backend change.
>
> Browsers gate `getDisplayMedia` behind a user gesture and the headless browser
> can't capture a screen, so **acceptance is a manual test**: in the call, click
> the Screen-share button, pick a window/tab, confirm the other participant sees
> it focused, then stop and confirm it returns to the grid.

### Phase 5 — In-call chat ✅ (delivered by the prebuilt component)

Text messages via LiveKit data channels; simple chat panel.

- [x] Send/receive text messages over the LiveKit data channel.
- [x] Simple chat panel toggled from the control bar.

> Like Phases 2 and 4, the UI needs **no new feature code**: `<VideoConference>`
> ships a Chat toggle in its control bar and a `.lk-chat` panel (message list +
> input form) whose sends ride LiveKit's data channel (`useChat` →
> `publishData` / text streams).
>
> One backend change was required: chat rides the data channel, which is gated by
> the `canPublishData` grant. We now set it explicitly in
> `apps/api/src/token/token.service.ts` (the server defaults it to true, but the
> grant is our single source of truth for participant capabilities).
>
> The data channel rides the same WebRTC connection, so the headless browser
> can't exercise it — **acceptance is a manual test**: open the chat panel in two
> windows, send a message from each, confirm both see it.

### Phase 6 — Host controls & rooms ✅

Webhook receiver, explicit room create/metadata, mute/remove participant,
optional waiting room.

- [x] Explicit **create-room** flow (host) — `POST /rooms` mints a host token
      (role=host metadata, roomAdmin grant) + a per-room `hostKey`.
- [x] **Waiting room** — guests knock (`POST /rooms/:room/knock`) and poll;
      host admits/denies. Guests can only join rooms a host created.
- [x] **Mute** and **remove** a participant (host-only, `x-host-key` authorized).
- [x] **Webhook receiver** (`POST /livekit/webhook`, signature-verified) — drops
      a room's in-memory state on `room_finished`.

> **Model change:** rooms are now **managed**. The Phase 1 public `POST /token`
> was removed because it would let anyone bypass the waiting room; tokens are now
> minted only by the managed-room flow. Host authority is enforced server-side
> via `hostKey` (never trusted from the token's role claim).
>
> **State** lives in-memory in the API process (single-node). Moving it to Redis
> is Phase 9 hardening. Backend: `apps/api/src/rooms/*`. Frontend: lobby
> create-vs-join, `GuestGate` (knock/wait), `HostPanel` (admit/deny + mute/remove
> overlay inside the call).
>
> Verified: the full create→knock→admit HTTP flow + host-auth (401/409/404) was
> exercised against the live API and LiveKit, plus 14 unit tests. Live A/V parts
> — mute/remove a real participant, the webhook firing, and the in-call host
> panel — need a **manual two-window test**.

### Phase 7 — Accounts & scheduling ✅

Auth, persistent users, scheduled meetings (introduces a database).

- [x] **Postgres + Prisma** added (`infra/docker-compose.yml`, `apps/api/prisma`).
- [x] **BetterAuth** mounted in the API at `/api/auth/*`; **local email +
      password** login, plus optional Google. Session gates room create/list/rejoin.
- [x] **Persistent managed rooms**: a signed-in host creates a room with a title
      and optional **scheduled start**; it gets a stable shareable link and
      **survives an API restart** (was in-memory in Phase 6). Knocks stay
      ephemeral.
- [x] Lobby is now a host dashboard (create/schedule + "your meetings"). Guests
      open the shared link and enter a name to knock — **no account needed**.

> **Auth model:** two separate authorities — the BetterAuth **session** ("who is
> signed in", required to own/create rooms) and the per-room **host key** ("are
> you this room's host", authorizes in-call admit/mute/remove). See
> `docs/ARCHITECTURE.md` → _Accounts & auth_. better-auth is ESM-only and is
> loaded via dynamic `import()` from the CommonJS Nest app.
>
> Verified: API boots with auth mounted (`/api/auth/get-session` responds), auth
> guards return 401, and the **full guest path** (shared link → name → knock →
> host sees it via `x-host-key`, wrong key → 401) was exercised against a
> Postgres-persisted room. Email/password sign-up + sign-in work end to end;
> Google and live A/V need a **manual two-window test** (headless can't do WebRTC).

### Phase 8 — Recording

LiveKit Egress to record/export sessions; storage target.

### Phase 9 — Scale & deploy hardening

Multi-node LiveKit behind Redis + LB, TURN tuning, production TLS, observability,
CI/CD.

---

Keep this file honest: check boxes as you go, and move items between phases if
priorities change.
