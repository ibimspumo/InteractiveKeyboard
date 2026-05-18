import { get, writable, type Writable } from "svelte/store";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";

import type {
  AppSettings,
  KeyDef,
  KeyRuntime,
  MouseButtonDef,
  MultiTriggerMode,
  SoundRef,
} from "./types";
import { defaultSettings } from "./defaults";
import { resolveSoundUrl } from "./sound-library";
import { playPooled } from "./audio-pool";
import { DEFAULT_BLOCK_SOUND_URL, DEFAULT_UNBLOCK_SOUND_URL } from "./defaults";

const SETTINGS_FILE = "settings.json";
const SETTINGS_KEY = "settings";

// === Blockable-Entities ===
// Sowohl KeyDef als auch MouseButtonDef sind blockierbar — beide tragen
// id/vk/label und die Sound-/Style-Felder. Wir abstrahieren über eine
// Vereinigungstyp + Lookup, damit applyBlock/tickRuntimes/sounds gleich
// funktionieren.
export type BlockableEntity = KeyDef | MouseButtonDef;

// Liefert ALLE blockierbaren Entitäten der aktuellen Settings (Tasten + Maus-
// Buttons). Reihenfolge: erst Tasten, dann Maus-Buttons.
export function allBlockables(cfg: AppSettings): BlockableEntity[] {
  return [...cfg.keys, ...cfg.mouse.buttons];
}

export function findBlockable(
  cfg: AppSettings,
  id: string,
): BlockableEntity | undefined {
  const upperId = id.toUpperCase();
  for (const k of cfg.keys) if (k.id === upperId) return k;
  for (const b of cfg.mouse.buttons) if (b.id === upperId) return b;
  return undefined;
}

export const settings: Writable<AppSettings> = writable(defaultSettings());

// Live-Zustand pro blockierbarer Entität — nicht persistiert.
export const keyRuntimes: Writable<Record<string, KeyRuntime>> = writable({});

// Settings-Panel an/aus
export const settingsOpen: Writable<boolean> = writable(false);

// === Persistenz ===

let store: Awaited<ReturnType<typeof Store.load>> | null = null;

function migrateSoundRef(v: unknown): SoundRef {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function migrateVolumeDb(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export async function loadSettings(): Promise<void> {
  store = await Store.load(SETTINGS_FILE);
  const raw = await store.get<Partial<AppSettings>>(SETTINGS_KEY);
  if (raw) {
    const def = defaultSettings();
    const merged: AppSettings = {
      ...def,
      ...raw,
      // Maus-Objekt sauber mergen (sonst überschreibt ein altes Settings ohne
      // .mouse den ganzen Default mit undefined).
      mouse: raw.mouse
        ? {
            ...def.mouse,
            ...raw.mouse,
            buttons: Array.isArray(raw.mouse.buttons) && raw.mouse.buttons.length === 3
              ? raw.mouse.buttons.map((b, i) => ({
                  ...def.mouse.buttons[i],
                  ...b,
                  blockSoundPath: migrateSoundRef(b.blockSoundPath),
                  blockSoundVolumeDb: migrateVolumeDb(b.blockSoundVolumeDb),
                  unblockSoundPath: migrateSoundRef(b.unblockSoundPath),
                  unblockSoundVolumeDb: migrateVolumeDb(b.unblockSoundVolumeDb),
                }))
              : def.mouse.buttons,
            wheel: raw.mouse.wheel
              ? { ...def.mouse.wheel, ...raw.mouse.wheel }
              : def.mouse.wheel,
          }
        : def.mouse,
    } as AppSettings;
    merged.globalBlockSoundPath = migrateSoundRef(merged.globalBlockSoundPath);
    merged.globalBlockSoundVolumeDb = migrateVolumeDb(merged.globalBlockSoundVolumeDb);
    merged.globalUnblockSoundPath = migrateSoundRef(merged.globalUnblockSoundPath);
    merged.globalUnblockSoundVolumeDb = migrateVolumeDb(merged.globalUnblockSoundVolumeDb);
    if (!Array.isArray(merged.soundLibrary)) merged.soundLibrary = [];
    if (Array.isArray(merged.keys)) {
      merged.keys = merged.keys.map((k) => ({
        ...k,
        blockSoundPath: migrateSoundRef(k.blockSoundPath),
        blockSoundVolumeDb: migrateVolumeDb(k.blockSoundVolumeDb),
        unblockSoundPath: migrateSoundRef(k.unblockSoundPath),
        unblockSoundVolumeDb: migrateVolumeDb(k.unblockSoundVolumeDb),
      }));
    }
    settings.set(merged);
  }
}

export async function saveSettings(cfg: AppSettings): Promise<void> {
  if (!store) store = await Store.load(SETTINGS_FILE);
  await store.set(SETTINGS_KEY, cfg);
  await store.save();
  await invoke("apply_settings", {
    port: cfg.webhookPort,
    enabled: cfg.webhookEnabled,
    bindAll: cfg.webhookBindAllInterfaces,
  }).catch(console.error);
}

// === Webhook-Event-Binding ===

export type WebhookEvent =
  | { kind: "block"; keyId: string; durationSec: number }
  | { kind: "unblock"; keyId: string }
  | { kind: "reset" }
  | { kind: "status"; replyId: string };

export async function bindBackendEvents(handlers: {
  onBlock: (keyId: string, durationSec: number) => void;
  onUnblock: (keyId: string) => void;
  onReset: () => void;
  onStatusRequest: (replyId: string) => void;
}): Promise<void> {
  await listen<WebhookEvent>("webhook", (event) => {
    const p = event.payload;
    switch (p.kind) {
      case "block":
        handlers.onBlock(p.keyId, p.durationSec);
        break;
      case "unblock":
        handlers.onUnblock(p.keyId);
        break;
      case "reset":
        handlers.onReset();
        break;
      case "status":
        handlers.onStatusRequest(p.replyId);
        break;
    }
  });
}

// === Block-Logik ===

let lastSentKbSig = "";
let lastSentMouseSig = "";

// Flags an Backend pushen: separate Commands für Keyboard-VKs und Maus-Buttons.
// Maus-Wheel-Settings (click/scroll) sind im Mouse-Hook nötig, damit dort
// nur die richtigen Events geschluckt werden.
export async function syncBlockedKeysToBackend(): Promise<void> {
  const rt = get(keyRuntimes);
  const cfg = get(settings);
  const now = Date.now();

  // Keyboard
  const vks: number[] = [];
  for (const k of cfg.keys) {
    const r = rt[k.id];
    if (r && r.blockedUntilMs > now) vks.push(k.vk);
  }
  vks.sort((a, b) => a - b);
  const kbSig = vks.join(",");
  if (kbSig !== lastSentKbSig) {
    lastSentKbSig = kbSig;
    await invoke("set_blocked_keys", { vks }).catch(console.error);
  }

  // Maus — drei Flags, abgeleitet aus aktiv-blocked Mouse-Buttons.
  let blockLeft = false;
  let blockRight = false;
  let blockMiddle = false;
  let blockScroll = false;
  for (const b of cfg.mouse.buttons) {
    const r = rt[b.id];
    const active = !!r && r.blockedUntilMs > now;
    if (!active) continue;
    if (b.id === "LMB") blockLeft = true;
    else if (b.id === "RMB") blockRight = true;
    else if (b.id === "WHEEL") {
      if (cfg.mouse.wheel.click) blockMiddle = true;
      if (cfg.mouse.wheel.scroll) blockScroll = true;
    }
  }
  const mSig = `${+blockLeft}${+blockRight}${+blockMiddle}${+blockScroll}`;
  if (mSig !== lastSentMouseSig) {
    lastSentMouseSig = mSig;
    await invoke("set_blocked_mouse", {
      blockLeft,
      blockRight,
      blockMiddle,
      blockScroll,
    }).catch(console.error);
  }
}

export function applyBlock(keyId: string, durationSec: number): void {
  const cfg = get(settings);
  const def = findBlockable(cfg, keyId);
  if (!def) {
    console.warn(`[block] unbekannte id ${keyId} — ignoriert`);
    return;
  }
  const now = Date.now();
  const addMs = Math.max(0, durationSec) * 1000;
  const maxMs = Math.max(0, cfg.maxBlockSeconds) * 1000;

  keyRuntimes.update((rt) => {
    const existing = rt[def.id];
    const remaining = existing ? Math.max(0, existing.blockedUntilMs - now) : 0;
    let newUntil: number;
    switch (cfg.multiTriggerMode as MultiTriggerMode) {
      case "reset":
        newUntil = now + addMs;
        break;
      case "ignore":
        if (remaining > 0) return rt;
        newUntil = now + addMs;
        break;
      case "add":
      default: {
        const stacked = remaining + addMs;
        const capped = maxMs > 0 ? Math.min(stacked, maxMs) : stacked;
        newUntil = now + capped;
        break;
      }
    }
    return { ...rt, [def.id]: { id: def.id, blockedUntilMs: newUntil } };
  });

  playBlockSound(def);
  syncBlockedKeysToBackend();
}

export function applyUnblock(keyId: string): void {
  const cfg = get(settings);
  const def = findBlockable(cfg, keyId);
  if (!def) return;
  let wasActive = false;
  keyRuntimes.update((rt) => {
    const cur = rt[def.id];
    if (cur && cur.blockedUntilMs > Date.now()) wasActive = true;
    return { ...rt, [def.id]: { id: def.id, blockedUntilMs: 0 } };
  });
  if (wasActive) playUnblockSound(def);
  syncBlockedKeysToBackend();
}

export function applyReset(): void {
  keyRuntimes.set({});
  invoke("clear_blocked_keys").catch(console.error);
  invoke("set_blocked_mouse", {
    blockLeft: false,
    blockRight: false,
    blockMiddle: false,
    blockScroll: false,
  }).catch(console.error);
  lastSentKbSig = "";
  lastSentMouseSig = "";
}

let lastTickActive: Set<string> = new Set();

export function tickRuntimes(): void {
  const cfg = get(settings);
  const now = Date.now();
  const rt = get(keyRuntimes);
  const currentActive = new Set<string>();
  let mutated = false;
  const next: Record<string, KeyRuntime> = { ...rt };
  for (const def of allBlockables(cfg)) {
    const r = next[def.id];
    if (r && r.blockedUntilMs > now) {
      currentActive.add(def.id);
    } else if (r && r.blockedUntilMs > 0) {
      playUnblockSound(def);
      next[def.id] = { id: def.id, blockedUntilMs: 0 };
      mutated = true;
    }
  }
  if (mutated) keyRuntimes.set(next);
  if (
    mutated ||
    currentActive.size !== lastTickActive.size ||
    [...currentActive].some((id) => !lastTickActive.has(id))
  ) {
    lastTickActive = currentActive;
    syncBlockedKeysToBackend();
  }
}

// === Sound-Resolver ===

export function resolveBlockSound(
  cfg: AppSettings,
  ent: BlockableEntity,
): { url: string | null; volumeDb: number } {
  const perKey = resolveSoundUrl(cfg, ent.blockSoundPath);
  if (perKey) {
    return { url: perKey, volumeDb: cfg.volumeDb + ent.blockSoundVolumeDb };
  }
  const global = resolveSoundUrl(cfg, cfg.globalBlockSoundPath);
  if (global) {
    return { url: global, volumeDb: cfg.volumeDb + cfg.globalBlockSoundVolumeDb };
  }
  return { url: DEFAULT_BLOCK_SOUND_URL, volumeDb: cfg.volumeDb };
}

export function resolveUnblockSound(
  cfg: AppSettings,
  ent: BlockableEntity,
): { url: string | null; volumeDb: number } {
  const perKey = resolveSoundUrl(cfg, ent.unblockSoundPath);
  if (perKey) {
    return { url: perKey, volumeDb: cfg.volumeDb + ent.unblockSoundVolumeDb };
  }
  const global = resolveSoundUrl(cfg, cfg.globalUnblockSoundPath);
  if (global) {
    return { url: global, volumeDb: cfg.volumeDb + cfg.globalUnblockSoundVolumeDb };
  }
  return { url: DEFAULT_UNBLOCK_SOUND_URL, volumeDb: cfg.volumeDb };
}

function playBlockSound(ent: BlockableEntity) {
  const cfg = get(settings);
  const { url, volumeDb } = resolveBlockSound(cfg, ent);
  playPooled(url, volumeDb, "block");
}

function playUnblockSound(ent: BlockableEntity) {
  const cfg = get(settings);
  const { url, volumeDb } = resolveUnblockSound(cfg, ent);
  playPooled(url, volumeDb, "unblock");
}

export function buildStatus(anticheatRunning: boolean): {
  keys: Array<{ id: string; blocked: boolean; timeLeftSec: number }>;
  webhookPort: number;
  anticheatRunning: boolean;
} {
  const cfg = get(settings);
  const rt = get(keyRuntimes);
  const now = Date.now();
  return {
    keys: allBlockables(cfg).map((k) => {
      const r = rt[k.id];
      const ms = r ? Math.max(0, r.blockedUntilMs - now) : 0;
      return {
        id: k.id,
        blocked: ms > 0,
        timeLeftSec: ms / 1000,
      };
    }),
    webhookPort: cfg.webhookPort,
    anticheatRunning,
  };
}
