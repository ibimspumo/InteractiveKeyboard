<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import type { KeyDef, KeyRuntime, AppSettings } from "../types";
  import { resolveGiftIcon } from "../gift-icons";
  import { rgbaToCss } from "../defaults";

  // Eine einzelne Taste im Overlay. Rendert:
  //  - Tasten-Box (Hintergrund + Border-Radius + zentriertes Label)
  //  - Gift-Icon (mit eigenem Offset relativ zur Tasten-Mitte)
  //  - Bei blockiert: rotes X-Overlay + Timer-Restzeit
  //
  // `editMode` und `designMode` werden für Hit-Region/Drag-Regeln benötigt:
  //  - Im Edit/Design-Modus DARF die Taste nicht das Fenster ziehen
  //    (data-tauri-drag-region={null}).
  //  - Im Normalmodus zieht ein Drag das ganze Fenster.

  export let def: KeyDef;
  export let runtime: KeyRuntime | undefined;
  export let cfg: AppSettings;
  export let scale: number;                  // window-px-pro-ref-px
  export let editMode: boolean = false;
  export let designMode: boolean = false;
  // Für Edit-Modus: das Gift-Icon als separates Target anbieten (eigener Move).
  export let giftEditable: boolean = false;

  let outer: HTMLElement | undefined;
  export function getElement(): HTMLElement | undefined {
    return outer;
  }
  let giftEl: HTMLElement | undefined;
  export function getGiftElement(): HTMLElement | undefined {
    return giftEl;
  }

  const TICK_MS = 100;
  let now = Date.now();
  // Re-rendern alle 100ms damit Timer flüssig läuft (sonst nur bei store-update).
  let timer: ReturnType<typeof setInterval> | undefined;
  import { onMount, onDestroy } from "svelte";
  onMount(() => {
    timer = setInterval(() => (now = Date.now()), TICK_MS);
  });
  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  $: blocked =
    !!runtime && runtime.blockedUntilMs > now;
  $: remainingSec = blocked ? Math.max(0, (runtime!.blockedUntilMs - now) / 1000) : 0;

  $: keyBg = blocked ? rgbaToCss(def.keyColorBlocked) : rgbaToCss(def.keyColor);
  $: keyTextColor = blocked ? rgbaToCss(def.textColorBlocked) : rgbaToCss(def.textColor);
  $: timerCss = rgbaToCss(cfg.timerColor);
  $: xCss = rgbaToCss(cfg.blockXColor);

  $: giftUrl = (() => {
    if (!def.giftIconPath) return null;
    if (def.giftIconPath.startsWith("gift:")) return resolveGiftIcon(def.giftIconPath);
    return convertFileSrc(def.giftIconPath);
  })();

  function fmtTimer(s: number): string {
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const r = Math.ceil(s - m * 60);
      return `${m}:${String(r).padStart(2, "0")}`;
    }
    if (s >= 10) return `${Math.ceil(s)}`;
    return s.toFixed(1);
  }
</script>

<!-- Outer Wrapper: Position in Screen-px (scale * Ref-px) -->
<div
  bind:this={outer}
  class="key-wrap"
  class:blocked
  data-design-target={designMode || editMode ? `key.${def.id}` : null}
  data-tauri-drag-region={editMode || designMode ? null : true}
  style="
    left: {def.x * scale}px;
    top: {def.y * scale}px;
    width: {def.width * scale}px;
    height: {def.height * scale}px;
    --key-bg: {keyBg};
    --key-fg: {keyTextColor};
    --radius: {def.borderRadius * scale}px;
    --fs: {def.fontSize * scale}px;
    --fw: {def.fontWeight};
    --ls: {def.letterSpacing * scale}px;
  "
>
  <span class="label">{def.label}</span>

  {#if blocked && cfg.showBlockX}
    <svg
      class="block-x"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style="--x-color: {xCss};"
      aria-hidden="true"
    >
      <line x1="14" y1="14" x2="86" y2="86" />
      <line x1="86" y1="14" x2="14" y2="86" />
    </svg>
  {/if}

  {#if blocked && cfg.showTimer}
    <!-- Timer ist zentriert auf der Tastenmitte (über dem X) und wird im
         Design-Modus global angepasst — alle Tasten teilen sich das gleiche
         "timer"-Schema, Klicken auf irgendeinen Timer öffnet das Panel. -->
    <span
      class="timer-outer"
      style="
        transform: translate(-50%, calc(-50% + {cfg.timerOffsetY * scale}px));
      "
    >
      <span
        class="timer"
        data-design-target={designMode ? "timer" : null}
        style="
          color: {timerCss};
          font-size: {cfg.timerFontSize * scale}px;
          font-weight: {cfg.timerFontWeight};
        "
      >
        {fmtTimer(remainingSec)}s
      </span>
    </span>
  {/if}
</div>

<!-- Gift-Icon: separat positioniert (Tastenmitte + Offset), eigenes DOM
     damit der Edit-Modus es als eigenes Drag-Target ansprechen kann. -->
{#if giftUrl}
  {@const giftSize = 64 * def.giftScale * scale}
  {@const cx = (def.x + def.width / 2 + def.giftOffsetX) * scale}
  {@const cy = (def.y + def.height / 2 + def.giftOffsetY) * scale}
  <div
    bind:this={giftEl}
    class="gift"
    class:editable={giftEditable}
    data-design-target={designMode || editMode ? `key.${def.id}.gift` : null}
    data-tauri-drag-region={editMode || designMode ? null : true}
    style="
      left: {cx - giftSize / 2}px;
      top: {cy - giftSize / 2}px;
      width: {giftSize}px;
      height: {giftSize}px;
    "
  >
    <img src={giftUrl} alt="" draggable="false" />
  </div>
{/if}

<style>
  .key-wrap {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--key-bg);
    border-radius: var(--radius);
    color: var(--key-fg);
    transition: background 180ms, color 180ms;
    overflow: visible;
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.25);
  }
  .label {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: var(--fs);
    font-weight: var(--fw);
    letter-spacing: var(--ls);
    line-height: 1;
    user-select: none;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  .block-x {
    position: absolute;
    inset: 14%;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }
  .block-x line {
    stroke: var(--x-color);
    stroke-width: 12;
    stroke-linecap: round;
  }
  /* Outer-Wrapper für die absolut zentrierte Position. Inner-Span hält die
     eigentliche Schrift — wichtig damit das Design-Mode-Hit-Target die
     Text-Bbox bekommt und nicht die Tastengröße (sonst überdeckt der
     unsichtbare Wrap das ganze X). */
  .timer-outer {
    position: absolute;
    left: 50%;
    top: 50%;
    transform-origin: 0 0;
    pointer-events: none;
    z-index: 3;
  }
  .timer {
    display: inline-block;
    font-family: ui-monospace, "JetBrains Mono", Consolas, monospace;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 12px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    white-space: nowrap;
  }
  .gift {
    position: absolute;
    pointer-events: none;
    z-index: 2;
    transition: filter 120ms;
  }
  .gift.editable {
    pointer-events: auto;
  }
  .gift img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55));
  }
</style>
