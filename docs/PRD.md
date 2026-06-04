# Product Requirements — MVP

Project codename: **vid-** · A self-hosted, browser-based video conferencing app
(Google Meet–style) built on LiveKit.

## 1. Goal

Let two or more people join a named room from their browser and see/hear each
other in real time, with basic call controls. This is the foundation everything
else builds on. Optimize for a working, reliable call — not feature breadth.

## 2. Target users

Anyone with a modern browser (Chrome, Edge, Firefox, Safari) on desktop or mobile
web. No app install. No account required for the MVP (anonymous display name).

## 3. In scope (MVP)

| #   | Feature               | Description                                                                                             |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| F1  | Create / join room    | User enters (or is given) a room name + display name and joins. Joining a non-existent room creates it. |
| F2  | Camera & mic publish  | On join, user can publish camera and microphone tracks.                                                 |
| F3  | Subscribe to others   | User sees/hears every other participant's tracks.                                                       |
| F4  | Participant grid      | Responsive grid of video tiles; shows name; handles 1–N participants.                                   |
| F5  | Mute / unmute audio   | Toggle local microphone. State visible to others.                                                       |
| F6  | Camera on / off       | Toggle local camera. Shows avatar/placeholder when off.                                                 |
| F7  | Device pre-join check | Before joining, pick camera/mic and see a self-preview.                                                 |
| F8  | Leave call            | Cleanly disconnect and return to the lobby.                                                             |
| F9  | Connection state UI   | Show connecting / reconnecting / disconnected states.                                                   |

## 4. Explicitly out of scope (MVP — see ROADMAP for phase)

Screen sharing, in-call text chat, recording, meeting scheduling/calendar,
waiting rooms / host controls, authentication & user accounts, virtual
backgrounds, breakout rooms, live captions, reactions, raised hands,
phone/SIP dial-in. None of these in the MVP.

## 5. Functional requirements

- A user provides a **room name** and a **display name** to join.
- The backend issues a **short-lived access token** scoped to that room and
  identity. The browser never sees the LiveKit API secret.
- Media (audio/video) flows directly between the browser and the self-hosted
  LiveKit server over WebRTC; signaling over secure WebSocket.
- The grid updates live as participants join and leave.
- Mute/camera state changes propagate to all participants within ~1s.

## 6. Non-functional requirements

- **Latency:** sub-300ms glass-to-glass on a LAN/typical broadband.
- **Capacity (MVP target):** up to ~8 participants per room reliably on a single
  self-hosted node. Document scaling path; don't build it yet.
- **Browsers:** latest 2 versions of Chrome, Edge, Firefox, Safari.
- **Security:** HTTPS/WSS only; tokens expire (default 1h or less); secrets in
  env vars only.
- **Reliability:** automatic reconnect on transient network drops (LiveKit
  client handles this — surface it in UI).
- **Privacy:** no recording in MVP; no media persisted server-side.

## 7. User flow (happy path)

1. User opens the app → **Lobby**.
2. Enters display name + room name → device pre-join screen (F7).
3. Confirms devices → frontend requests a token from the backend.
4. Backend returns a JWT scoped to `{room, identity}`.
5. Frontend connects to LiveKit with the token, publishes camera+mic.
6. User sees the participant grid; uses mute/camera/leave controls.
7. On leave, disconnects and returns to lobby.

## 8. Acceptance criteria (MVP done when…)

- [ ] Two browsers on different machines can join the same room and see/hear
      each other.
- [ ] A third participant joining updates both existing grids automatically.
- [ ] Muting audio on one client is reflected on the others.
- [ ] Turning off camera shows a placeholder on the others.
- [ ] Token endpoint refuses requests without a room/identity and never leaks the
      API secret.
- [ ] Refreshing or dropping network reconnects without a full page reload where
      LiveKit allows it.
- [ ] All of the above works against the **self-hosted** LiveKit container, not
      LiveKit Cloud.

## 9. Open questions (decide before/while building)

- ~~Room name strategy: free-text vs. generated codes?~~ **Decided (Phase 1):**
  free-text room name entered in the lobby. Generated codes can come later.
- ~~Anonymous-only, or a thin "host vs guest" distinction?~~ **Decided (Phase 1):**
  anonymous only (MVP). **Revised (Phase 6):** still no accounts, but rooms are
  now _managed_ — the creator is the **host** (holds a per-room `hostKey`) and
  others are guests who must be admitted. Identity is now generated **server-side**
  for managed rooms so guests can't spoof it. **Revised (Phase 7):** hosting now
  requires a **signed-in account** (email + password, or Google, via BetterAuth);
  rooms **persist** in Postgres and can be **scheduled** with a start time and a
  stable shareable link. Guests still need no account — they open the link and knock.
- ~~Auth provider & database?~~ **Decided (Phase 7):** BetterAuth (local email +
  password, plus optional Google) + Postgres via Prisma. See `docs/ARCHITECTURE.md`.
- ~~Recording: what, where, who?~~ **Decided (Phase 8):** **room-composite** MP4
  via LiveKit Egress → **MinIO** (self-hosted S3) → **host-only manual** toggle
  (`x-host-key`). Privacy note below is now scoped to Phases 0–7. See
  `docs/adr/0003-recording-egress-minio.md`.
- Do we cap participants in the MVP, or just document the practical limit?

Record decisions here as they're made.
