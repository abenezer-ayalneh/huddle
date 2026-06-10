use std::sync::Arc;
use std::time::Duration;

use livekit::options::TrackPublishOptions;
use livekit::prelude::*;
use livekit::webrtc::prelude::*;
use livekit::webrtc::video_source::native::NativeVideoSource;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, watch};

use crate::redeem::RedeemResponse;

const CONTROL_TOPIC: &str = "huddle:control";
const CONTROL_VERSION: u32 = 1;
const CAPTURE_FPS: u32 = 15;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ControlMessage {
    v: u32,
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(flatten)]
    extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("failed to list monitors: {e}"))?;
    Ok(monitors
        .into_iter()
        .enumerate()
        .filter_map(|(i, m)| {
            Some(MonitorInfo {
                id: i as u32,
                name: m.name().ok()?,
                width: m.width().ok()?,
                height: m.height().ok()?,
                is_primary: m.is_primary().unwrap_or(false),
            })
        })
        .collect())
}

pub struct Session {
    shutdown_tx: watch::Sender<bool>,
    capture_handle: Option<tokio::task::JoinHandle<()>>,
    room_handle: Option<tokio::task::JoinHandle<()>>,
}

impl Session {
    pub async fn start(
        redeemed: RedeemResponse,
        monitor_id: u32,
        event_tx: mpsc::UnboundedSender<SessionEvent>,
    ) -> Result<Self, String> {
        let monitors =
            xcap::Monitor::all().map_err(|e| format!("failed to list monitors: {e}"))?;
        let monitor = monitors
            .into_iter()
            .nth(monitor_id as usize)
            .ok_or_else(|| format!("monitor {monitor_id} not found"))?;

        let width = monitor.width().map_err(|e| format!("monitor width: {e}"))?;
        let height = monitor.height().map_err(|e| format!("monitor height: {e}"))?;
        let mon_name = monitor.name().unwrap_or_else(|_| "unknown".into());
        let presenter = redeemed.presenter_identity.clone();
        let room_name = redeemed.room.clone();

        info!(
            "starting session: room={room_name}, presenter={presenter}, monitor={mon_name}({width}x{height})"
        );

        // Connect to the LiveKit room.
        let mut room_opts = RoomOptions::default();
        room_opts.auto_subscribe = false;
        let (room, mut room_events) = Room::connect(
            &redeemed.livekit_url,
            &redeemed.token,
            room_opts,
        )
        .await
        .map_err(|e| format!("failed to connect: {e}"))?;

        let room = Arc::new(room);
        info!("connected to room {room_name}");

        // Create a video source sized to the monitor and publish it as screen share.
        let source = NativeVideoSource::new(
            VideoResolution { width, height },
            true, // is_screencast
        );

        let track =
            LocalVideoTrack::create_video_track("screen", RtcVideoSource::Native(source.clone()));
        let mut publish_opts = TrackPublishOptions::default();
        publish_opts.source = TrackSource::Screenshare;
        publish_opts.simulcast = false;
        room.local_participant()
            .publish_track(LocalTrack::Video(track), publish_opts)
            .await
            .map_err(|e| format!("failed to publish track: {e}"))?;

        info!("publishing screen share track ({width}x{height}@{CAPTURE_FPS}fps)");
        let _ = event_tx.send(SessionEvent::SharingStarted {
            room: room_name.clone(),
        });

        // Shutdown signal.
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        // Spawn capture loop — grabs frames from the monitor, converts to I420,
        // and feeds them to the LiveKit video source.
        let capture_handle = {
            let shutdown_rx = shutdown_rx.clone();
            let source = source.clone();
            tokio::task::spawn_blocking(move || {
                let interval = Duration::from_millis(1000 / CAPTURE_FPS as u64);
                loop {
                    if *shutdown_rx.borrow() {
                        break;
                    }

                    let start = std::time::Instant::now();
                    match monitor.capture_image() {
                        Ok(img) => {
                            let (w, h) = (img.width(), img.height());
                            let rgba = img.into_raw();
                            let mut buffer = I420Buffer::new(w, h);
                            write_i420_from_rgba(&rgba, w, h, &mut buffer);
                            let frame = VideoFrame::new(VideoRotation::VideoRotation0, buffer);
                            source.capture_frame(&frame);
                        }
                        Err(e) => {
                            warn!("capture failed: {e}");
                        }
                    }

                    let elapsed = start.elapsed();
                    if elapsed < interval {
                        std::thread::sleep(interval - elapsed);
                    }
                }
                info!("capture loop ended");
            })
        };

        // Spawn room event handler — protocol messages + lifecycle.
        let room_handle = {
            let _room = room.clone();
            let mut shutdown_rx = shutdown_rx.clone();
            let event_tx = event_tx.clone();
            let presenter = presenter.clone();
            tokio::spawn(async move {
                let mut controller_id: Option<String> = None;

                loop {
                    tokio::select! {
                        _ = shutdown_rx.changed() => {
                            if *shutdown_rx.borrow() { break; }
                        }
                        event = room_events.recv() => {
                            let Some(event) = event else { break };
                            match event {
                                RoomEvent::DataReceived { payload, topic, participant, .. } => {
                                    if topic.as_deref() != Some(CONTROL_TOPIC) {
                                        continue;
                                    }
                                    let Some(participant) = participant else { continue };
                                    let sender = participant.identity().to_string();
                                    let Ok(msg) = serde_json::from_slice::<ControlMessage>(&payload) else {
                                        continue;
                                    };
                                    if msg.v != CONTROL_VERSION {
                                        continue;
                                    }

                                    match msg.msg_type.as_str() {
                                        "control:grant" => {
                                            if sender != presenter {
                                                warn!("rejected grant from non-presenter {sender}");
                                                continue;
                                            }
                                            let cid = msg.extra.get("controllerId")
                                                .and_then(|v| v.as_str())
                                                .unwrap_or_default()
                                                .to_string();
                                            let cname = msg.extra.get("controllerName")
                                                .and_then(|v| v.as_str())
                                                .unwrap_or_default()
                                                .to_string();
                                            info!("GRANT: {cname} ({cid}) now controls");
                                            controller_id = Some(cid);
                                        }
                                        "control:revoke" => {
                                            if sender != presenter {
                                                warn!("rejected revoke from non-presenter {sender}");
                                                continue;
                                            }
                                            info!("REVOKE: {:?} no longer controls", controller_id);
                                            controller_id = None;
                                        }
                                        "control:stop-present" => {
                                            if sender != presenter {
                                                warn!("rejected stop-present from non-presenter {sender}");
                                                continue;
                                            }
                                            info!("presenter stopped the share");
                                            let _ = event_tx.send(SessionEvent::Stopped);
                                            return;
                                        }
                                        "control:release" => {
                                            let is_controller = controller_id.as_deref() == Some(sender.as_str());
                                            if !is_controller {
                                                warn!("rejected release from non-controller {sender}");
                                                continue;
                                            }
                                            info!("RELEASE: {sender} gave control back");
                                            controller_id = None;
                                        }
                                        "control:input" => {
                                            let is_controller = controller_id.as_deref() == Some(sender.as_str());
                                            if !is_controller {
                                                warn!("rejected input from non-controller {sender}");
                                                continue;
                                            }
                                            // Slice 3: log only, no injection yet.
                                            if let Some(event) = msg.extra.get("event") {
                                                let kind = event.get("kind").and_then(|v| v.as_str()).unwrap_or("?");
                                                if kind != "move" {
                                                    info!("input: {kind} (injection not implemented yet)");
                                                }
                                            }
                                        }
                                        "control:clipboard" => {
                                            let is_controller = controller_id.as_deref() == Some(sender.as_str());
                                            if !is_controller {
                                                warn!("rejected clipboard from non-controller {sender}");
                                                continue;
                                            }
                                            let text = msg.extra.get("text")
                                                .and_then(|v| v.as_str())
                                                .unwrap_or_default();
                                            info!("clipboard from controller: {}", &text[..text.len().min(80)]);
                                            // Slice 5: clipboard sync not implemented yet.
                                        }
                                        other => {
                                            info!("(ignored {other} from {sender})");
                                        }
                                    }
                                }
                                RoomEvent::ParticipantDisconnected(participant) => {
                                    let identity = participant.identity().to_string();
                                    if identity == presenter {
                                        info!("presenter left the room");
                                        let _ = event_tx.send(SessionEvent::Stopped);
                                        return;
                                    }
                                    if controller_id.as_deref() == Some(&identity) {
                                        info!("controller {identity} disconnected");
                                        controller_id = None;
                                    }
                                }
                                RoomEvent::Disconnected { reason } => {
                                    info!("disconnected from room: {reason:?}");
                                    let _ = event_tx.send(SessionEvent::Stopped);
                                    return;
                                }
                                _ => {}
                            }
                        }
                    }
                }
                info!("room event loop ended");
            })
        };

        Ok(Session {
            shutdown_tx,
            capture_handle: Some(capture_handle),
            room_handle: Some(room_handle),
        })
    }

    pub async fn stop(&mut self) {
        let _ = self.shutdown_tx.send(true);
        if let Some(h) = self.capture_handle.take() {
            let _ = h.await;
        }
        if let Some(h) = self.room_handle.take() {
            let _ = h.await;
        }
    }
}

#[derive(Debug, Clone)]
pub enum SessionEvent {
    SharingStarted { room: String },
    Stopped,
}

fn write_i420_from_rgba(rgba: &[u8], width: u32, height: u32, buffer: &mut I420Buffer) {
    let w = width as usize;
    let h = height as usize;
    let (y_plane, u_plane, v_plane) = buffer.data_mut();

    for row in 0..h {
        for col in 0..w {
            let i = (row * w + col) * 4;
            let r = rgba[i] as f32;
            let g = rgba[i + 1] as f32;
            let b = rgba[i + 2] as f32;

            y_plane[row * w + col] = (0.257 * r + 0.504 * g + 0.098 * b + 16.0).clamp(0.0, 255.0) as u8;

            if row % 2 == 0 && col % 2 == 0 {
                let ci = (row / 2) * (w / 2) + col / 2;
                u_plane[ci] = (-0.148 * r - 0.291 * g + 0.439 * b + 128.0).clamp(0.0, 255.0) as u8;
                v_plane[ci] = (0.439 * r - 0.368 * g - 0.071 * b + 128.0).clamp(0.0, 255.0) as u8;
            }
        }
    }
}
