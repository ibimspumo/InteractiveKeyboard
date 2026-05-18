// TikTok-Gift-Bibliothek. Bilder + Katalog wurden per
// `scripts/scrape-tiktok-gifts.mjs` von streamtoearn.io heruntergeladen.
//
// Bilder: src/assets/defaults/graphics/gifts/gift_<key>.webp
// Katalog: src/assets/defaults/graphics/gifts/catalog.json
//   (Liste von { key, name, coins }, sortiert nach Coins aufsteigend)
//
// Resolver-Format: "gift:<key>" als iconPath am Skill.

import catalogJson from "../assets/defaults/graphics/gifts/catalog.json";

const giftModules = import.meta.glob(
  "../assets/defaults/graphics/gifts/gift_*.webp",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

export const GIFT_ICON_URLS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [p, url] of Object.entries(giftModules)) {
    const m = p.match(/gift_([^/]+)\.webp$/);
    if (!m) continue;
    out[m[1]] = url;
  }
  return out;
})();

export interface GiftEntry {
  key: string;
  name: string;
  coins: number;
}

// Nur Einträge mit existierendem Bild. Schützt vor Katalog/Asset-Drift.
export const GIFT_CATALOG: GiftEntry[] = (catalogJson as GiftEntry[]).filter(
  (e) => GIFT_ICON_URLS[e.key],
);

// Coin-Buckets zum Filtern in der UI.
export const GIFT_COIN_BUCKETS: { id: string; label: string; test: (c: number) => boolean }[] = [
  { id: "all", label: "Alle", test: () => true },
  { id: "1-9", label: "1–9", test: (c) => c >= 1 && c <= 9 },
  { id: "10-99", label: "10–99", test: (c) => c >= 10 && c <= 99 },
  { id: "100-999", label: "100–999", test: (c) => c >= 100 && c <= 999 },
  { id: "1000+", label: "1000+", test: (c) => c >= 1000 },
];

export function findGiftEntry(key: string): GiftEntry | null {
  return GIFT_CATALOG.find((e) => e.key === key) ?? null;
}

// Resolver: "gift:<key>" → URL aus Glob, sonst null.
export function resolveGiftIcon(iconPath: string): string | null {
  if (!iconPath.startsWith("gift:")) return null;
  const key = iconPath.slice("gift:".length);
  return GIFT_ICON_URLS[key] ?? null;
}
