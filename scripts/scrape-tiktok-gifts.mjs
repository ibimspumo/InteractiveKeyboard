// Scraper für TikTok-Gift-Bibliothek von streamtoearn.io.
//
// Lädt alle Gift-Einträge (Name, Coin-Wert, Bild-URL) von
// https://streamtoearn.io/gifts?region=DE und speichert:
//   - Bilder als src/assets/defaults/graphics/gifts/gift_<key>.webp
//   - Katalog als src/assets/defaults/graphics/gifts/catalog.json
//
// Lauf: `node scripts/scrape-tiktok-gifts.mjs`
// Idempotent: bereits vorhandene Dateien werden übersprungen.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const GIFTS_DIR = resolve(REPO, "src/assets/defaults/graphics/gifts");
const URL = "https://streamtoearn.io/gifts?region=DE";

mkdirSync(GIFTS_DIR, { recursive: true });

// Slug: alt-Text → Datei-key. Unicode-tolerant, kollisionsfrei via Index.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&#39;/g, "")
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "gift";
}

async function fetchHtml() {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 RunMMO-scraper" },
  });
  if (!res.ok) throw new Error(`fetch ${URL}: ${res.status}`);
  return await res.text();
}

// Eintrag-Regex: <div class="gift"> ... <img src="..." alt="..."> ...
// <p class="gift-name">...</p> ... <p class="gift-price">N <img ...
function parseEntries(html) {
  // Match jedes gift-Blocks bis zum nächsten gift-Block oder Ende. Greedy
  // ungeeignet — nutzen wir gift-price als Anker.
  const re =
    /<div class="gift">\s*<img\s+src="([^"]+)"\s+alt="([^"]+)"[^>]*>\s*<p class="gift-name">([^<]+)<\/p>\s*<p class="gift-price">\s*([0-9,]+)\s*</g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, imgUrl, altRaw, nameRaw, coinsRaw] = m;
    const decode = (s) =>
      s
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    out.push({
      name: decode(nameRaw.trim()),
      alt: decode(altRaw.trim()),
      coins: parseInt(coinsRaw.replace(/,/g, ""), 10),
      imgUrl,
    });
  }
  return out;
}

// Eindeutige Keys per Slug + Suffix bei Kollision.
function assignKeys(entries) {
  const used = new Map();
  return entries.map((e) => {
    let base = slugify(e.name);
    let key = base;
    let n = used.get(base) ?? 0;
    while (used.has(key)) {
      n += 1;
      key = `${base}_${n}`;
    }
    used.set(base, n);
    used.set(key, 0);
    return { ...e, key };
  });
}

async function downloadAll(entries) {
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const e of entries) {
    const file = resolve(GIFTS_DIR, `gift_${e.key}.webp`);
    if (existsSync(file)) {
      skipped += 1;
      continue;
    }
    try {
      const r = await fetch(e.imgUrl, {
        headers: { "User-Agent": "Mozilla/5.0 RunMMO-scraper" },
      });
      if (!r.ok) {
        console.warn(`  ! ${e.key}: HTTP ${r.status}`);
        failed += 1;
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(file, buf);
      downloaded += 1;
      if (downloaded % 20 === 0) {
        console.log(`  ${downloaded} heruntergeladen ...`);
      }
    } catch (err) {
      console.warn(`  ! ${e.key}: ${err.message}`);
      failed += 1;
    }
  }
  return { downloaded, skipped, failed };
}

async function main() {
  console.log("Lade HTML von", URL);
  const html = await fetchHtml();
  console.log("  HTML:", html.length, "Bytes");

  const raw = parseEntries(html);
  console.log("  Geparste Einträge:", raw.length);

  if (raw.length === 0) {
    console.error("Keine Einträge gefunden — Seitenstruktur evtl. geändert.");
    process.exit(1);
  }

  const entries = assignKeys(raw);
  console.log("Downloade", entries.length, "WebP-Dateien nach", GIFTS_DIR);
  const stats = await downloadAll(entries);
  console.log(
    `Fertig: ${stats.downloaded} neu, ${stats.skipped} übersprungen, ${stats.failed} fehlgeschlagen`,
  );

  // Katalog speichern (sortiert nach Coins aufsteigend, dann Name).
  const catalog = entries
    .map(({ key, name, coins }) => ({ key, name, coins }))
    .sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));
  writeFileSync(
    resolve(GIFTS_DIR, "catalog.json"),
    JSON.stringify(catalog, null, 2),
  );
  console.log("Katalog geschrieben: catalog.json (", catalog.length, "Einträge )");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
