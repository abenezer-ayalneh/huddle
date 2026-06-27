# Cameras render letterboxed (contain) to keep the full face

Camera tiles render their video with `object-contain` rather than `object-cover`.
The whole camera frame is always visible — letterboxed against the dark tile when
the frame's aspect ratio doesn't match the tile's — so a participant's full face
is never cropped, on any screen size or tile shape. This applies to **every**
camera surface: the Equal Grid, the thumbnail strip (Pin and presentation), and
the floating **Self-view**. Screen-share tracks already used `object-contain`;
this brings cameras in line.

This **reverses an earlier choice**. `VideoTile.tsx` previously used
`object-cover` for cameras, with the comment _"cameras still cover so faces fill
the tile."_ Cover fills the tile edge-to-edge with no bars, but it crops whatever
doesn't fit: on a wide-short tile it shaves the top of the head and chin, on a
tall-narrow tile the sides. As the grid reflows across participant counts and
viewport sizes, those crops land unpredictably — exactly the "show the full face
in different screen sizes" failure we set out to fix. This ADR supersedes that
inline comment; the comment in code is updated to point here.

The local camera mirror (`-scale-x-100`) is unaffected by the fit change — fit
and mirroring are independent. Only the fit mode changes here. (The mirror is
itself conditional; see _Self-view mirroring_ below.)

## Self-view mirroring (front camera only)

The local Self-view is mirrored like a bathroom mirror so a participant's own
movements feel natural — but **only for a front-facing camera**. A phone's back
(`environment`) camera captures the world as it really is, so mirroring it flips
text and scenes the wrong way. The rule, applied identically to the in-call
Self-view (`useMirrorLocalCamera` → `VideoTile`) and the Device Check preview
(`PreJoinScreen`):

> Mirror unless the live track reports `facingMode === 'environment'`.

The boundary case is deliberate: **cameras that report no `facingMode`** — most
desktop and external USB webcams — **stay mirrored**, because that is the
long-standing default and the overwhelmingly common selfie-style use. We
explicitly did _not_ key on `facingMode === 'user'` (which would un-mirror every
webcam that omits the field), only on an explicit `'environment'`. `facingMode`
is read from the live `MediaStreamTrack`'s settings and recomputed on a Switch
Device (`TrackEvent.Restarted`), since switching cameras restarts the track in
place. Remote tiles and screen shares are never mirrored.

## Considered Options

- **Keep `object-cover` (fill, may crop)** — rejected: the status quo. Looks the
  cleanest with matched aspect ratios but cannot guarantee the face stays in
  frame as tiles reflow, which was the whole point.
- **`object-cover` with a face-biased `object-position`** (e.g. center 30%) —
  rejected: a cheap best-effort that keeps eyes/forehead by sacrificing the
  bottom of the frame, but it still crops and only guesses where the face is.
  Good enough for "try"; we chose the guarantee instead.
- **Face-detection auto-framing** (FaceDetector / ML pan-zoom per tile) —
  rejected as over-scope: heavy, flaky across browsers, real per-frame cost, and
  far beyond what this change warrants.
- **`object-contain` everywhere** — chosen: the only option that _guarantees_
  the full frame, accepting letterbox bars as the cost.

## Consequences

- No participant is ever cropped; the full camera frame is always on screen.
- Tiles show letterbox bars whenever the camera's aspect ratio differs from the
  tile's, and faces appear somewhat smaller than they did under cover. The Equal
  Grid looks boxier, especially with mixed device aspect ratios. This is the
  accepted trade-off.
- Cameras and screen shares now share one fit mode (`contain`), so the tile's
  dark background is the consistent letterbox backdrop for both.
- The previous "cover so faces fill" comment is removed; this ADR is the record
  of why cameras letterbox.
