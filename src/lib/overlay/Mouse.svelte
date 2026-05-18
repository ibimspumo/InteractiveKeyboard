<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import type { AppSettings, KeyRuntime, MouseButtonDef, MouseDef } from "../types";
  import { resolveGiftIcon } from "../gift-icons";
  import { rgbaToCss } from "../defaults";

  // Maus-Overlay: rendert eine stilisierte Maus-Silhouette (SVG) und behandelt
  // drei Sub-Buttons (LMB, RMB, WHEEL). Jeder Sub-Button hat seinen eigenen
  // KeyRuntime-Eintrag (id = "LMB"/"RMB"/"WHEEL"). Die Geometrie ist
  // hart-kodiert in Maus-lokalen viewBox-Koordinaten — alle inneren Positionen
  // werden in Prozent zur Wrap-Größe ausgedrückt, damit Skalierung automatisch
  // funktioniert. Schriftgrößen multiplizieren explizit mit `scale`.

  export let cfg: AppSettings;
  export let runtimes: Record<string, KeyRuntime>;
  export let scale: number;
  export let editMode: boolean = false;
  export let designMode: boolean = false;
  export let giftEditable: boolean = false;

  // Lokales viewBox-Koordinatensystem.
  const VIEW_W = 300;
  const VIEW_H = 420;

  $: m = cfg.mouse as MouseDef;
  $: btnLMB = m.buttons.find((b) => b.id === "LMB")!;
  $: btnRMB = m.buttons.find((b) => b.id === "RMB")!;
  $: btnWHEEL = m.buttons.find((b) => b.id === "WHEEL")!;

  // Geometrie der Sub-Bereiche (lokal, viewBox). Wenn du die Maus-Form
  // änderst, hier zentral anpassen.
  const BODY_PATH =
    "M 60 4 C 25 4, 4 34, 4 110 L 4 290 C 4 380, 55 416, 150 416 C 245 416, 296 380, 296 290 L 296 110 C 296 34, 275 4, 240 4 Z";
  const DIVIDER = { x1: 150, y1: 4, x2: 150, y2: 200 };
  const HORIZ = { y: 200 };
  const WHEEL = { cx: 150, cy: 60, rx: 14, ry: 32 };
  const LMB_BBOX = { cx: 75, cy: 100 };
  const RMB_BBOX = { cx: 225, cy: 100 };
  const WHEEL_BBOX = { cx: WHEEL.cx, cy: WHEEL.cy };

  // Helper: viewBox-Coord → Prozent der Wrap-Größe (für Position).
  const pctX = (lx: number) => (lx / VIEW_W) * 100;
  const pctY = (ly: number) => (ly / VIEW_H) * 100;

  let now = Date.now();
  let nowTimer: ReturnType<typeof setInterval> | undefined;
  onMount(() => {
    nowTimer = setInterval(() => (now = Date.now()), 100);
  });
  onDestroy(() => {
    if (nowTimer) clearInterval(nowTimer);
  });

  function blockedOf(id: string): { active: boolean; sec: number } {
    const r = runtimes[id];
    if (r && r.blockedUntilMs > now) {
      return { active: true, sec: Math.max(0, (r.blockedUntilMs - now) / 1000) };
    }
    return { active: false, sec: 0 };
  }

  $: lmbState = blockedOf("LMB");
  $: rmbState = blockedOf("RMB");
  $: wheelState = blockedOf("WHEEL");

  function fmtTimer(s: number): string {
    if (s >= 60) {
      const mn = Math.floor(s / 60);
      const r = Math.ceil(s - mn * 60);
      return `${mn}:${String(r).padStart(2, "0")}`;
    }
    if (s >= 10) return `${Math.ceil(s)}`;
    return s.toFixed(1);
  }

  function giftUrl(b: MouseButtonDef): string | null {
    if (!b.giftIconPath) return null;
    if (b.giftIconPath.startsWith("gift:")) return resolveGiftIcon(b.giftIconPath);
    return convertFileSrc(b.giftIconPath);
  }

  // Style-Helpers
  $: bodyFill = rgbaToCss(m.bodyColor);
  $: bodyStroke = rgbaToCss(m.bodyBorderColor);
  $: dividerStroke = rgbaToCss(m.dividerColor);
  $: timerCss = rgbaToCss(cfg.timerColor);
  $: xCss = rgbaToCss(cfg.blockXColor);

  $: lmbFill = lmbState.active ? rgbaToCss(btnLMB.keyColorBlocked) : rgbaToCss(btnLMB.keyColor);
  $: rmbFill = rmbState.active ? rgbaToCss(btnRMB.keyColorBlocked) : rgbaToCss(btnRMB.keyColor);
  $: wheelFill = wheelState.active
    ? rgbaToCss(btnWHEEL.keyColorBlocked)
    : rgbaToCss(btnWHEEL.keyColor);

  $: lmbText = lmbState.active ? rgbaToCss(btnLMB.textColorBlocked) : rgbaToCss(btnLMB.textColor);
  $: rmbText = rmbState.active ? rgbaToCss(btnRMB.textColorBlocked) : rgbaToCss(btnRMB.textColor);
  $: wheelText = wheelState.active
    ? rgbaToCss(btnWHEEL.textColorBlocked)
    : rgbaToCss(btnWHEEL.textColor);

  // Mouse-Bbox in Screen-px (für absolute Positionierung der Gift-Divs außerhalb des Wraps).
  $: boxLeft = m.x * scale;
  $: boxTop = m.y * scale;
  $: boxW = m.width * scale;
  $: boxH = m.height * scale;

  // Gift-Center in Screen-px (zentriert relativ zur jeweiligen Button-Mitte + Offset).
  function giftCxScreen(b: MouseButtonDef, baseCxLocal: number): number {
    return boxLeft + ((baseCxLocal + b.giftOffsetX) / VIEW_W) * boxW;
  }
  function giftCyScreen(b: MouseButtonDef, baseCyLocal: number): number {
    return boxTop + ((baseCyLocal + b.giftOffsetY) / VIEW_H) * boxH;
  }
</script>

<div
  class="mouse-wrap"
  data-design-target={designMode || editMode ? "mouse" : null}
  data-tauri-drag-region={editMode || designMode ? null : true}
  style="
    left: {boxLeft}px;
    top: {boxTop}px;
    width: {boxW}px;
    height: {boxH}px;
    --x-color: {xCss};
  "
>
  <!-- SVG: Maus-Silhouette mit drei Regionen + Trennlinien -->
  <svg
    class="mouse-svg"
    viewBox="0 0 {VIEW_W} {VIEW_H}"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <clipPath id="mouse-clip">
        <path d={BODY_PATH} />
      </clipPath>
    </defs>

    <path
      d={BODY_PATH}
      fill={bodyFill}
      stroke={bodyStroke}
      stroke-width={m.bodyBorderWidth}
      stroke-linejoin="round"
    />

    <g clip-path="url(#mouse-clip)">
      <rect
        x="0"
        y="0"
        width={DIVIDER.x1}
        height={HORIZ.y}
        fill={lmbFill}
        opacity="0.97"
      />
      <rect
        x={DIVIDER.x1}
        y="0"
        width={VIEW_W - DIVIDER.x1}
        height={HORIZ.y}
        fill={rmbFill}
        opacity="0.97"
      />
      <rect
        x="0"
        y={HORIZ.y}
        width={VIEW_W}
        height={VIEW_H - HORIZ.y}
        fill={bodyFill}
      />
      <line
        x1="22"
        y1={HORIZ.y}
        x2={VIEW_W - 22}
        y2={HORIZ.y}
        stroke={dividerStroke}
        stroke-width={m.dividerWidth * 0.6}
        stroke-linecap="round"
        opacity="0.55"
      />
      <line
        x1={DIVIDER.x1}
        y1={DIVIDER.y1}
        x2={DIVIDER.x2}
        y2={DIVIDER.y2}
        stroke={dividerStroke}
        stroke-width={m.dividerWidth}
        stroke-linecap="round"
      />
    </g>

    <g>
      <ellipse
        cx={WHEEL.cx}
        cy={WHEEL.cy + 2}
        rx={WHEEL.rx + 1}
        ry={WHEEL.ry + 1}
        fill="rgba(0,0,0,0.55)"
      />
      <rect
        x={WHEEL.cx - WHEEL.rx}
        y={WHEEL.cy - WHEEL.ry}
        width={WHEEL.rx * 2}
        height={WHEEL.ry * 2}
        rx={WHEEL.rx}
        ry={WHEEL.rx}
        fill={wheelFill}
        stroke={bodyStroke}
        stroke-width={m.bodyBorderWidth * 0.5}
      />
      {#each [-12, -4, 4, 12] as oy}
        <line
          x1={WHEEL.cx - WHEEL.rx * 0.6}
          y1={WHEEL.cy + oy}
          x2={WHEEL.cx + WHEEL.rx * 0.6}
          y2={WHEEL.cy + oy}
          stroke={dividerStroke}
          stroke-width="1.5"
          opacity="0.7"
        />
      {/each}
    </g>

    <path
      d={BODY_PATH}
      fill="none"
      stroke={bodyStroke}
      stroke-width={m.bodyBorderWidth}
      stroke-linejoin="round"
    />
  </svg>

  <!-- Labels: prozent-positioniert relativ zum Wrap, font-size skaliert über `scale` -->
  <span
    class="btn-label"
    style="
      left: {pctX(LMB_BBOX.cx)}%;
      top: {pctY(LMB_BBOX.cy)}%;
      color: {lmbText};
      font-size: {btnLMB.fontSize * scale}px;
      font-weight: {btnLMB.fontWeight};
      letter-spacing: {btnLMB.letterSpacing * scale}px;
    "
  >{btnLMB.label}</span>

  <span
    class="btn-label"
    style="
      left: {pctX(RMB_BBOX.cx)}%;
      top: {pctY(RMB_BBOX.cy)}%;
      color: {rmbText};
      font-size: {btnRMB.fontSize * scale}px;
      font-weight: {btnRMB.fontWeight};
      letter-spacing: {btnRMB.letterSpacing * scale}px;
    "
  >{btnRMB.label}</span>

  {#if btnWHEEL.label}
    <span
      class="btn-label"
      style="
        left: {pctX(WHEEL_BBOX.cx)}%;
        top: {pctY(WHEEL_BBOX.cy + 50)}%;
        color: {wheelText};
        font-size: {btnWHEEL.fontSize * scale}px;
        font-weight: {btnWHEEL.fontWeight};
        letter-spacing: {btnWHEEL.letterSpacing * scale}px;
      "
    >{btnWHEEL.label}</span>
  {/if}

  <!-- Block-X-Overlays pro blockierter Region (prozent-positioniert) -->
  {#if lmbState.active && cfg.showBlockX}
    <svg
      class="block-x"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style="left: 8%; top: 6%; width: 36%; height: 38%;"
    >
      <line x1="14" y1="14" x2="86" y2="86" />
      <line x1="86" y1="14" x2="14" y2="86" />
    </svg>
  {/if}
  {#if rmbState.active && cfg.showBlockX}
    <svg
      class="block-x"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style="left: 56%; top: 6%; width: 36%; height: 38%;"
    >
      <line x1="14" y1="14" x2="86" y2="86" />
      <line x1="86" y1="14" x2="14" y2="86" />
    </svg>
  {/if}
  {#if wheelState.active && cfg.showBlockX}
    <svg
      class="block-x"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style="left: 41%; top: 5%; width: 18%; height: 18%;"
    >
      <line x1="14" y1="14" x2="86" y2="86" />
      <line x1="86" y1="14" x2="14" y2="86" />
    </svg>
  {/if}

  <!-- Timer pro blockierter Region (prozent-positioniert) -->
  {#if lmbState.active && cfg.showTimer}
    <span
      class="timer"
      style="
        left: {pctX(LMB_BBOX.cx)}%;
        top: calc({pctY(LMB_BBOX.cy)}% + {cfg.timerOffsetY * scale}px);
        color: {timerCss};
        font-size: {cfg.timerFontSize * scale}px;
        font-weight: {cfg.timerFontWeight};
      "
    >{fmtTimer(lmbState.sec)}s</span>
  {/if}
  {#if rmbState.active && cfg.showTimer}
    <span
      class="timer"
      style="
        left: {pctX(RMB_BBOX.cx)}%;
        top: calc({pctY(RMB_BBOX.cy)}% + {cfg.timerOffsetY * scale}px);
        color: {timerCss};
        font-size: {cfg.timerFontSize * scale}px;
        font-weight: {cfg.timerFontWeight};
      "
    >{fmtTimer(rmbState.sec)}s</span>
  {/if}
  {#if wheelState.active && cfg.showTimer}
    <span
      class="timer"
      style="
        left: {pctX(WHEEL_BBOX.cx)}%;
        top: calc({pctY(WHEEL_BBOX.cy + 120)}% + {cfg.timerOffsetY * scale}px);
        color: {timerCss};
        font-size: {cfg.timerFontSize * scale}px;
        font-weight: {cfg.timerFontWeight};
      "
    >{fmtTimer(wheelState.sec)}s</span>
  {/if}

  <!-- Design-/Edit-Hit-Zones (prozent-positioniert) -->
  <div
    class="hit"
    data-design-target={designMode || editMode ? "mouse.LMB" : null}
    data-tauri-drag-region={editMode || designMode ? null : true}
    style="left: 4%; top: 2%; width: 46%; height: 46%;"
  ></div>
  <div
    class="hit"
    data-design-target={designMode || editMode ? "mouse.RMB" : null}
    data-tauri-drag-region={editMode || designMode ? null : true}
    style="left: 50%; top: 2%; width: 46%; height: 46%;"
  ></div>
  <div
    class="hit"
    data-design-target={designMode || editMode ? "mouse.WHEEL" : null}
    data-tauri-drag-region={editMode || designMode ? null : true}
    style="
      left: {pctX(WHEEL.cx - WHEEL.rx - 4)}%;
      top: {pctY(WHEEL.cy - WHEEL.ry - 4)}%;
      width: {pctX(WHEEL.rx * 2 + 8)}%;
      height: {pctY(WHEEL.ry * 2 + 8)}%;
    "
  ></div>
</div>

<!-- Gift-Icons der drei Sub-Buttons (separates DOM-Element außerhalb des Wraps,
     damit Edit-Modus sie als eigene Drag-Targets ansprechen kann). -->
{#each [{ b: btnLMB, cx: LMB_BBOX.cx, cy: LMB_BBOX.cy }, { b: btnRMB, cx: RMB_BBOX.cx, cy: RMB_BBOX.cy }, { b: btnWHEEL, cx: WHEEL_BBOX.cx, cy: WHEEL_BBOX.cy }] as entry (entry.b.id)}
  {@const url = giftUrl(entry.b)}
  {#if url}
    {@const giftSize = 64 * entry.b.giftScale * scale}
    {@const cx = giftCxScreen(entry.b, entry.cx)}
    {@const cy = giftCyScreen(entry.b, entry.cy)}
    <div
      class="gift"
      class:editable={giftEditable}
      data-design-target={designMode || editMode ? `mouse.${entry.b.id}.gift` : null}
      data-tauri-drag-region={editMode || designMode ? null : true}
      style="
        left: {cx - giftSize / 2}px;
        top: {cy - giftSize / 2}px;
        width: {giftSize}px;
        height: {giftSize}px;
      "
    >
      <img src={url} alt="" draggable="false" />
    </div>
  {/if}
{/each}

<style>
  .mouse-wrap {
    position: absolute;
    pointer-events: none;
    overflow: visible;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35));
  }
  .mouse-svg {
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: auto;
  }
  .btn-label {
    position: absolute;
    transform: translate(-50%, -50%);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1;
    user-select: none;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    white-space: nowrap;
  }
  .block-x {
    position: absolute;
    pointer-events: none;
    z-index: 3;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }
  .block-x line {
    stroke: var(--x-color);
    stroke-width: 12;
    stroke-linecap: round;
  }
  .timer {
    position: absolute;
    transform: translate(-50%, -50%);
    font-family: ui-monospace, "JetBrains Mono", Consolas, monospace;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 12px rgba(0, 0, 0, 0.6);
    pointer-events: none;
    white-space: nowrap;
    z-index: 4;
  }
  .hit {
    position: absolute;
    pointer-events: none;
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
