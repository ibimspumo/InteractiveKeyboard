// Windows-Low-Level-Keyboard-Hook.
//
// Funktionsweise:
// - SetWindowsHookExW(WH_KEYBOARD_LL) installiert einen systemweiten Hook.
// - Die Callback-Funktion `hook_proc` läuft im Kontext der Message-Loop-Threads,
//   die Tastatur-Events generieren — also im Background-Thread, der unten in
//   start_hook() seine eigene GetMessageW-Schleife dreht.
// - Schauen in BLOCKED nach: ist der vk-Code drin → LRESULT(1) zurückgeben,
//   was Windows mitteilt "Event ist konsumiert, nicht weiterleiten".
// - LowLevelHooksTimeout (Registry-Default 300ms): der Proc MUSS in <300ms
//   zurückkehren, sonst kickt Windows den Hook. Deshalb hier nur ein
//   read-lock + HashSet-Lookup — kein I/O, kein Dialog.
//
// Anti-Cheat: Wenn ein bekannter Anti-Cheat-Prozess läuft, sollte das Frontend
// die BLOCKED-Liste nicht füllen. Hook bleibt installiert, schluckt aber nichts.

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::collections::HashSet;
use std::thread;
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, HHOOK, MSG,
    WH_KEYBOARD_LL,
};

// Globaler Zustand: gemeinsam von Hook-Proc + Frontend-Commands.
pub static BLOCKED: Lazy<RwLock<HashSet<u32>>> = Lazy::new(|| RwLock::new(HashSet::new()));
static HOOK_ACTIVE: Lazy<RwLock<bool>> = Lazy::new(|| RwLock::new(false));

// Anti-Cheat-Prozesse — wenn einer läuft, soll das Frontend BLOCKED leer
// halten. Liste ist konservativ; eher false-negative als false-positive.
pub const ANTICHEAT_PROCS: &[&str] = &[
    "vgc.exe",
    "vgtray.exe",                     // Riot Vanguard (Valorant, LoL)
    "EasyAntiCheat.exe",
    "EasyAntiCheat_EOS.exe",          // EAC (Fortnite, Apex, ...)
    "BEService.exe",                  // BattlEye (R6, PUBG, ...)
    "FACEIT.exe",
    "FACEITService.exe",
];

#[repr(C)]
struct KbdllHookStruct {
    vk_code: u32,
    scan_code: u32,
    flags: u32,
    time: u32,
    extra_info: usize,
}

extern "system" fn hook_proc(code: i32, w: WPARAM, l: LPARAM) -> LRESULT {
    if code >= 0 {
        // SAFETY: bei code>=0 garantiert Windows ein gültiges KbdllHookStruct unter l.
        let kbd = unsafe { &*(l.0 as *const KbdllHookStruct) };
        if BLOCKED.read().contains(&kbd.vk_code) {
            // Event schlucken — wird NICHT an die Ziel-Anwendung weitergegeben.
            return LRESULT(1);
        }
    }
    unsafe { CallNextHookEx(HHOOK::default(), code, w, l) }
}

pub fn start_hook() {
    if *HOOK_ACTIVE.read() {
        return;
    }
    *HOOK_ACTIVE.write() = true;

    thread::spawn(|| unsafe {
        let hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("SetWindowsHookExW fehlgeschlagen: {:?}", e);
                *HOOK_ACTIVE.write() = false;
                return;
            }
        };

        // Message-Loop. GetMessageW blockiert bis WM_QUIT (oder Fehler) — der
        // Hook lebt für die Programm-Laufzeit. Beim Programm-Exit räumt Windows
        // den Hook ohnehin auf, aber der Vollständigkeit halber unhooken wir.
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            // Keine Translation/Dispatch nötig — wir haben kein Fenster auf
            // diesem Thread; alle Events kommen direkt durch den Hook rein.
        }

        let _ = UnhookWindowsHookEx(hook);
        *HOOK_ACTIVE.write() = false;
    });
}

pub fn set_blocked(vks: HashSet<u32>) {
    *BLOCKED.write() = vks;
}

pub fn clear_blocked() {
    BLOCKED.write().clear();
}

pub fn is_anticheat_running() -> bool {
    use sysinfo::{ProcessesToUpdate, System};
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, false);
    sys.processes().values().any(|p| {
        let name = p.name().to_string_lossy();
        ANTICHEAT_PROCS
            .iter()
            .any(|ac| name.eq_ignore_ascii_case(ac))
    })
}
