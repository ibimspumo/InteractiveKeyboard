// Single-Source-of-Truth für alle persistierten Settings + Runtime-Typen.

export interface RGBA {
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
  a: number; // 0..1
}

// Sound-Referenz: null = keiner, "sound:<id>" = Bibliothek-Eintrag,
// sonst = roher User-Pfad (legacy).
export type SoundRef = string | null;

export interface SoundEntry {
  id: string;
  name: string;
  path: string; // absoluter Datei-Pfad (vom Dialog gewählt)
}

// Verhalten bei Mehrfach-Einlösung auf einer schon blockierten Taste.
export type MultiTriggerMode = "reset" | "add" | "ignore";

// Aktiver Overlay-Layout-Modus.
//   "keyboard"        – WASD only, 1:1 (500×500). Tastatur in der Mitte.
//   "mouse"           – Maus only, 1:1 (500×500). Maus in der Mitte.
//   "keyboard+mouse"  – Querformat 2:1 (1000×500), Tastatur links, Maus rechts.
// Erweiterbar (full keyboard etc.) — neue Modi hier ergänzen und in
// aspectForLayout()/refWidthForLayout() Mappings setzen.
export type LayoutMode = "keyboard" | "mouse" | "keyboard+mouse";

// Welche Teile des Mausrad-Eintrags blockiert werden, wenn WHEEL aktiv ist.
export interface WheelBlockMode {
  click: boolean;  // Mittelklick
  scroll: boolean; // Scroll-Events
}

// Definition einer einzelnen Taste auf dem Overlay.
// Position & Größe sind in Referenz-px-Koordinaten (Tastatur-Quadrant 500×500).
export interface KeyDef {
  id: string;            // "W", "A", "SPACE", "VK87" — Kanonische Webhook-Id
  vk: number;            // Windows Virtual-Key-Code (z.B. 0x57 = 'W')
  label: string;         // Anzeige auf dem Key ("W", "JUMP", ...)
  x: number;
  y: number;
  width: number;
  height: number;

  giftIconPath: string | null;
  giftOffsetX: number;
  giftOffsetY: number;
  giftScale: number;

  keyColor: RGBA;
  keyColorBlocked: RGBA;
  textColor: RGBA;
  textColorBlocked: RGBA;
  borderRadius: number;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;

  blockSoundPath: SoundRef;
  blockSoundVolumeDb: number;
  unblockSoundPath: SoundRef;
  unblockSoundVolumeDb: number;
}

// Ein klickbarer Maus-Sub-Button (LMB/RMB/WHEEL). Strukturell wie eine Taste,
// aber Position & Form werden vom MouseDevice-Layout abgeleitet — die hier
// gespeicherten x/y/width/height beziehen sich auf den Hit-Bereich relativ
// zur Maus-Bounding-Box (Ref-px, 0..MouseDef.width / 0..MouseDef.height).
export interface MouseButtonDef {
  id: "LMB" | "RMB" | "WHEEL";
  vk: number;        // 0x01, 0x02, 0x04 (informativ — Block läuft über mouse hook)
  label: string;     // "L", "R", "" (für WHEEL meist leer)

  giftIconPath: string | null;
  giftOffsetX: number;
  giftOffsetY: number;
  giftScale: number;

  keyColor: RGBA;
  keyColorBlocked: RGBA;
  textColor: RGBA;
  textColorBlocked: RGBA;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;

  blockSoundPath: SoundRef;
  blockSoundVolumeDb: number;
  unblockSoundPath: SoundRef;
  unblockSoundVolumeDb: number;
}

// Komplettes Maus-Element: Position des gesamten Maus-Körpers im Ref-Raum
// (1000×500 — Maus liegt im rechten Quadranten 500..1000) plus Stil und die
// drei Sub-Buttons.
export interface MouseDef {
  // Position der Maus-Bbox im Ref-Raum (Querformat).
  x: number;
  y: number;
  width: number;
  height: number;

  // Form des Maus-Körpers
  bodyColor: RGBA;
  bodyColorBlocked: RGBA;
  bodyBorderColor: RGBA;
  bodyBorderWidth: number; // Ref-px
  // Trenn-Linie zwischen LMB/RMB
  dividerColor: RGBA;
  dividerWidth: number;    // Ref-px

  // Sub-Buttons (LMB, RMB, WHEEL). Reihenfolge ist semantisch egal —
  // Render-Reihenfolge wird in Mouse.svelte explizit gesetzt.
  buttons: MouseButtonDef[];

  // Mausrad-Verhalten
  wheel: WheelBlockMode;
}

export interface AppSettings {
  // ===== Layout =====
  layoutMode: LayoutMode;

  // ===== Tasten =====
  keys: KeyDef[];

  // ===== Maus =====
  mouse: MouseDef;

  // ===== Webhook =====
  webhookEnabled: boolean;
  webhookPort: number;
  webhookBindAllInterfaces: boolean;

  // ===== Block-Verhalten =====
  multiTriggerMode: MultiTriggerMode;
  maxBlockSeconds: number;
  defaultBlockSeconds: number;
  anticheatEnabled: boolean;

  // ===== Audio =====
  volumeDb: number;
  globalBlockSoundPath: SoundRef;
  globalBlockSoundVolumeDb: number;
  globalUnblockSoundPath: SoundRef;
  globalUnblockSoundVolumeDb: number;
  soundLibrary: SoundEntry[];

  // ===== Globale Visuals =====
  showBlockX: boolean;
  blockXColor: RGBA;
  showTimer: boolean;
  timerColor: RGBA;
  timerFontSize: number;
  timerFontWeight: number;
  timerOffsetY: number;
  backgroundColor: RGBA;
}

// Live-Zustand einer blockbaren Entität (Taste ODER Maus-Button).
export interface KeyRuntime {
  id: string;
  blockedUntilMs: number; // 0 = nicht blockiert
}

export interface AppStatus {
  keys: Array<{
    id: string;
    blocked: boolean;
    timeLeftSec: number;
  }>;
  webhookPort: number;
  anticheatRunning: boolean;
}
