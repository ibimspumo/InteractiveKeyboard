// Schemas für den Design-Modus: definieren, welche Felder pro Sub-Target
// im Style-Panel angezeigt werden. Field-Pfade sind Punkt-Notation am
// AppSettings-Objekt — get/setByPath traversieren.

import type { AppSettings, KeyDef, MouseButtonDef, RGBA } from "../types";

export type FieldDef =
  | {
      kind: "color";
      key: string;       // Pfad in AppSettings
      label: string;
      withAlpha?: boolean;
    }
  | {
      kind: "number";
      key: string;
      label: string;
      step?: number;
      suffix?: string;
      hint?: string;
    }
  | {
      kind: "toggle";
      key: string;
      label: string;
    }
  | {
      kind: "select";
      key: string;
      label: string;
      options: { value: string; label: string }[];
    }
  | {
      kind: "group";
      label: string;
    };

export interface DesignSchema {
  id: string;
  label: string;
  fields: FieldDef[];
}

function schemasForKey(key: KeyDef, index: number): Record<string, DesignSchema> {
  const path = (s: string) => `keys.${index}.${s}`;
  return {
    [`key.${key.id}`]: {
      id: `key.${key.id}`,
      label: `${key.label} — Taste`,
      fields: [
        { kind: "group", label: "Form" },
        { kind: "number", key: path("borderRadius"), label: "Border-Radius", step: 1, suffix: "px" },
        { kind: "group", label: "Farben (Normal)" },
        { kind: "color", key: path("keyColor"), label: "Hintergrund" },
        { kind: "color", key: path("textColor"), label: "Text" },
        { kind: "group", label: "Farben (Blockiert)" },
        { kind: "color", key: path("keyColorBlocked"), label: "Hintergrund (blockiert)" },
        { kind: "color", key: path("textColorBlocked"), label: "Text (blockiert)" },
        { kind: "group", label: "Typografie" },
        { kind: "number", key: path("fontSize"), label: "Schriftgröße", step: 1, suffix: "px" },
        { kind: "number", key: path("fontWeight"), label: "Schrift-Gewicht", step: 100 },
        { kind: "number", key: path("letterSpacing"), label: "Buchstaben-Abstand", step: 0.5, suffix: "px" },
      ],
    },
    [`key.${key.id}.gift`]: {
      id: `key.${key.id}.gift`,
      label: `${key.label} — Gift-Icon`,
      fields: [
        { kind: "number", key: path("giftScale"), label: "Skalierung", step: 0.05, hint: "1.0 = Originalgröße" },
        { kind: "number", key: path("giftOffsetX"), label: "Offset X", step: 1, suffix: "px", hint: "Relativ zur Tastenmitte" },
        { kind: "number", key: path("giftOffsetY"), label: "Offset Y", step: 1, suffix: "px" },
      ],
    },
  };
}

function schemasForMouse(): Record<string, DesignSchema> {
  const mouseFields: FieldDef[] = [
    { kind: "group", label: "Position & Größe" },
    { kind: "number", key: "mouse.x", label: "X (Ref-px)", step: 1, suffix: "px" },
    { kind: "number", key: "mouse.y", label: "Y (Ref-px)", step: 1, suffix: "px" },
    { kind: "number", key: "mouse.width", label: "Breite", step: 1, suffix: "px" },
    { kind: "number", key: "mouse.height", label: "Höhe", step: 1, suffix: "px" },
    { kind: "group", label: "Körper" },
    { kind: "color", key: "mouse.bodyColor", label: "Körper-Farbe" },
    { kind: "color", key: "mouse.bodyBorderColor", label: "Konturfarbe" },
    { kind: "number", key: "mouse.bodyBorderWidth", label: "Konturbreite", step: 0.5, suffix: "px" },
    { kind: "color", key: "mouse.dividerColor", label: "Trennlinie" },
    { kind: "number", key: "mouse.dividerWidth", label: "Trennlinien-Breite", step: 0.5, suffix: "px" },
  ];
  const schemas: Record<string, DesignSchema> = {
    mouse: {
      id: "mouse",
      label: "Maus — Körper",
      fields: mouseFields,
    },
  };
  // Pro Sub-Button (LMB/RMB/WHEEL) ein Schema für Stil + Gift-Offsets.
  // Pfad ist mouse.buttons.<index>.<feld>.
  const labels: Record<MouseButtonDef["id"], string> = {
    LMB: "Linksklick",
    RMB: "Rechtsklick",
    WHEEL: "Mausrad",
  };
  const order: MouseButtonDef["id"][] = ["LMB", "RMB", "WHEEL"];
  order.forEach((id, idx) => {
    const path = (s: string) => `mouse.buttons.${idx}.${s}`;
    schemas[`mouse.${id}`] = {
      id: `mouse.${id}`,
      label: `${labels[id]} — Button`,
      fields: [
        { kind: "group", label: "Farben (Normal)" },
        { kind: "color", key: path("keyColor"), label: "Hintergrund" },
        { kind: "color", key: path("textColor"), label: "Text" },
        { kind: "group", label: "Farben (Blockiert)" },
        { kind: "color", key: path("keyColorBlocked"), label: "Hintergrund (blockiert)" },
        { kind: "color", key: path("textColorBlocked"), label: "Text (blockiert)" },
        { kind: "group", label: "Typografie" },
        { kind: "number", key: path("fontSize"), label: "Schriftgröße", step: 1, suffix: "px" },
        { kind: "number", key: path("fontWeight"), label: "Schrift-Gewicht", step: 100 },
        { kind: "number", key: path("letterSpacing"), label: "Buchstaben-Abstand", step: 0.5, suffix: "px" },
      ],
    };
    schemas[`mouse.${id}.gift`] = {
      id: `mouse.${id}.gift`,
      label: `${labels[id]} — Gift-Icon`,
      fields: [
        { kind: "number", key: path("giftScale"), label: "Skalierung", step: 0.05, hint: "1.0 = Originalgröße" },
        { kind: "number", key: path("giftOffsetX"), label: "Offset X", step: 1, suffix: "px", hint: "Relativ zur Button-Mitte" },
        { kind: "number", key: path("giftOffsetY"), label: "Offset Y", step: 1, suffix: "px" },
      ],
    };
  });
  return schemas;
}

// Globale Schemas (gelten für alle Tasten gleich).
const GLOBAL_SCHEMAS: Record<string, DesignSchema> = {
  timer: {
    id: "timer",
    label: "Timer (global)",
    fields: [
      { kind: "color", key: "timerColor", label: "Farbe" },
      { kind: "number", key: "timerFontSize", label: "Schriftgröße", step: 1, suffix: "px" },
      { kind: "number", key: "timerFontWeight", label: "Schrift-Gewicht", step: 100 },
      {
        kind: "number",
        key: "timerOffsetY",
        label: "Vertikaler Offset",
        step: 1,
        suffix: "px",
        hint: "Relativ zur Tastenmitte. Negative Werte verschieben nach oben.",
      },
    ],
  },
};

// SCHEMAS-Map wird via rebuildSchemas() neu gefüllt, sobald sich die
// Tastenliste ändert. ESM live binding: Importeure sehen Updates.
export let SCHEMAS: Record<string, DesignSchema> = { ...GLOBAL_SCHEMAS };

export function rebuildSchemas(cfg: AppSettings): void {
  const next: Record<string, DesignSchema> = { ...GLOBAL_SCHEMAS };
  cfg.keys.forEach((k, i) => {
    Object.assign(next, schemasForKey(k, i));
  });
  Object.assign(next, schemasForMouse());
  SCHEMAS = next;
  void cfg.mouse;
}

// === Pfad-Helpers ===

export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const parts = path.split(".");
  function setRec(target: any, idx: number): any {
    const p = parts[idx];
    if (idx === parts.length - 1) {
      if (Array.isArray(target)) {
        const arr = target.slice();
        arr[Number(p)] = value;
        return arr;
      }
      return { ...target, [p]: value };
    }
    const child = target?.[p];
    const updated = setRec(child ?? {}, idx + 1);
    if (Array.isArray(target)) {
      const arr = target.slice();
      arr[Number(p)] = updated;
      return arr;
    }
    return { ...target, [p]: updated };
  }
  return setRec(obj, 0);
}

export function isRgba(v: unknown): v is RGBA {
  if (typeof v !== "object" || v == null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.r === "number" &&
    typeof o.g === "number" &&
    typeof o.b === "number" &&
    typeof o.a === "number"
  );
}
