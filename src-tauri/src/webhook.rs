// HTTP-Webhook-Server (axum). Hört auf konfigurierbarem Port und leitet
// Requests als Tauri-Events "webhook" an das Frontend weiter, das die
// eigentliche Logik (Timer-Berechnung, Sounds, Blockier-Liste an Rust
// zurückspielen) hält.
//
// Endpunkte (alle akzeptieren GET + POST, damit Browser-Test und Tools wie
// TikFinity gleich funktionieren):
//
//   /block?key=W&duration=60      Taste W für 60 Sekunden blockieren
//   /block?vk=87&duration=60      Identisch, aber per Virtual-Key-Code
//   /unblock?key=W                Taste W sofort entsperren
//   /reset                        Alle Sperren aufheben
//   /status                       JSON-Snapshot vom Frontend
//   /                             API-Übersicht

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, on, MethodFilter},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{oneshot, Mutex};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use crate::AppState;

#[derive(Clone, Debug)]
pub struct WebhookConfig {
    pub port: u16,
    pub enabled: bool,
    pub bind_all: bool,
}

impl Default for WebhookConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            enabled: true,
            bind_all: true,
        }
    }
}

pub struct WebhookHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl WebhookHandle {
    pub fn shutdown(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

#[derive(Clone)]
struct AxumState {
    app: AppHandle,
}

#[derive(Deserialize)]
struct BlockParams {
    key: Option<String>,
    vk: Option<u32>,
    duration: Option<f64>,
    seconds: Option<f64>,
    ms: Option<u64>,
}

#[derive(Deserialize)]
struct UnblockParams {
    key: Option<String>,
    vk: Option<u32>,
}

fn cors() -> CorsLayer {
    CorsLayer::permissive()
}

fn build_router(state: AxumState) -> Router {
    let any = MethodFilter::GET.or(MethodFilter::POST);
    Router::new()
        .route("/block", on(any, handle_block))
        .route("/unblock", on(any, handle_unblock))
        .route("/reset", on(any, handle_reset))
        .route("/status", on(any, handle_status))
        .route("/", get(handle_root))
        // Bequemlichkeits-Aliase: /w, /a, /s, /d, /space → /block?key=<X>
        .route("/:short", on(any, handle_short))
        .with_state(state)
        .layer(cors())
}

pub async fn start_server(
    app: AppHandle,
    config: WebhookConfig,
) -> Result<WebhookHandle, String> {
    let ip = if config.bind_all {
        IpAddr::V4(Ipv4Addr::UNSPECIFIED)
    } else {
        IpAddr::V4(Ipv4Addr::LOCALHOST)
    };
    let addr = SocketAddr::new(ip, config.port);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Port {} konnte nicht gebunden werden: {}", config.port, e))?;

    let (tx, rx) = oneshot::channel();
    let router = build_router(AxumState { app: app.clone() });

    tokio::spawn(async move {
        let server = axum::serve(listener, router).with_graceful_shutdown(async move {
            let _ = rx.await;
        });
        if let Err(e) = server.await {
            eprintln!("Webhook-Server beendet: {}", e);
        }
    });

    println!(
        "Webhook-Server läuft auf {}:{} (bind_all={})",
        ip, config.port, config.bind_all
    );

    Ok(WebhookHandle {
        shutdown_tx: Some(tx),
    })
}

// =============== Handlers ===============

async fn handle_block(
    State(s): State<AxumState>,
    Query(params): Query<BlockParams>,
) -> impl IntoResponse {
    let key_id = match resolve_key_id(&params.key, params.vk) {
        Ok(k) => k,
        Err(msg) => return json_err(StatusCode::BAD_REQUEST, &msg),
    };

    // Duration in Sekunden: bevorzugt `duration`, dann `seconds`, dann `ms/1000`.
    let duration_sec = params
        .duration
        .or(params.seconds)
        .or_else(|| params.ms.map(|m| m as f64 / 1000.0))
        .unwrap_or(5.0);

    if !duration_sec.is_finite() || duration_sec <= 0.0 {
        return json_err(StatusCode::BAD_REQUEST, "duration muss > 0 sein");
    }

    let _ = s.app.emit(
        "webhook",
        json!({ "kind": "block", "keyId": key_id, "durationSec": duration_sec }),
    );
    json_ok(&format!("Block: {} für {:.1}s", key_id, duration_sec))
}

async fn handle_unblock(
    State(s): State<AxumState>,
    Query(params): Query<UnblockParams>,
) -> impl IntoResponse {
    let key_id = match resolve_key_id(&params.key, params.vk) {
        Ok(k) => k,
        Err(msg) => return json_err(StatusCode::BAD_REQUEST, &msg),
    };
    let _ = s
        .app
        .emit("webhook", json!({ "kind": "unblock", "keyId": key_id }));
    json_ok(&format!("Unblock: {}", key_id))
}

async fn handle_reset(State(s): State<AxumState>) -> impl IntoResponse {
    let _ = s.app.emit("webhook", json!({ "kind": "reset" }));
    json_ok("Alle Sperren aufgehoben")
}

async fn handle_short(
    State(s): State<AxumState>,
    axum::extract::Path(short): axum::extract::Path<String>,
    Query(params): Query<BlockParams>,
) -> impl IntoResponse {
    // /w?duration=10 → block?key=w&duration=10
    let key_id = match resolve_key_id(&Some(short.clone()), params.vk) {
        Ok(k) => k,
        Err(msg) => return json_err(StatusCode::BAD_REQUEST, &msg),
    };
    let duration_sec = params
        .duration
        .or(params.seconds)
        .or_else(|| params.ms.map(|m| m as f64 / 1000.0))
        .unwrap_or(5.0);
    if !duration_sec.is_finite() || duration_sec <= 0.0 {
        return json_err(StatusCode::BAD_REQUEST, "duration muss > 0 sein");
    }
    let _ = s.app.emit(
        "webhook",
        json!({ "kind": "block", "keyId": key_id, "durationSec": duration_sec }),
    );
    json_ok(&format!("Block: {} für {:.1}s", key_id, duration_sec))
}

async fn handle_status(State(s): State<AxumState>) -> impl IntoResponse {
    let reply_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<Value>();

    if let Some(app_state) = s.app.try_state::<Arc<AppState>>() {
        app_state
            .status_responders
            .lock()
            .await
            .insert(reply_id.clone(), tx);
    } else {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, "State nicht verfügbar");
    }

    let _ = s.app.emit(
        "webhook",
        json!({ "kind": "status", "replyId": reply_id.clone() }),
    );

    match tokio::time::timeout(Duration::from_millis(1500), rx).await {
        Ok(Ok(value)) => (StatusCode::OK, Json(value)).into_response(),
        _ => {
            if let Some(app_state) = s.app.try_state::<Arc<AppState>>() {
                app_state.status_responders.lock().await.remove(&reply_id);
            }
            json_err(StatusCode::GATEWAY_TIMEOUT, "Frontend antwortete nicht")
        }
    }
}

async fn handle_root() -> impl IntoResponse {
    Json(json!({
        "app": "InteractiveKeyboard",
        "endpoints": [
            "/block?key=W&duration=60",
            "/block?vk=87&duration=60",
            "/unblock?key=W",
            "/reset",
            "/status",
            "/<key>?duration=N (Shortcut, z.B. /w?duration=10)"
        ],
        "keys": ["W", "A", "S", "D", "SPACE", "LMB", "RMB", "WHEEL", "<beliebige Buchstaben/Zahlen/VK-Codes>"]
    }))
}

// =============== Helpers ===============

// Akzeptiert key-Strings ("w", "W", "space", "Space", "spacebar") sowie
// numerische VK-Codes. Liefert die kanonische Frontend-Id zurück (immer
// uppercase Buchstaben bzw. "SPACE", oder VK<n>).
fn resolve_key_id(key: &Option<String>, vk: Option<u32>) -> Result<String, String> {
    if let Some(v) = vk {
        return Ok(vk_to_id(v));
    }
    let raw = key
        .as_ref()
        .ok_or_else(|| "Parameter 'key' oder 'vk' fehlt".to_string())?
        .trim();
    if raw.is_empty() {
        return Err("Parameter 'key' ist leer".into());
    }
    let upper = raw.to_uppercase();
    let normalized = match upper.as_str() {
        "SPACE" | "SPACEBAR" | "LEER" | "LEERTASTE" => "SPACE".to_string(),
        // Maus-Aliase
        "LMB" | "LEFTCLICK" | "LEFTMOUSE" | "LINKSKLICK" | "MOUSE1" | "M1" => "LMB".to_string(),
        "RMB" | "RIGHTCLICK" | "RIGHTMOUSE" | "RECHTSKLICK" | "MOUSE2" | "M2" => "RMB".to_string(),
        "WHEEL" | "MMB" | "MIDDLECLICK" | "MIDDLEMOUSE" | "MITTELKLICK" | "MOUSE3" | "M3"
        | "MAUSRAD" | "MOUSEWHEEL" | "SCROLL" => "WHEEL".to_string(),
        _ => upper,
    };
    Ok(normalized)
}

fn vk_to_id(vk: u32) -> String {
    match vk {
        0x01 => "LMB".to_string(),
        0x02 => "RMB".to_string(),
        0x04 => "WHEEL".to_string(),
        0x20 => "SPACE".to_string(),
        0x30..=0x39 => format!("{}", (vk - 0x30) as u8 as char), // 0-9
        0x41..=0x5A => format!("{}", vk as u8 as char),          // A-Z
        _ => format!("VK{}", vk),
    }
}

fn json_ok(msg: &str) -> axum::response::Response {
    (StatusCode::OK, Json(json!({ "ok": true, "message": msg }))).into_response()
}

fn json_err(status: StatusCode, msg: &str) -> axum::response::Response {
    (status, Json(json!({ "ok": false, "error": msg }))).into_response()
}

// Server (neu)starten basierend auf neuer Config.
pub async fn restart_server(
    app: AppHandle,
    new_cfg: WebhookConfig,
    handle_slot: &Mutex<Option<WebhookHandle>>,
    config_slot: &Mutex<WebhookConfig>,
) -> Result<(), String> {
    {
        let mut guard = handle_slot.lock().await;
        if let Some(mut h) = guard.take() {
            h.shutdown();
        }
    }
    tokio::time::sleep(Duration::from_millis(100)).await;

    if new_cfg.enabled {
        let new_handle = start_server(app.clone(), new_cfg.clone()).await?;
        *handle_slot.lock().await = Some(new_handle);
    }
    *config_slot.lock().await = new_cfg;
    Ok(())
}

// Status-Responder-Map dispose
pub async fn deliver_status_reply(
    map: &Mutex<HashMap<String, oneshot::Sender<Value>>>,
    reply_id: &str,
    value: Value,
) -> bool {
    let mut guard = map.lock().await;
    if let Some(tx) = guard.remove(reply_id) {
        let _ = tx.send(value);
        true
    } else {
        false
    }
}
