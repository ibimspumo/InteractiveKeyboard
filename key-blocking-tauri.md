# Tastatur-Blockierung in Tauri 2 (Windows)

Systemweites Blockieren einzelner Tasten via Low-Level-Keyboard-Hook.
Funktioniert in jedem Programm/Spiel, sofern kein Anti-Cheat den Hook erkennt.

## Cargo.toml
```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.58", features = [
    "Win32_UI_WindowsAndMessaging",
    "Win32_UI_Input_KeyboardAndMouse",
    "Win32_Foundation",
] }
sysinfo = "0.32"          # für Anti-Cheat-Prozess-Detection
once_cell = "1"
parking_lot = "0.12"
```

## src-tauri/src/keyblock.rs
```rust
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::collections::HashSet;
use std::thread;
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::*;

static BLOCKED: Lazy<RwLock<HashSet<u32>>> = Lazy::new(|| RwLock::new(HashSet::new()));
static HOOK_ACTIVE: Lazy<RwLock<bool>> = Lazy::new(|| RwLock::new(false));

// Anti-Cheat-Prozesse — wenn einer läuft, NICHT hooken
const ANTICHEAT_PROCS: &[&str] = &[
    "vgc.exe", "vgtray.exe",                    // Vanguard (Valorant, LoL)
    "EasyAntiCheat.exe", "EasyAntiCheat_EOS.exe", // EAC (Fortnite, Apex, ...)
    "BEService.exe",                            // BattlEye (R6, PUBG, ...)
    "FACEIT.exe",
];

#[repr(C)]
struct KBDLLHOOKSTRUCT {
    vk_code: u32, scan_code: u32, flags: u32, time: u32, extra_info: usize,
}

extern "system" fn hook_proc(code: i32, w: WPARAM, l: LPARAM) -> LRESULT {
    if code >= 0 {
        let kbd = unsafe { &*(l.0 as *const KBDLLHOOKSTRUCT) };
        if BLOCKED.read().contains(&kbd.vk_code) {
            return LRESULT(1); // Event schlucken
        }
    }
    unsafe { CallNextHookEx(None, code, w, l) }
}

pub fn start_hook() {
    if *HOOK_ACTIVE.read() { return; }
    *HOOK_ACTIVE.write() = true;
    thread::spawn(|| unsafe {
        let h = SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0).unwrap();
        let mut msg = std::mem::zeroed();
        while GetMessageW(&mut msg, None, 0, 0).into() { /* loop */ }
        let _ = UnhookWindowsHookEx(h);
    });
}

pub fn anticheat_running() -> bool {
    let mut sys = sysinfo::System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, false);
    sys.processes().values().any(|p| {
        ANTICHEAT_PROCS.iter().any(|ac| p.name().eq_ignore_ascii_case(ac))
    })
}

#[tauri::command]
pub fn block_key(vk: u32, duration_ms: u64) -> Result<(), String> {
    if anticheat_running() { return Err("Anti-Cheat aktiv".into()); }
    BLOCKED.write().insert(vk);
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(duration_ms)).await;
        BLOCKED.write().remove(&vk);
    });
    Ok(())
}
```

## src-tauri/src/lib.rs (Integration)
```rust
mod keyblock;

// In tauri::Builder::default().setup(...):
keyblock::start_hook();

// In .invoke_handler:
.invoke_handler(tauri::generate_handler![keyblock::block_key, /* ... */])
```

## Virtual-Key-Codes (häufig)
- W=0x57, A=0x41, S=0x53, D=0x44
- Space=0x20, Shift=0x10, Ctrl=0x11, Alt=0x12
- E=0x45, R=0x52, F=0x46, Q=0x51
- Vollständige Liste: docs.microsoft.com → "Virtual-Key Codes"

## Failsafe
- Globaler Notfall-Hotkey (z.B. F12) der `BLOCKED.write().clear()` aufruft
- Beim App-Exit Hook sauber unhooken
- Anti-Cheat-Check alle 5s im Background, bei Erkennung sofort BLOCKED clearen + Hook pausieren

## Wichtig
- DLL-Injection NICHT nötig — der Hook funktioniert mit `None` als Module
- Hook läuft im Thread der die Message-Loop hat → eigener Thread mit GetMessageW
- LowLevelHooksTimeout (Registry): Hook-Proc sollte <300ms brauchen, sonst kickt Windows den Hook
- Keine Admin-Rechte nötig
- App muss in keine speziellen Capabilities — Hook ist normale Win32-API
