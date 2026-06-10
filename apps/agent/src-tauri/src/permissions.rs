use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub screen_recording: bool,
    pub accessibility: bool,
}

#[cfg(target_os = "macos")]
pub fn check_permissions() -> PermissionStatus {
    let screen_recording = check_screen_recording();
    let accessibility = check_accessibility();
    PermissionStatus {
        screen_recording,
        accessibility,
    }
}

#[cfg(not(target_os = "macos"))]
pub fn check_permissions() -> PermissionStatus {
    PermissionStatus {
        screen_recording: true,
        accessibility: true,
    }
}

#[cfg(target_os = "macos")]
fn check_screen_recording() -> bool {
    match xcap::Monitor::all() {
        Ok(monitors) => {
            if let Some(m) = monitors.into_iter().next() {
                m.capture_image().is_ok()
            } else {
                false
            }
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
fn check_accessibility() -> bool {
    use std::process::Command;
    let output = Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get name of first process",
        ])
        .output();
    match output {
        Ok(o) => o.status.success(),
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
pub fn open_screen_recording_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .spawn();
}

#[cfg(target_os = "macos")]
pub fn open_accessibility_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}

#[cfg(not(target_os = "macos"))]
pub fn open_screen_recording_settings() {}

#[cfg(not(target_os = "macos"))]
pub fn open_accessibility_settings() {}
