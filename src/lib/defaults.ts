import type {
  AppSettings,
  KeyDef,
  MouseButtonDef,
  MouseDef,
  RGBA,
} from "./types";

// Default-Sound-URLs (gebündelt, immer verfügbar).
import blockSoundUrl from "../assets/defaults/sounds/block.mp3?url";
import unblockSoundUrl from "../assets/defaults/sounds/unblock.mp3?url";
export const DEFAULT_BLOCK_SOUND_URL = blockSoundUrl;
export const DEFAULT_UNBLOCK_SOUND_URL = unblockSoundUrl;

// Ref-Koordinatensystem: 500×500 für Tastatur-Quadrant. Im Querformat
// (layoutMode=keyboard+mouse) ist das Fenster 1000×500 — die Maus lebt im
// rechten 500..1000 X-Bereich, die Tastatur bleibt im linken 0..500.
export const REF_HEIGHT = 500;
export const KEYBOARD_REF_WIDTH = 500;
export const MOUSE_REF_X_OFFSET = 500;

// === RGBA-Helpers ===
export function rgba(r: number, g: number, b: number, a = 1): RGBA {
  return { r, g, b, a };
}

export function rgbaToCss(c: RGBA): string {
  const ch = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${c.a.toFixed(3)})`;
}

export function rgbaToHex(c: RGBA): string {
  const ch = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}

export function hexToRgba(hex: string): RGBA {
  const h = hex.replace("#", "");
  if (h.length !== 6) return { r: 1, g: 1, b: 1, a: 1 };
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a: 1,
  };
}

function defaultKeyStyle() {
  return {
    keyColor: rgba(0.18, 0.18, 0.21, 1),
    keyColorBlocked: rgba(0.18, 0.18, 0.21, 1),
    textColor: rgba(0.85, 0.85, 0.88, 1),
    textColorBlocked: rgba(0.85, 0.85, 0.88, 0.35),
    borderRadius: 14,
    fontSize: 52,
    fontWeight: 700,
    letterSpacing: 1,
    giftScale: 1,
    blockSoundPath: null,
    blockSoundVolumeDb: 0,
    unblockSoundPath: null,
    unblockSoundVolumeDb: 0,
  };
}

function defaultKeys(): KeyDef[] {
  const keySize = 90;
  const gap = 12;
  const cy1 = 130;
  const cy2 = cy1 + keySize + gap;
  const cy3 = cy2 + keySize + gap + 22;
  const centerX = 250;

  const totalWidth = 3 * keySize + 2 * gap;
  const startX = centerX - totalWidth / 2;

  const spaceWidth = 320;
  const spaceHeight = 70;

  return [
    {
      id: "W",
      vk: 0x57,
      label: "W",
      x: centerX - keySize / 2,
      y: cy1,
      width: keySize,
      height: keySize,
      giftIconPath: null,
      giftOffsetX: 0,
      giftOffsetY: -50,
      ...defaultKeyStyle(),
    },
    {
      id: "A",
      vk: 0x41,
      label: "A",
      x: startX,
      y: cy2,
      width: keySize,
      height: keySize,
      giftIconPath: null,
      giftOffsetX: -40,
      giftOffsetY: -40,
      ...defaultKeyStyle(),
    },
    {
      id: "S",
      vk: 0x53,
      label: "S",
      x: startX + keySize + gap,
      y: cy2,
      width: keySize,
      height: keySize,
      giftIconPath: null,
      giftOffsetX: 0,
      giftOffsetY: -60,
      ...defaultKeyStyle(),
    },
    {
      id: "D",
      vk: 0x44,
      label: "D",
      x: startX + 2 * (keySize + gap),
      y: cy2,
      width: keySize,
      height: keySize,
      giftIconPath: null,
      giftOffsetX: 40,
      giftOffsetY: -40,
      ...defaultKeyStyle(),
    },
    {
      id: "SPACE",
      vk: 0x20,
      label: "space",
      x: centerX - spaceWidth / 2,
      y: cy3,
      width: spaceWidth,
      height: spaceHeight,
      giftIconPath: null,
      giftOffsetX: 90,
      giftOffsetY: 0,
      ...defaultKeyStyle(),
      fontSize: 38,
      letterSpacing: 3,
    },
  ];
}

function defaultMouseButtonStyle() {
  return {
    keyColor: rgba(0.18, 0.18, 0.21, 1),
    keyColorBlocked: rgba(0.18, 0.18, 0.21, 1),
    textColor: rgba(0.85, 0.85, 0.88, 1),
    textColorBlocked: rgba(0.85, 0.85, 0.88, 0.35),
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 1,
    giftScale: 1,
    blockSoundPath: null,
    blockSoundVolumeDb: 0,
    unblockSoundPath: null,
    unblockSoundVolumeDb: 0,
  };
}

// Maus-Standardlayout: Bbox ist 300×420 im Ref-Raum, zentriert im rechten
// Quadranten (X 500..1000, Y 0..500). Sub-Buttons sind logisch positioniert
// (LMB linke obere Hälfte, RMB rechte obere Hälfte, WHEEL zentral). Die
// tatsächliche Render-Geometrie liegt in Mouse.svelte; hier definieren wir
// nur Position & Gift-Slots pro Sub-Button.
function defaultMouseButtons(): MouseButtonDef[] {
  return [
    {
      id: "LMB",
      vk: 0x01,
      label: "L",
      giftIconPath: null,
      giftOffsetX: -45,
      giftOffsetY: -120,
      ...defaultMouseButtonStyle(),
    },
    {
      id: "RMB",
      vk: 0x02,
      label: "R",
      giftIconPath: null,
      giftOffsetX: 45,
      giftOffsetY: -120,
      ...defaultMouseButtonStyle(),
    },
    {
      id: "WHEEL",
      vk: 0x04,
      label: "",
      giftIconPath: null,
      giftOffsetX: 0,
      giftOffsetY: -20,
      ...defaultMouseButtonStyle(),
      fontSize: 18,
    },
  ];
}

function defaultMouse(): MouseDef {
  return {
    // Maus zentriert im rechten Quadranten: Bbox 300×420 → x=600 (mitte 750), y=40
    x: 600,
    y: 40,
    width: 300,
    height: 420,
    bodyColor: rgba(0.18, 0.18, 0.21, 1),
    bodyColorBlocked: rgba(0.18, 0.18, 0.21, 1),
    bodyBorderColor: rgba(0.05, 0.05, 0.07, 1),
    bodyBorderWidth: 4,
    dividerColor: rgba(0.08, 0.08, 0.1, 1),
    dividerWidth: 4,
    buttons: defaultMouseButtons(),
    wheel: { click: true, scroll: true },
  };
}

export function defaultSettings(): AppSettings {
  return {
    layoutMode: "keyboard+mouse",

    keys: defaultKeys(),
    mouse: defaultMouse(),

    webhookEnabled: true,
    webhookPort: 8080,
    webhookBindAllInterfaces: true,

    multiTriggerMode: "add",
    maxBlockSeconds: 300,
    defaultBlockSeconds: 5,
    anticheatEnabled: true,

    volumeDb: -6,
    globalBlockSoundPath: null,
    globalBlockSoundVolumeDb: 0,
    globalUnblockSoundPath: null,
    globalUnblockSoundVolumeDb: 0,
    soundLibrary: [],

    showBlockX: true,
    blockXColor: rgba(0.95, 0.18, 0.18, 0.95),

    showTimer: true,
    timerColor: rgba(1, 1, 1, 1),
    timerFontSize: 30,
    timerFontWeight: 800,
    timerOffsetY: 0,

    backgroundColor: rgba(0, 0, 0, 0),
  };
}

// Aspect-Ratio (Breite/Höhe) für den aktiven Layout-Modus.
export function aspectForLayout(mode: AppSettings["layoutMode"]): number {
  switch (mode) {
    case "keyboard+mouse":
      return 1000 / 500;
    case "mouse":
    case "keyboard":
    default:
      return 1;
  }
}

// Referenz-Breite (für Skalierungs-Berechnung von Window-px ↔ Ref-px).
// Höhe ist konstant 500 in allen Modi.
export function refWidthForLayout(mode: AppSettings["layoutMode"]): number {
  return mode === "keyboard+mouse" ? 1000 : 500;
}

// Standard-Position der Maus-Bbox je nach Layout-Modus. Wird beim Mode-Wechsel
// angewendet, wenn die Maus-Position sonst außerhalb der Ref-Fläche läge.
export function defaultMousePositionForLayout(
  mode: AppSettings["layoutMode"],
  mouseWidth: number,
  mouseHeight: number,
): { x: number; y: number } {
  if (mode === "mouse") {
    // 1:1 (500×500) — Maus zentriert
    return {
      x: (500 - mouseWidth) / 2,
      y: (500 - mouseHeight) / 2,
    };
  }
  // keyboard+mouse (1000×500) — Maus zentriert im rechten Quadranten
  return {
    x: 500 + (500 - mouseWidth) / 2,
    y: (500 - mouseHeight) / 2,
  };
}

// Standard-Position der Tastatur ist gegeben durch die KeyDef.x-Werte selbst.
// Im keyboard+mouse-Layout liegt die Tastatur im linken Quadranten (0..500),
// was bereits der Default ist — keine Verschiebung nötig.
