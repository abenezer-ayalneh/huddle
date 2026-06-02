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

- [ ] `POST /token` in NestJS using `livekit-server-sdk` (see API_CONTRACT).
- [ ] Frontend lobby: enter room + display name.
- [ ] Frontend fetches a token and connects with `<LiveKitRoom>`.
- [ ] Render `<VideoConference>` (prebuilt grid + controls).
- **Done when:** one browser can join a room and see its own published video.

## Phase 2 — Multi-participant call (MVP core)

- [ ] Two+ browsers join the same room and see/hear each other.
- [ ] Participant grid updates on join/leave (F4).
- [ ] Mute/unmute audio (F5) and camera on/off (F6), reflected to others.
- [ ] Leave call returns to lobby cleanly (F8).
- **Done when:** PRD acceptance criteria for a 2–3 person call pass.

## Phase 3 — Polish the MVP

- [ ] Device pre-join screen with self-preview + device pickers (F7).
- [ ] Connection-state UI: connecting / reconnecting / disconnected (F9).
- [ ] Basic error handling (denied permissions, token failure, server down).
- [ ] Responsive layout for mobile web.
- [ ] Light pass on styling/branding.
- **Done when:** the full PRD MVP acceptance checklist passes against self-hosted
  LiveKit. **This is the MVP milestone.**

---

## Post-MVP (later — do not build until MVP ships)

### Phase 4 — Screen sharing
Publish/stop a screen-share track; show it prominently in the grid.

### Phase 5 — In-call chat
Text messages via LiveKit data channels; simple chat panel.

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
