fn main() {
    // On macOS, libwebrtc ships as a static archive whose Objective-C runtime
    // classes (RTCVideoEncoderVP9, the RTC*Factory categories, …) are only
    // *referenced* from C++. Without `-ObjC` the linker dead-strips those
    // category/class methods, so at runtime calls like
    // `+[RTCVideoEncoderVP9 scalabilityModes]` hit `doesNotRecognizeSelector:`
    // and abort during PeerConnectionFactory init (rust-sdks#795 family).
    // `-ObjC` forces every Objective-C symbol from the static libs to load.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rustc-link-arg=-ObjC");
    }
    tauri_build::build()
}
