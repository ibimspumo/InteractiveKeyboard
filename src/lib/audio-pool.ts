/* Zentraler Audio-Pool für Block/Unblock-Sounds.
 *
 * Ziele:
 *  - Burst-fest: bei vielen gleichzeitigen /block-Requests soll der Browser
 *    nicht ersticken (jedes `new Audio()` ist teuer).
 *  - Pro Kategorie eine harte Obergrenze; bei Überlauf wird die älteste
 *    Stimme gekillt, damit Feedback nie komplett verschluckt wird.
 *  - Web Audio API mit einmal dekodierten Buffern statt N HTMLAudioElement.
 *  - HTMLAudio-Fallback, falls eine URL nicht via fetch/decode geht.
 */

export type AudioCategory = "block" | "unblock";

const MAX_VOICES: Record<AudioCategory, number> = {
  block: 12,
  unblock: 12,
};

let ctx: AudioContext | null = null;
let ctxFailed = false;

function getCtx(): AudioContext | null {
  if (ctx || ctxFailed) return ctx;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) {
      ctxFailed = true;
      return null;
    }
    ctx = new Ctor();
  } catch {
    ctxFailed = true;
  }
  return ctx;
}

const bufferCache = new Map<string, Promise<AudioBuffer | null>>();

function loadBuffer(url: string): Promise<AudioBuffer | null> {
  let p = bufferCache.get(url);
  if (p) return p;
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((arr) => c.decodeAudioData(arr.slice(0)))
    .catch((err) => {
      console.warn("audio decode failed for", url, err);
      return null as AudioBuffer | null;
    });
  bufferCache.set(url, p);
  return p;
}

type Voice = { src: AudioBufferSourceNode; gain: GainNode };
const voices: Record<AudioCategory, Voice[]> = {
  block: [],
  unblock: [],
};

const htmlPool: Record<AudioCategory, HTMLAudioElement[]> = {
  block: [],
  unblock: [],
};

function dbToLinear(db: number): number {
  return Math.max(0, Math.min(1, Math.pow(10, db / 20)));
}

function killOldest(cat: AudioCategory) {
  const v = voices[cat].shift();
  if (!v) return;
  try {
    v.src.stop();
  } catch {
    /* schon zu Ende */
  }
}

function playViaWebAudio(
  c: AudioContext,
  buf: AudioBuffer,
  cat: AudioCategory,
  volume: number,
): boolean {
  if (voices[cat].length >= MAX_VOICES[cat]) killOldest(cat);
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(c.destination);
    const voice: Voice = { src, gain };
    voices[cat].push(voice);
    src.onended = () => {
      const idx = voices[cat].indexOf(voice);
      if (idx >= 0) voices[cat].splice(idx, 1);
    };
    src.start();
    return true;
  } catch (err) {
    console.warn("webaudio play failed", err);
    return false;
  }
}

function playViaHtml(url: string, cat: AudioCategory, volume: number) {
  const pool = htmlPool[cat];
  let el: HTMLAudioElement | null = null;
  for (const candidate of pool) {
    if (candidate.paused || candidate.ended) {
      el = candidate;
      break;
    }
  }
  if (!el) {
    if (pool.length >= MAX_VOICES[cat]) {
      el = pool.shift()!;
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    } else {
      el = new Audio();
    }
    pool.push(el);
  }
  el.src = url;
  el.volume = volume;
  el.currentTime = 0;
  el.play().catch((err) => console.warn("html audio failed", err));
}

export function playPooled(
  url: string | null | undefined,
  volumeDb: number,
  cat: AudioCategory,
): void {
  if (!url) return;
  const volume = dbToLinear(volumeDb);
  const c = getCtx();
  if (!c) {
    playViaHtml(url, cat, volume);
    return;
  }
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  loadBuffer(url).then((buf) => {
    if (!buf) {
      playViaHtml(url, cat, volume);
      return;
    }
    const ok = playViaWebAudio(c, buf, cat, volume);
    if (!ok) playViaHtml(url, cat, volume);
  });
}

export function primeAudioContext(): void {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}
