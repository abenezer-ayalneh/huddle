// Huddle Control Agent (docs/REMOTE_CONTROL_PLAN.md, slice 3).
//
// Tauri 2 desktop app: redeems a pairing code, joins the LiveKit room as
// `agent:<presenterIdentity>`, captures a monitor, and publishes it as a
// screen share. Handles control:* protocol messages (no input injection
// in this slice). Launched via `huddle://present?code=...&api=...` deep
// link or manually with --code/--api CLI args.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod redeem;
mod session;

use std::sync::Mutex;

use log::info;
use redeem::RedeemResponse;
use session::{MonitorInfo, Session, SessionEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tokio::sync::mpsc;

struct AppState {
    session_info: Mutex<Option<RedeemResponse>>,
    session: Mutex<Option<Session>>,
}

#[tauri::command]
fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    session::list_monitors()
}

#[tauri::command]
fn get_session_info(state: tauri::State<'_, AppState>) -> Option<SessionInfoPayload> {
    let info = state.session_info.lock().unwrap();
    info.as_ref().map(|r| SessionInfoPayload {
        room: r.room.clone(),
        presenter_name: r.presenter_name.clone(),
    })
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionInfoPayload {
    room: String,
    presenter_name: String,
}

#[tauri::command]
async fn start_sharing(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    monitor_id: u32,
) -> Result<(), String> {
    let redeemed = {
        let info = state.session_info.lock().unwrap();
        info.clone().ok_or("no session info — redeem a code first")?
    };

    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let new_session = Session::start(redeemed, monitor_id, event_tx).await?;

    {
        let mut session = state.session.lock().unwrap();
        *session = Some(new_session);
    }

    let app2 = app.clone();
    tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                SessionEvent::SharingStarted { room } => {
                    let _ = app2.emit("sharing-started", serde_json::json!({ "room": room }));
                }
                SessionEvent::Stopped => {
                    let _ = app2.emit("sharing-stopped", serde_json::json!({}));
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn stop_sharing(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let taken = {
        let mut guard = state.session.lock().unwrap();
        guard.take()
    };
    if let Some(mut s) = taken {
        s.stop().await;
    }
    Ok(())
}

#[tauri::command]
fn cancel_session(app: AppHandle) {
    app.exit(0);
}

async fn handle_deep_link(app: &AppHandle, url: &str) {
    info!("deep link received: {url}");
    let parsed = match url::Url::parse(url) {
        Ok(u) => u,
        Err(e) => {
            let _ = app.emit(
                "session-error",
                serde_json::json!({ "message": format!("invalid URL: {e}") }),
            );
            return;
        }
    };

    let params: std::collections::HashMap<String, String> =
        parsed.query_pairs().map(|(k, v)| (k.to_string(), v.to_string())).collect();

    let Some(code) = params.get("code") else {
        let _ = app.emit(
            "session-error",
            serde_json::json!({ "message": "missing code parameter" }),
        );
        return;
    };
    let api = params
        .get("api")
        .cloned()
        .unwrap_or_else(|| "http://localhost:3001".to_string());

    info!("redeeming code {code} against {api}");
    match redeem::redeem_code(&api, code).await {
        Ok(redeemed) => {
            info!("redeemed: room={}, presenter={}", redeemed.room, redeemed.presenter_identity);
            let state = app.state::<AppState>();
            let payload = SessionInfoPayload {
                room: redeemed.room.clone(),
                presenter_name: redeemed.presenter_name.clone(),
            };
            *state.session_info.lock().unwrap() = Some(redeemed);
            let _ = app.emit("session-ready", payload);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        Err(e) => {
            info!("redeem failed: {e}");
            let _ = app.emit(
                "session-error",
                serde_json::json!({ "message": e }),
            );
        }
    }
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // On Windows/Linux, a second instance is spawned with the URL as a
            // CLI arg. Forward it to the existing instance's deep link handler.
            for arg in &argv[1..] {
                if arg.starts_with("huddle://") {
                    let app = app.clone();
                    let url = arg.clone();
                    tauri::async_runtime::spawn(async move {
                        handle_deep_link(&app, &url).await;
                    });
                    break;
                }
            }
        }))
        .manage(AppState {
            session_info: Mutex::new(None),
            session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            list_monitors,
            get_session_info,
            start_sharing,
            stop_sharing,
            cancel_session,
        ])
        .setup(|app| {
            // Deep link handler (macOS: events come to the running instance).
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                if let Some(url) = event.urls().first() {
                    let url = url.to_string();
                    let handle = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        handle_deep_link(&handle, &url).await;
                    });
                }
            });

            // CLI fallback: --code and --api args for manual launch.
            let args: Vec<String> = std::env::args().collect();
            let code = args.windows(2).find(|w| w[0] == "--code").map(|w| w[1].clone());
            let api = args
                .windows(2)
                .find(|w| w[0] == "--api")
                .map(|w| w[1].clone())
                .unwrap_or_else(|| "http://localhost:3001".to_string());

            let auto_start = args.iter().any(|a| a == "--auto");

            if let Some(code) = code {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let url = format!("huddle://present?code={}&api={}", code, api);
                    handle_deep_link(&handle, &url).await;

                    // --auto: skip the confirm dialog, start sharing on monitor 0.
                    if auto_start {
                        info!("auto-start: starting share on monitor 0");
                        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
                        let redeemed = {
                            let state = handle.state::<AppState>();
                            state.session_info.lock().unwrap().clone()
                        };
                        if let Some(redeemed) = redeemed {
                            match Session::start(redeemed, 0, event_tx).await {
                                Ok(new_session) => {
                                    info!("auto-start: sharing started");
                                    let state = handle.state::<AppState>();
                                    *state.session.lock().unwrap() = Some(new_session);
                                    let handle2 = handle.clone();
                                    tokio::spawn(async move {
                                        while let Some(event) = event_rx.recv().await {
                                            match event {
                                                SessionEvent::SharingStarted { room } => {
                                                    let _ = handle2.emit("sharing-started", serde_json::json!({ "room": room }));
                                                }
                                                SessionEvent::Stopped => {
                                                    info!("auto-start: session stopped");
                                                    handle2.exit(0);
                                                }
                                            }
                                        }
                                    });
                                }
                                Err(e) => {
                                    info!("auto-start failed: {e}");
                                    handle.exit(1);
                                }
                            }
                        }
                    }
                });
            } else {
                // No deep link or CLI args — show the window for manual entry
                // (future: add a code input field).
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running huddle agent");
}
