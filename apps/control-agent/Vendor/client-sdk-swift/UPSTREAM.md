# Huddle LiveKit Swift patch

This is a vendored source snapshot of LiveKit Swift v2.15.1 at exact commit
7f3af1488411a9787e1e94ddd66b0bed2057bed3.

Huddle's only SDK behavior change is the opt-in
ScreenShareCaptureOptions.captureEntireDisplay path in
MacOSScreenCapturer.swift. It uses
SCContentFilter(display:excludingWindows:) and derives
SCStreamConfiguration dimensions from the selected display. Ordinary screen
sharing keeps the upstream application-scoped path.

To refresh this snapshot, start from the exact upstream commit above, copy its
Sources/ tree here, and reapply only the Huddle patch. Do not float this
dependency to a later SDK revision without a new review.
