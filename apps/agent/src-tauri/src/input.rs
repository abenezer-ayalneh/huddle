use enigo::{Button, Coordinate, Direction, Enigo, Mouse, Settings};
#[cfg(not(target_os = "macos"))]
use enigo::Keyboard;
#[cfg_attr(target_os = "macos", allow(unused_imports))]
use log::{info, warn};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum InputEvent {
    #[serde(rename = "move")]
    Move { x: f64, y: f64 },
    #[serde(rename = "down")]
    Down { x: f64, y: f64, button: MouseBtn },
    #[serde(rename = "up")]
    Up { x: f64, y: f64, button: MouseBtn },
    #[serde(rename = "scroll")]
    Scroll { x: f64, y: f64, dx: f64, dy: f64 },
    #[serde(rename = "key")]
    Key {
        action: KeyAction,
        key: String,
        code: String,
        modifiers: Vec<Modifier>,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseBtn {
    Left,
    Middle,
    Right,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeyAction {
    Down,
    Up,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Modifier {
    Shift,
    Ctrl,
    Alt,
    Meta,
}

pub struct MonitorGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

pub struct Injector {
    enigo: Enigo,
    geometry: MonitorGeometry,
}

impl Injector {
    pub fn new(geometry: MonitorGeometry) -> Result<Self, String> {
        let enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("failed to create input injector: {e}"))?;
        Ok(Self { enigo, geometry })
    }

    pub fn inject(&mut self, event: &InputEvent) {
        if let Err(e) = self.inject_inner(event) {
            warn!("injection error: {e}");
        }
    }

    fn inject_inner(&mut self, event: &InputEvent) -> Result<(), String> {
        match event {
            InputEvent::Move { x, y } => {
                let (px, py) = self.to_pixels(*x, *y);
                self.enigo
                    .move_mouse(px, py, Coordinate::Abs)
                    .map_err(|e| format!("move: {e}"))
            }
            InputEvent::Down { x, y, button } => {
                let (px, py) = self.to_pixels(*x, *y);
                self.enigo
                    .move_mouse(px, py, Coordinate::Abs)
                    .map_err(|e| format!("move: {e}"))?;
                self.enigo
                    .button(to_enigo_button(button), Direction::Press)
                    .map_err(|e| format!("button down: {e}"))
            }
            InputEvent::Up { x, y, button } => {
                let (px, py) = self.to_pixels(*x, *y);
                self.enigo
                    .move_mouse(px, py, Coordinate::Abs)
                    .map_err(|e| format!("move: {e}"))?;
                self.enigo
                    .button(to_enigo_button(button), Direction::Release)
                    .map_err(|e| format!("button up: {e}"))
            }
            InputEvent::Scroll { x, y, dx, dy } => {
                let (px, py) = self.to_pixels(*x, *y);
                self.enigo
                    .move_mouse(px, py, Coordinate::Abs)
                    .map_err(|e| format!("move: {e}"))?;
                let scroll_x = (*dx * 3.0).round() as i32;
                let scroll_y = (*dy * -3.0).round() as i32;
                if scroll_y != 0 {
                    self.enigo
                        .scroll(scroll_y, enigo::Axis::Vertical)
                        .map_err(|e| format!("scroll y: {e}"))?;
                }
                if scroll_x != 0 {
                    self.enigo
                        .scroll(scroll_x, enigo::Axis::Horizontal)
                        .map_err(|e| format!("scroll x: {e}"))?;
                }
                Ok(())
            }
            InputEvent::Key {
                action,
                key,
                code,
                modifiers,
            } => {
                // macOS: post raw CGEvents keyed off the physical `code`. enigo's
                // keyboard path resolves chars→keycodes via Text Input Source
                // APIs, which are main-thread-only on macOS 26 and SIGTRAP when
                // called from this injector thread (rust crash: get_layoutdependent_keycode).
                #[cfg(target_os = "macos")]
                {
                    mac_key::post(code, key, action, modifiers);
                    Ok(())
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let direction = match action {
                        KeyAction::Down => Direction::Press,
                        KeyAction::Up => Direction::Release,
                    };
                    if let Some(enigo_key) = to_enigo_key(key, code) {
                        self.enigo.key(enigo_key, direction).map_err(|e| format!("key: {e}"))
                    } else {
                        info!("unmapped key: key={key}, code={code}, modifiers={modifiers:?}");
                        Ok(())
                    }
                }
            }
        }
    }

    fn to_pixels(&self, norm_x: f64, norm_y: f64) -> (i32, i32) {
        let x = norm_x.clamp(0.0, 1.0);
        let y = norm_y.clamp(0.0, 1.0);
        let px = self.geometry.x + (x * self.geometry.width as f64 / self.geometry.scale) as i32;
        let py = self.geometry.y + (y * self.geometry.height as f64 / self.geometry.scale) as i32;
        (px, py)
    }
}

fn to_enigo_button(btn: &MouseBtn) -> Button {
    match btn {
        MouseBtn::Left => Button::Left,
        MouseBtn::Middle => Button::Middle,
        MouseBtn::Right => Button::Right,
    }
}

#[cfg(not(target_os = "macos"))]
fn to_enigo_key(key: &str, code: &str) -> Option<enigo::Key> {
    match code {
        "Backspace" => Some(enigo::Key::Backspace),
        "Tab" => Some(enigo::Key::Tab),
        "Enter" | "NumpadEnter" => Some(enigo::Key::Return),
        "Escape" => Some(enigo::Key::Escape),
        "Space" => Some(enigo::Key::Space),
        "Delete" => Some(enigo::Key::Delete),
        "ArrowUp" => Some(enigo::Key::UpArrow),
        "ArrowDown" => Some(enigo::Key::DownArrow),
        "ArrowLeft" => Some(enigo::Key::LeftArrow),
        "ArrowRight" => Some(enigo::Key::RightArrow),
        "Home" => Some(enigo::Key::Home),
        "End" => Some(enigo::Key::End),
        "PageUp" => Some(enigo::Key::PageUp),
        "PageDown" => Some(enigo::Key::PageDown),
        "ShiftLeft" | "ShiftRight" => Some(enigo::Key::Shift),
        "ControlLeft" | "ControlRight" => Some(enigo::Key::Control),
        "AltLeft" | "AltRight" => Some(enigo::Key::Alt),
        "MetaLeft" | "MetaRight" => Some(enigo::Key::Meta),
        "CapsLock" => Some(enigo::Key::CapsLock),
        "F1" => Some(enigo::Key::F1),
        "F2" => Some(enigo::Key::F2),
        "F3" => Some(enigo::Key::F3),
        "F4" => Some(enigo::Key::F4),
        "F5" => Some(enigo::Key::F5),
        "F6" => Some(enigo::Key::F6),
        "F7" => Some(enigo::Key::F7),
        "F8" => Some(enigo::Key::F8),
        "F9" => Some(enigo::Key::F9),
        "F10" => Some(enigo::Key::F10),
        "F11" => Some(enigo::Key::F11),
        "F12" => Some(enigo::Key::F12),
        _ => {
            if key.len() == 1 {
                key.chars().next().map(enigo::Key::Unicode)
            } else {
                None
            }
        }
    }
}

// macOS keyboard injection via raw CGEvents. Keyed off the browser's physical
// `code` (W3C UI Events) → ANSI virtual keycode, which is layout-independent and
// the right fidelity for remote control. Crucially this never touches the Text
// Input Source APIs (TISCopy*/TSMGetInputSourceProperty) that enigo uses to map
// a char to a keycode — those assert the main thread on macOS 26 and SIGTRAP
// when invoked from the injector thread.
#[cfg(target_os = "macos")]
mod mac_key {
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use log::warn;

    use super::{KeyAction, Modifier};

    // W3C KeyboardEvent.code → macOS ANSI virtual keycode.
    fn keycode_for(code: &str) -> Option<CGKeyCode> {
        Some(match code {
            "KeyA" => 0x00, "KeyS" => 0x01, "KeyD" => 0x02, "KeyF" => 0x03, "KeyH" => 0x04,
            "KeyG" => 0x05, "KeyZ" => 0x06, "KeyX" => 0x07, "KeyC" => 0x08, "KeyV" => 0x09,
            "KeyB" => 0x0B, "KeyQ" => 0x0C, "KeyW" => 0x0D, "KeyE" => 0x0E, "KeyR" => 0x0F,
            "KeyY" => 0x10, "KeyT" => 0x11, "Digit1" => 0x12, "Digit2" => 0x13, "Digit3" => 0x14,
            "Digit4" => 0x15, "Digit6" => 0x16, "Digit5" => 0x17, "Equal" => 0x18, "Digit9" => 0x19,
            "Digit7" => 0x1A, "Minus" => 0x1B, "Digit8" => 0x1C, "Digit0" => 0x1D, "BracketRight" => 0x1E,
            "KeyO" => 0x1F, "KeyU" => 0x20, "BracketLeft" => 0x21, "KeyI" => 0x22, "KeyP" => 0x23,
            "Enter" => 0x24, "KeyL" => 0x25, "KeyJ" => 0x26, "Quote" => 0x27, "KeyK" => 0x28,
            "Semicolon" => 0x29, "Backslash" => 0x2A, "Comma" => 0x2B, "Slash" => 0x2C, "KeyN" => 0x2D,
            "KeyM" => 0x2E, "Period" => 0x2F, "Tab" => 0x30, "Space" => 0x31, "Backquote" => 0x32,
            "Backspace" => 0x33, "NumpadEnter" => 0x4C, "Escape" => 0x35,
            "MetaRight" => 0x36, "MetaLeft" => 0x37, "ShiftLeft" => 0x38, "CapsLock" => 0x39,
            "AltLeft" => 0x3A, "ControlLeft" => 0x3B, "ShiftRight" => 0x3C, "AltRight" => 0x3D,
            "ControlRight" => 0x3E,
            "F1" => 0x7A, "F2" => 0x78, "F3" => 0x63, "F4" => 0x76, "F5" => 0x60, "F6" => 0x61,
            "F7" => 0x62, "F8" => 0x64, "F9" => 0x65, "F10" => 0x6D, "F11" => 0x67, "F12" => 0x6F,
            "Delete" => 0x75, "Home" => 0x73, "End" => 0x77, "PageUp" => 0x74, "PageDown" => 0x79,
            "ArrowLeft" => 0x7B, "ArrowRight" => 0x7C, "ArrowDown" => 0x7D, "ArrowUp" => 0x7E,
            _ => return None,
        })
    }

    fn flags_for(mods: &[Modifier]) -> CGEventFlags {
        let mut f = CGEventFlags::empty();
        for m in mods {
            f |= match m {
                Modifier::Shift => CGEventFlags::CGEventFlagShift,
                Modifier::Ctrl => CGEventFlags::CGEventFlagControl,
                Modifier::Alt => CGEventFlags::CGEventFlagAlternate,
                Modifier::Meta => CGEventFlags::CGEventFlagCommand,
            };
        }
        f
    }

    pub fn post(code: &str, key: &str, action: &KeyAction, mods: &[Modifier]) {
        let down = matches!(action, KeyAction::Down);
        let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) else {
            warn!("CGEventSource unavailable");
            return;
        };

        if let Some(keycode) = keycode_for(code) {
            match CGEvent::new_keyboard_event(source, keycode, down) {
                Ok(event) => {
                    if !mods.is_empty() {
                        event.set_flags(flags_for(mods));
                    }
                    event.post(CGEventTapLocation::HID);
                }
                Err(_) => warn!("failed to build key event for {code}"),
            }
            return;
        }

        // Unmapped physical key but a printable character: emit it as a Unicode
        // string on key-down (no layout lookup). Modifier combos still need a
        // real keycode, so this path is best-effort for exotic keys only.
        if down && key.chars().count() == 1 {
            if let Ok(event) = CGEvent::new_keyboard_event(source, 0, true) {
                let utf16: Vec<u16> = key.encode_utf16().collect();
                event.set_string_from_utf16_unchecked(&utf16);
                event.post(CGEventTapLocation::HID);
            }
        }
    }
}
