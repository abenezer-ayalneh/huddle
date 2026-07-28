# ADR-0029: Temporary local recordings with optional private Google Drive delivery

**Status:** Accepted

**Date:** 2026-07-28

## Context

Phase 8 stores finished MP4s in the VPS MinIO volume indefinitely. That is a
poor storage boundary for a self-hosted deployment, while asking a Host to
download every recording manually is unreliable. A Host may also want selected
signed-in participants to receive a recording without exposing it publicly.

## Decision

- A **Local Recording Copy** is temporary. Its hard deadline is configurable as
  `RECORDING_LOCAL_RETENTION_HOURS` (168 hours by default) from completion.
  Existing completed objects receive that same grace period from the first worker
  deployment. A preview command reports object count and bytes before cleanup.
- A Host can connect one optional Google Drive **Cloud Destination**, explicitly
  and separately from Google sign-in. Huddle uses offline OAuth with the narrow
  `drive.file` scope, makes/reuses a private `Huddle Recordings` folder, and
  never creates public links or shares that folder.
- The dedicated, single-concurrency API-image worker reads MinIO ranges and
  performs 8 MiB resumable uploads. A PostgreSQL lease, heartbeat, encrypted
  resumable URI, and `appProperties.huddleRecordingId` make restart/takeover and
  the final-upload acknowledgement idempotent. Refresh tokens and session URIs
  use AES-256-GCM at rest; access tokens exist only for a worker attempt.
- Drive delivery is verified by file identity, non-trashed state, and exact byte
  size. It then shortens local retention to the earlier of 24 hours after
  delivery or the hard deadline. Recipient permission failures never extend
  local retention. Retry waits are 1m, 5m, 15m, 1h, 3h, then 6h; authorization,
  quota, and policy failures become `action_required` and notify the Host.
- A signed-in non-Host may make one final **Recording Share Consent** only when
  Drive was connected at Recording start. It is bound to their account by an
  opaque HMAC proof in the server-minted LiveKit token, applies forward from the
  click, and is limited to recordings whose active interval they overlap. The
  server clears it at `room_finished`; anonymous Guests are excluded. Huddle
  creates per-file reader permissions and Google sends its normal notification.
- Disconnect tries to revoke OAuth, removes Huddle's refresh token, and affects
  future work only. It never deletes Drive files. Hosts can explicitly make one
  backfill attempt for currently retained recordings; historical backfills add
  no participant permissions.

## Alternatives considered

- **Keep MinIO indefinitely.** Rejected: the VPS is the constrained resource and
  indefinite media retention makes backup/recovery cost grow without bound.
- **Upload/download manually.** Rejected: it leaves the retention cap dependent
  on human timing and does not reclaim space automatically.
- **Share a Drive folder or public link.** Rejected: either exposes future files
  or gives a recipient more authority than their explicit, per-recording consent.
- **Persist consent as room membership.** Rejected: it would let one call's
  choice leak into a later LiveKit room that reuses the same Room Code.
- **A general cloud-provider abstraction now.** Rejected: Google Drive is the
  requested destination. One provider discriminator is retained in persistence,
  but no unsupported provider surface is shipped.

## Consequences

- Operators must migrate first, run `pnpm --filter @huddle/api
recordings:retention-preview`, configure the Google consent screen/callback,
  and start `recording-worker`. Deleting MinIO media is irreversible; stopping
  the worker pauses both uploads and deletion.
- A failed Drive recipient permission is a Host-visible outcome, not an upload
  failure. The Drive file remains private except for successful reader grants.
- A live Google acceptance pass needs an approved test project/account and a
  real Egress MP4. Unit/integration tests mock Google APIs by default.
