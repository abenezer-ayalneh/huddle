// Ground-truth probe for rust-sdks#795: the `+[NSString stringForAbslStringView:]`
// crash on macOS 26 (Tahoe) during libwebrtc init.
//
// This exercises the WebRTC init path with no GUI and no pairing flow:
//   1. Construct a NativeVideoSource — forces the libwebrtc dylib to load and
//      any Objective-C category registration / static init to run.
//   2. Optionally attempt a Room::connect to a local LiveKit (URL+token from
//      args/env) which drives PeerConnectionFactory creation + offer/answer.
//
// If macOS 26 is still broken, the process aborts with the missing-selector
// error here instead of returning a normal connection error.
//
// Run:
//   cargo run --example webrtc_probe
//   cargo run --example webrtc_probe -- ws://127.0.0.1:7880 <token>

use livekit::prelude::*;
use livekit::webrtc::prelude::*;
use livekit::webrtc::video_source::native::NativeVideoSource;

#[tokio::main]
async fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    eprintln!("probe: process start, pid={}", std::process::id());

    eprintln!("probe: creating NativeVideoSource (forces libwebrtc load)...");
    let source = NativeVideoSource::new(VideoResolution { width: 1280, height: 720 }, true);
    eprintln!("probe: NativeVideoSource created OK");

    // Push one frame so the source actually does work through libwebrtc.
    let mut buf = I420Buffer::new(1280, 720);
    {
        let (y, u, v) = buf.data_mut();
        y.fill(16);
        u.fill(128);
        v.fill(128);
    }
    let frame = VideoFrame::new(VideoRotation::VideoRotation0, buf);
    source.capture_frame(&frame);
    eprintln!("probe: captured one frame OK — libwebrtc video path is alive");

    let mut args = std::env::args().skip(1);
    let url = args.next().or_else(|| std::env::var("LIVEKIT_URL").ok());
    let token = args.next().or_else(|| std::env::var("LIVEKIT_TOKEN").ok());

    match (url, token) {
        (Some(url), Some(token)) => {
            eprintln!("probe: connecting to {url} (drives PeerConnectionFactory)...");
            match Room::connect(&url, &token, RoomOptions::default()).await {
                Ok((room, _rx)) => {
                    eprintln!("probe: CONNECTED to room {} — full WebRTC init OK", room.name());
                }
                Err(e) => {
                    // A normal connection/auth error here STILL means WebRTC init
                    // survived (the crash would have aborted the process).
                    eprintln!("probe: connect returned error (non-fatal for this probe): {e}");
                }
            }
        }
        _ => {
            eprintln!("probe: no url+token given; skipped Room::connect.");
            eprintln!("probe: NativeVideoSource path survived — see result above.");
        }
    }

    eprintln!("probe: DONE — no WebRTC-init crash on this OS.");
}
