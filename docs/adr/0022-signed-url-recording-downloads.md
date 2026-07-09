# ADR-0022: Signed-URL recording downloads for native browser progress

**Status:** Accepted

**Date:** 2026-06-27

**Context:**

A finished [[Recording]] is downloaded by the host through a host-authorized API
route that proxies the MP4 out of MinIO (so the browser never touches bucket
credentials — see ADR-0003). Because that route is authorized with the
`x-host-key` **header**, the client could not use a plain `<a download>` link:
it fetched the whole response into memory as a `Blob`, then triggered a save.

The visible result is poor for large recordings — the browser shows no activity
during the (potentially long) buffering, then a save dialog appears all at once.
There is no native download progress, and a browser tab that buffers a multi-
hundred-MB file into memory before writing it to disk is wasteful.

A native browser download (streaming to disk with the download shelf and its
progress bar) requires the GET to be an ordinary navigation — which cannot carry
a custom header. So the download has to be authorized some other way.

**Decision:**

Authorize the download with a **short-lived, stateless, HMAC-signed URL** instead
of the `x-host-key` header.

- **Token:** an HMAC over `room + recordingId + expiry`, signed server-side. No
  storage — verification is signature + expiry only, so it is naturally reusable
  within its window and survives the native download manager's range/retry
  requests.
- **TTL:** 5 minutes — long enough to cover a backgrounded tab whose 4s poll is
  throttled or suspended, short enough to keep the validity window small.
- **Signing key:** a dedicated `RECORDING_DOWNLOAD_SECRET` env var (key
  separation from auth/LiveKit secrets; independently rotatable).
- **Delivery:** the signed `downloadUrl` is **embedded** in each _completed_
  recording in the host-authorized list responses (`list` and `listMine`), and
  re-minted on every 4s poll so it is effectively always fresh. The Download
  control becomes a plain `<a href={downloadUrl} download>`.
- **Proxy preserved:** the token-verified route still streams the object out of
  MinIO via `StreamableFile`; the browser never gets bucket credentials. Only
  the _authorization token_ changes — header → signed query param — not the
  proxy topology (ADR-0003 stands).
- **The old path is removed:** the header-authorized blob fetch (`res.blob()`)
  and its `api.downloadRecording` client method are deleted; the route swaps
  `HostGuard` for a token-verifying guard.

**Rationale:**

1. **Native progress for free.** Once the GET is a normal navigation against a
   route that already streams with `Content-Length`, the browser drives the
   whole download — progress shelf, resume, right-click "Save as" — with no
   in-app machinery and no buffering the file into a tab's memory.

2. **Stateless beats stateful here.** The download is idempotent and read-only,
   so a signed token needs no Redis round-trip and no revocation list. Statelessness
   also makes the token reusable within its window, while a strict one-time Redis
   token would break the native manager's range requests.

3. **Embedding exploits the existing poll.** The list already refreshes every 4s
   for the host (and only the host), so a freshly-signed URL costs nothing extra
   and is always within its TTL. A plain anchor is the simplest possible client.

**Consequences:**

- **Download failures leave the app's Fault surface.** The app can no longer
  observe a failed download (expired token, object gone, mid-stream storage
  error); the browser owns those as its own "failed" shelf state, not an in-app
  [[Fault]] (a deliberate deviation from ADR-0017/0019). This is accepted because
  the link is rendered only when the recording is `completed`, and the 5-minute
  TTL refreshed every 4s makes expiry-at-click practically unreachable.

- **One host action is authorized differently from all the others.** Every other
  host capability uses `x-host-key`; this one uses a URL token. That asymmetry is
  the reason this ADR exists — the token is the only auth form a header-less
  native navigation can carry.

- **A new secret to manage** (`RECORDING_DOWNLOAD_SECRET`) across the env files
  and the prod deploy. The API refuses to boot without it (same as Egress/Storage).

- **The download anchor uses `target="_blank" rel="noopener"`.** A successful
  download streams to the browser's shelf without navigating, but a rare _failed_
  download (e.g. an expired token, or the object missing) returns a non-attachment
  error response — which on a same-tab link would replace, and tear down, the live
  in-call page. The throwaway tab contains that failure instead of the call.

**Alternatives Considered:**

1. **Host key in the query string + plain anchor.** Simplest, but puts the
   long-lived per-room host key into URL history, the `Referer`, and server
   access logs. Rejected: leaks a standing capability to get a one-off download.

2. **Presigned MinIO URL (browser downloads straight from storage).** Native and
   zero-proxy, but exposes the storage endpoint to the browser and contradicts
   ADR-0003's "downloads are proxied, the browser never gets the bucket."
   Rejected on that boundary.

3. **In-app progress bar over the blob stream.** Read the `ReadableStream` and
   render our own progress. Keeps header auth and the Fault surface, but still
   buffers to memory, still ends with a save dialog, and is _not_ the browser's
   native download. Rejected: doesn't deliver the asked-for experience.

4. **One-time Redis token.** Revocable, but adds a Redis round-trip on the
   download path and the strict one-time semantics break native resume/range
   requests. Rejected for downloads specifically.

We chose **stateless signed URL embedded in the list, proxied through the API**
because it delivers true native download progress, keeps the storage proxy and
its security property intact, and needs no new persistent state.
