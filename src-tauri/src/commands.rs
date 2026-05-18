use std::collections::HashSet;
use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::webhook::{self, WebhookConfig};
use crate::AppState;

#[tauri::command]
pub async fn apply_settings(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    port: u16,
    enabled: bool,
    bind_all: bool,
) -> Result<(), String> {
    let new_cfg = WebhookConfig {
        port,
        enabled,
        bind_all,
    };

    // Falls Config identisch und Status passt → nichts tun
    let current_cfg = state.config.lock().await.clone();
    let already_running = state.webhook.lock().await.is_some();
    if current_cfg.port == new_cfg.port
        && current_cfg.enabled == new_cfg.enabled
        && current_cfg.bind_all == new_cfg.bind_all
        && already_running == new_cfg.enabled
    {
        return Ok(());
    }

    webhook::restart_server(app, new_cfg, &state.webhook, &state.config).await
}

#[tauri::command]
pub fn get_local_ip() -> String {
    match local_ip_address::local_ip() {
        Ok(ip) => ip.to_string(),
        Err(_) => String::new(),
    }
}

#[tauri::command]
pub async fn status_reply(
    state: State<'_, Arc<AppState>>,
    reply_id: String,
    status: Value,
) -> Result<(), String> {
    webhook::deliver_status_reply(&state.status_responders, &reply_id, status).await;
    Ok(())
}

// Frontend setzt die Liste aktuell zu blockierender Virtual-Key-Codes.
// Wird bei jeder Änderung (block/unblock/timer-ablauf) aufgerufen.
#[tauri::command]
pub fn set_blocked_keys(vks: Vec<u32>) -> Result<(), String> {
    #[cfg(windows)]
    {
        let set: HashSet<u32> = vks.into_iter().collect();
        crate::keyblock::set_blocked(set);
    }
    #[cfg(not(windows))]
    {
        let _ = vks;
    }
    Ok(())
}

#[tauri::command]
pub fn clear_blocked_keys() -> Result<(), String> {
    #[cfg(windows)]
    {
        crate::keyblock::clear_blocked();
        crate::mouseblock::clear_flags();
    }
    Ok(())
}

// Frontend setzt vier Flags für Maus-Blocking: links/rechts/mitte-Klick und
// Mausrad-Scroll. WHEEL-Click und WHEEL-Scroll werden separat gesteuert,
// damit die Settings (wheel.click / wheel.scroll) granular wirken.
#[tauri::command]
pub fn set_blocked_mouse(
    block_left: bool,
    block_right: bool,
    block_middle: bool,
    block_scroll: bool,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        crate::mouseblock::set_flags(crate::mouseblock::MouseBlockFlags {
            block_left,
            block_right,
            block_middle,
            block_scroll,
        });
    }
    #[cfg(not(windows))]
    {
        let _ = (block_left, block_right, block_middle, block_scroll);
    }
    Ok(())
}

#[tauri::command]
pub fn anticheat_running() -> bool {
    #[cfg(windows)]
    {
        crate::keyblock::is_anticheat_running()
    }
    #[cfg(not(windows))]
    {
        false
    }
}
