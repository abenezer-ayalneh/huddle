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

### Phase 6 — Host controls & rooms

Webhook receiver, explicit room create/metadata, mute/remove participant,
optional waiting room.

### Phase 7 — Accounts & scheduling

Auth, persistent users, scheduled meetings (introduces a database — update
ARCHITECTURE.md).

### Phase 8 — Recording

LiveKit Egress to record/export sessions; storage target.

### Phase 9 — Scale & deploy hardening

Multi-node LiveKit behind Redis + LB, TURN tuning, production TLS, observability,
CI/CD.

---

Keep this file honest: check boxes as you go, and move items between phases if
priorities change.
