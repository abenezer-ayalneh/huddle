# TURN TLS certificates (production)

LiveKit's optional embedded TURN/TLS (configured through `TURN_ENABLED`) needs a TLS cert for
your TURN domain. Drop the PEM files here before bringing up the prod stack:

```
infra/turn-certs/cert.pem
infra/turn-certs/key.pem
```

The prod compose mounts this directory read-only into the LiveKit container at
`/etc/livekit/turn`. Obtain the cert however you like — e.g. certbot for
`turn.<your-domain>`, or reuse the cert Caddy already issues. The actual `.pem`
files are gitignored; only this README is tracked.
