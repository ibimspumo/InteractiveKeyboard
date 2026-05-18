// One-shot App-Icon-Generator via OpenRouter (Gemini 2.5 Flash Image / Nano Banana
// / gpt-5-image — was OpenRouter gerade als IMAGE_MODEL anbietet).
//
// Nutzung: node scripts/generate-app-icon.mjs
// Speichert das rohe 1024×1024 PNG in icon_gen.png.
//
// Erfordert OPENROUTER_API_KEY in der Umgebung oder in .env.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error("ERROR: OPENROUTER_API_KEY nicht gesetzt (weder in .env noch in env).");
  process.exit(1);
}

const PROMPT = `A modern, playful app icon for a Windows desktop tool called "Interactive Keyboard".
Subject: A stylized 3D keyboard with four keys arranged in the WASD cross-pattern (W on top, A/S/D below), plus a wide space bar at the bottom. The "S" key is highlighted with a glowing red "X" overlay (it is "blocked"). Above the W key floats a small colorful TikTok gift icon — a glossy rose with a soft glow — implying viewer-controlled gameplay.
Style: Cute, glossy 3D render in the style of modern productivity app icons (Notion, Linear, Raycast). Bold rim lighting, soft shadows, subtle gradient background that fades from deep purple to charcoal black. Highly readable at 32×32 pixels.
Composition: Square (1:1), centered, keyboard fills ~70% of the frame, gentle isometric perspective from slightly above. No text, no logo, no UI chrome. Clean silhouette on a solid (non-transparent) background.
Output: 1024x1024, vibrant colors, crisp edges, professional polish.`;

const outputPath = path.join(ROOT, "icon_gen.png");
console.log(`Generiere App-Icon → ${outputPath}`);

const body = {
  model: process.env.IMAGE_MODEL || "openai/gpt-5-image",
  messages: [
    {
      role: "user",
      content: PROMPT,
    },
  ],
  modalities: ["image", "text"],
};

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/ibimspumo/InteractiveKeyboard",
    "X-Title": "Interactive Keyboard Icon Gen",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`OpenRouter-Fehler ${res.status}: ${text}`);
  process.exit(1);
}

const data = await res.json();
const msg = data?.choices?.[0]?.message;
const images = msg?.images;
if (!images || images.length === 0) {
  console.error("Keine Bilder in der Antwort.");
  console.error("Antwort:", JSON.stringify(data, null, 2).slice(0, 2000));
  process.exit(1);
}

const imageUrl = images[0]?.image_url?.url || images[0]?.url;
if (!imageUrl) {
  console.error("Bild-URL nicht im erwarteten Format.");
  process.exit(1);
}

const m = imageUrl.match(/^data:(image\/[\w+-]+);base64,(.+)$/);
let buf;
if (m) {
  buf = Buffer.from(m[2], "base64");
} else {
  const r = await fetch(imageUrl);
  if (!r.ok) {
    console.error(`Image fetch fehlgeschlagen: ${r.status}`);
    process.exit(1);
  }
  buf = Buffer.from(await r.arrayBuffer());
}

fs.writeFileSync(outputPath, buf);
console.log(`✓ Gespeichert: ${outputPath} (${(buf.length / 1024).toFixed(1)} KB)`);
console.log(`Nächster Schritt: npx tauri icon icon_gen.png  → generiert src-tauri/icons/* in allen Größen`);
