mod commands;
mod webhook;

#[cfg(windows)]
mod keyblock;
#[cfg(windows)]
mod mouseblock;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use webhook::{WebhookConfig, WebhookHandle};

pub struct AppState {
    pub webhook: Mutex<Option<WebhookHandle>>,
    pub config: Mutex<WebhookConfig>,
    pub status_responders:
        Mutex<std::collections::HashMap<String, tokio::sync::oneshot::Sender<serde_json::Value>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let state = Arc::new(AppState {
                webhook: Mutex::new(None),
                config: Mutex::new(WebhookConfig::default()),
                status_responders: Mutex::new(std::collections::HashMap::new()),
            });
            app.manage(state.clone());

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
                let _ = win.set_shadow(false);
            }

            // Windows: Low-Level-Keyboard-Hook starten. Schluckt nur Tasten,
            // die in der gemeinsamen BLOCKED-Liste stehen (vom Frontend befüllt).
            #[cfg(windows)]
            {
                keyblock::start_hook();
                mouseblock::start_hook();
            }

            // Webhook-Server beim Start anwerfen (Default-Config: Port 8080, enabled, 0.0.0.0).
            let app_handle = app.handle().clone();
            let state_clone = state.clone();
            tauri::async_runtime::spawn(async move {
                let cfg = state_clone.config.lock().await.clone();
                if cfg.enabled {
                    match webhook::start_server(app_handle, cfg).await {
                        Ok(handle) => {
                            *state_clone.webhook.lock().await = Some(handle);
                        }
                        Err(e) => eprintln!("Webhook-Server konnte nicht starten: {}", e),
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::apply_settings,
            commands::get_local_ip,
            commands::status_reply,
            commands::set_blocked_keys,
            commands::clear_blocked_keys,
            commands::set_blocked_mouse,
            commands::anticheat_running,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri konnte nicht gestartet werden");
}
