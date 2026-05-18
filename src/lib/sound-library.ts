// Globale Sound-Bibliothek. Analog zu gift-icons.ts, aber mit User-Uploads
// statt gebündelter Assets — die Liste lebt in cfg.soundLibrary und wird
// vom Audio-Tab gepflegt.
//
// Verweise-Format ("SoundRef"):
//   - null            → kein Sound
//   - "sound:<id>"    → Eintrag in der Bibliothek (Standard)
//   - sonstiger String → roher User-Pfad (legacy aus älteren Configs)

import { convertFileSrc } from "@tauri-apps/api/core";
import type { AppSettings, SoundEntry, SoundRef } from "./types";

export const SOUND_PREFIX = "sound:";

export function isLibraryRef(ref: SoundRef): boolean {
  return typeof ref === "string" && ref.startsWith(SOUND_PREFIX);
}

export function libraryIdOf(ref: SoundRef): string | null {
  if (!ref || !isLibraryRef(ref)) return null;
  return ref.slice(SOUND_PREFIX.length);
}

export function findSoundEntry(
  cfg: AppSettings,
  ref: SoundRef,
): SoundEntry | null {
  const id = libraryIdOf(ref);
  if (!id) return null;
  return cfg.soundLibrary.find((e) => e.id === id) ?? null;
}

// Liefert die abspielbare URL für einen SoundRef:
//   - null → null
//   - "sound:<id>" → convertFileSrc(entry.path), oder null wenn Eintrag fehlt
//   - sonst → convertFileSrc(ref)
export function resolveSoundUrl(
  cfg: AppSettings,
  ref: SoundRef,
): string | null {
  if (!ref) return null;
  if (isLibraryRef(ref)) {
    const entry = findSoundEntry(cfg, ref);
    return entry ? convertFileSrc(entry.path) : null;
  }
  return convertFileSrc(ref);
}

// Anzeigename für die Picker-Buttons.
export function displayNameForSoundRef(
  cfg: AppSettings,
  ref: SoundRef,
  fallback = "Kein Sound",
): string {
  if (!ref) return fallback;
  const entry = findSoundEntry(cfg, ref);
  if (entry) return entry.name;
  if (isLibraryRef(ref)) {
    return "⚠ Sound nicht in Bibliothek";
  }
  const parts = ref.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || ref;
}

export function defaultNameForPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const file = parts[parts.length - 1] || path;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}

export function newSoundId(): string {
  return (
    "snd_" +
    Date.now().toString(36) +
    "_" +
    Math.floor(Math.random() * 1e6).toString(36)
  );
}

// Prüft, ob ein SoundRef noch verwendet wird (für die Löschen-Warnung).
// Scannt alle Stellen, die Sound-Verweise halten.
export function countSoundRefs(cfg: AppSettings, soundId: string): number {
  const target = SOUND_PREFIX + soundId;
  let n = 0;
  const test = (r: SoundRef) => {
    if (r === target) n++;
  };
  test(cfg.globalBlockSoundPath);
  test(cfg.globalUnblockSoundPath);
  for (const k of cfg.keys) {
    test(k.blockSoundPath);
    test(k.unblockSoundPath);
  }
  return n;
}
