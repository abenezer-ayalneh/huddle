use std::time::Duration;

use arboard::Clipboard;
use log::{info, warn};
use tokio::sync::{mpsc, watch};

pub enum ClipboardCommand {
    SetText(String),
}

pub struct ClipboardWatcher {
    shutdown_tx: watch::Sender<bool>,
    handle: Option<std::thread::JoinHandle<()>>,
    cmd_tx: mpsc::UnboundedSender<ClipboardCommand>,
}

impl ClipboardWatcher {
    pub fn start(on_change: mpsc::UnboundedSender<String>) -> Result<Self, String> {
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();

        let handle = std::thread::Builder::new()
            .name("clipboard-watcher".into())
            .spawn(move || {
                clipboard_thread(shutdown_rx, cmd_rx, on_change);
            })
            .map_err(|e| format!("failed to spawn clipboard thread: {e}"))?;

        Ok(Self {
            shutdown_tx,
            handle: Some(handle),
            cmd_tx,
        })
    }

    pub fn set_text(&self, text: String) {
        let _ = self.cmd_tx.send(ClipboardCommand::SetText(text));
    }

    pub fn stop(&mut self) {
        let _ = self.shutdown_tx.send(true);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

fn clipboard_thread(
    shutdown_rx: watch::Receiver<bool>,
    mut cmd_rx: mpsc::UnboundedReceiver<ClipboardCommand>,
    on_change: mpsc::UnboundedSender<String>,
) {
    let mut clipboard = match Clipboard::new() {
        Ok(c) => c,
        Err(e) => {
            warn!("clipboard unavailable: {e}");
            return;
        }
    };

    let mut last_text: Option<String> = clipboard.get_text().ok();
    let poll_interval = Duration::from_millis(500);

    loop {
        if *shutdown_rx.borrow() {
            break;
        }

        while let Ok(cmd) = cmd_rx.try_recv() {
            match cmd {
                ClipboardCommand::SetText(text) => {
                    if let Err(e) = clipboard.set_text(&text) {
                        warn!("clipboard set failed: {e}");
                    } else {
                        last_text = Some(text);
                    }
                }
            }
        }

        if let Ok(current) = clipboard.get_text() {
            let changed = last_text.as_ref().map_or(true, |prev| prev != &current);
            if changed && !current.is_empty() {
                info!("clipboard changed ({}B)", current.len());
                let _ = on_change.send(current.clone());
                last_text = Some(current);
            }
        }

        std::thread::sleep(poll_interval);
    }
}
