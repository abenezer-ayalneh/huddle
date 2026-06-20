# Recording via LiveKit Egress to MinIO (S3)

Phase 8 adds session recording. Three decisions, all scoped with the user.

## What we record: room-composite

We record the **composited room** — the same grid + mixed audio a participant
sees — to a single MP4 per session, using LiveKit **Egress**
(`startRoomCompositeEgress`, `grid` layout). This matches the Google-Meet
"record meeting" mental model and avoids the per-track file sprawl (and
post-processing) that individual-track egress would require. Egress runs as a
new `egress` container (it bundles a headless Chrome that joins the room as an
invisible participant and composites it).

## Where it's stored: MinIO (self-hosted S3)

Recordings upload to **MinIO**, an S3-compatible object store running as a
container. This keeps the app fully self-hosted and works offline — no real AWS
account needed — while staying on the standard S3 API, so swapping in real S3
later is a config change, not a code change. The S3 upload target (bucket,
endpoint, credentials) is built from the **API's** env and passed to Egress
**per request** (`S3Upload` in the `EncodedFileOutput`), so the egress container
holds no storage credentials of its own.

### Two endpoints, on purpose

The API talks to MinIO over **two** URLs:

- `S3_ENDPOINT` (`http://localhost:9000`) — host-facing, used by the API's own
  S3 client to **read recordings back** for download.
- `S3_ENDPOINT_INTERNAL` (`http://minio:9000`) — the compose service name,
  reachable from inside the docker network. This is the endpoint handed to
  **Egress** for uploads, because egress runs in the bridge network and can't
  reach `localhost`.

Getting these two backwards is the most likely setup error; egress upload
failures almost always mean it was given the host endpoint.

## Who can record: host-only, manual

> **Amended by [ADR-0011](0011-request-to-record-host-approve.md).** Recording is
> no longer host-only to _start_: any non-host participant may send a Request to
> Record that the host approves, unlocking a single recording for that requester.
> The rest of this section still holds — recordings are host-owned, host-
> downloaded, and one-active-per-room.

Recording is started/stopped by the **host**, authorized by the per-room
`x-host-key` (the same authority as admit/mute/remove — `HostGuard`), not the
BetterAuth session. Guests cannot record. There's one active recording per room
at a time. This mirrors the Phase 6/7 host-authority model and keeps recording a
deliberate, visible action rather than always-on.

## Consequences worth remembering

1. **Lifecycle is webhook-driven.** A `recording` row is created `starting` when
   the host hits Record; LiveKit's signed Egress webhook
   (`egress_started/updated/ended`, reusing the existing webhook receiver)
   advances it to `active` then `completed`/`failed` and records the file's size
   and duration. The UI polls the recordings list so status changes appear
   without a manual refresh.

2. **Downloads are proxied, never presigned to the browser.** A presigned MinIO
   URL would point at an endpoint the browser can't resolve (`minio:9000`), and
   would also need bucket creds in scope. Instead the API streams the file
   through a `GET …/:id/download` route guarded by `x-host-key`. Because that
   needs a header, the frontend fetches it as a blob (a plain `<a download>`
   can't set headers) and triggers the save client-side.

3. **The egress container needs `CAP_SYS_ADMIN`** for its headless-Chrome
   sandbox, and its config (incl. the API secret) is injected inline via
   `EGRESS_CONFIG_BODY` with compose `${LIVEKIT_*}` interpolation — the same
   "secret lives only in `.env`" pattern as `LIVEKIT_KEYS` (see ADR-0001), so no
   committed egress config file holds the secret.
