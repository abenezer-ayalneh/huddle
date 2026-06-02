# Single source for the LiveKit API key/secret

The LiveKit server and the NestJS token service must share the same API
key/secret, and a mismatch produces hard-to-diagnose 401s. Rather than keep the
pair in two committed files (`infra/livekit.yaml` and `.env`), we removed the
`keys:` block from `livekit.yaml` and have docker-compose inject
`LIVEKIT_KEYS="<key>: <secret>"` from `.env` at runtime. The secret now lives in
exactly one place (the gitignored `.env`), so the two sides cannot drift and no
real credential is committed.

A future reader will find no credentials in `livekit.yaml` — they come from the
`LIVEKIT_KEYS` environment variable set by docker-compose, which LiveKit reads
natively.
