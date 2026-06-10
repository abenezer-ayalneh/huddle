use enigo::{
    Button, Coordinate, Direction, Enigo, Keyboard, Mouse, Settings,
};
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
                let direction = match action {
                    KeyAction::Down => Direction::Press,
                    KeyAction::Up => Direction::Release,
                };
                if let Some(enigo_key) = to_enigo_key(key, code) {
                    self.enigo
                        .key(enigo_key, direction)
                        .map_err(|e| format!("key: {e}"))
                } else {
                    info!("unmapped key: key={key}, code={code}, modifiers={modifiers:?}");
                    Ok(())
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
