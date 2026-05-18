// Windows-Low-Level-Mouse-Hook (WH_MOUSE_LL).
//
// Analog zum Keyboard-Hook in keyblock.rs, aber für Maus-Events. Wir schlucken
// einzelne Events basierend auf vier Flags, die das Frontend setzt:
//   - block_left:   Links-Klick (Down + Up)
//   - block_right:  Rechts-Klick (Down + Up)
//   - block_middle: Mittel-Klick / Wheel-Klick (Down + Up)
//   - block_scroll: Mausrad-Scroll (vertikal und horizontal)
//
// Klick-Up-Events MÜSSEN ebenfalls geschluckt werden, sonst hängt der Klick-
// State in Spielen fest. Wir blockieren Down + Up parallel; ein Klick, der
// genau auf der Block-Grenze landet, kann höchstens ein hängendes Up-Event
// produzieren — vernachlässigbar gegenüber dem "stuck button" Risiko.

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use std::thread;
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, HHOOK, MSG, WH_MOUSE_LL,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEHWHEEL, WM_MOUSEWHEEL,
    WM_RBUTTONDOWN, WM_RBUTTONUP,
};

#[derive(Clone, Copy, Default)]
pub struct MouseBlockFlags {
    pub block_left: bool,
    pub block_right: bool,
    pub block_middle: bool,
    pub block_scroll: bool,
}

pub static MOUSE_FLAGS: Lazy<RwLock<MouseBlockFlags>> =
    Lazy::new(|| RwLock::new(MouseBlockFlags::default()));
static HOOK_ACTIVE: Lazy<RwLock<bool>> = Lazy::new(|| RwLock::new(false));

extern "system" fn hook_proc(code: i32, w: WPARAM, l: LPARAM) -> LRESULT {
    if code >= 0 {
        let flags = *MOUSE_FLAGS.read();
        let msg = w.0 as u32;
        let swallow = match msg {
            WM_LBUTTONDOWN | WM_LBUTTONUP => flags.block_left,
            WM_RBUTTONDOWN | WM_RBUTTONUP => flags.block_right,
            WM_MBUTTONDOWN | WM_MBUTTONUP => flags.block_middle,
            WM_MOUSEWHEEL | WM_MOUSEHWHEEL => flags.block_scroll,
            _ => false,
        };
        if swallow {
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
        let hook = match SetWindowsHookExW(WH_MOUSE_LL, Some(hook_proc), None, 0) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("SetWindowsHookExW (mouse) fehlgeschlagen: {:?}", e);
                *HOOK_ACTIVE.write() = false;
                return;
            }
        };

        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {}

        let _ = UnhookWindowsHookEx(hook);
        *HOOK_ACTIVE.write() = false;
    });
}

pub fn set_flags(flags: MouseBlockFlags) {
    *MOUSE_FLAGS.write() = flags;
}

pub fn clear_flags() {
    *MOUSE_FLAGS.write() = MouseBlockFlags::default();
}
