<script lang="ts">
  // Floatendes Style-Panel im Design-Modus. Frei verschiebbar (Header-Drag),
  // rendert die FieldDefs eines Schemas und schreibt direkt in den Settings-Store.

  import { createEventDispatcher, onMount } from "svelte";
  import type { AppSettings } from "../types";
  import { settings } from "../stores";
  import { type DesignSchema, getByPath, isRgba, setByPath } from "./schemas";
  import ColorRow from "./fields/ColorRow.svelte";
  import NumberRow from "./fields/NumberRow.svelte";
  import ToggleRow from "./fields/ToggleRow.svelte";
  import SelectRow from "./fields/SelectRow.svelte";

  export let schema: DesignSchema;
  export let cfg: AppSettings;
  // Initiale Position (Screen-px). Wird vom Caller anhand der Target-Bbox gesetzt.
  export let initialX: number = 80;
  export let initialY: number = 80;

  const dispatch = createEventDispatcher<{ close: void }>();

  let x = initialX;
  let y = initialY;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanelX = 0;
  let dragStartPanelY = 0;

  function onHeaderDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanelX = x;
    dragStartPanelY = y;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onHeaderMove(e: PointerEvent) {
    if (!dragging) return;
    x = dragStartPanelX + (e.clientX - dragStartX);
    y = dragStartPanelY + (e.clientY - dragStartY);
    clampToViewport();
  }
  function onHeaderUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  let panelEl: HTMLDivElement;
  function clampToViewport() {
    if (!panelEl) return;
    const r = panelEl.getBoundingClientRect();
    const margin = 4;
    const maxX = window.innerWidth - r.width - margin;
    const maxY = window.innerHeight - r.height - margin;
    if (x > maxX) x = Math.max(margin, maxX);
    if (y > maxY) y = Math.max(margin, maxY);
    if (x < margin) x = margin;
    if (y < margin) y = margin;
  }
  onMount(() => {
    clampToViewport();
  });

  function setPath(path: string, value: unknown) {
    settings.update((s) => setByPath(s, path, value));
  }
</script>

<div
  class="panel"
  bind:this={panelEl}
  style="left: {x}px; top: {y}px;"
  on:pointerdown|stopPropagation
>
  <div
    class="header"
    on:pointerdown={onHeaderDown}
    on:pointermove={onHeaderMove}
    on:pointerup={onHeaderUp}
    on:pointercancel={onHeaderUp}
  >
    <span class="title">{schema.label}</span>
    <button
      type="button"
      class="close"
      on:pointerdown|stopPropagation
      on:click|stopPropagation={() => dispatch("close")}
      title="Schließen"
    >
      ×
    </button>
  </div>

  <div class="body">
    {#each schema.fields as f, i (f.kind === "group" ? `g${i}` : f.key)}
      {#if f.kind === "color"}
        {@const cv = getByPath(cfg, f.key)}
        {#if isRgba(cv)}
          <ColorRow
            label={f.label}
            value={cv}
            withAlpha={f.withAlpha !== false}
            onChange={(next) => setPath(f.key, next)}
          />
        {/if}
      {:else if f.kind === "number"}
        {@const nv = getByPath(cfg, f.key)}
        <NumberRow
          label={f.label}
          value={typeof nv === "number" ? nv : 0}
          step={f.step ?? 1}
          suffix={f.suffix ?? ""}
          hint={f.hint ?? ""}
          onChange={(next) => setPath(f.key, next)}
        />
      {:else if f.kind === "toggle"}
        {@const bv = getByPath(cfg, f.key)}
        <ToggleRow
          label={f.label}
          value={!!bv}
          onChange={(next) => setPath(f.key, next)}
        />
      {:else if f.kind === "select"}
        {@const sv = getByPath(cfg, f.key)}
        <SelectRow
          label={f.label}
          value={typeof sv === "string" ? sv : f.options[0]?.value ?? ""}
          options={f.options}
          onChange={(next) => setPath(f.key, next)}
        />
      {:else if f.kind === "group"}
        <div class="group-divider">{f.label}</div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .panel {
    position: fixed;
    width: 280px;
    background: rgba(15, 23, 42, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: white;
    font-family: var(--font-ui, system-ui, sans-serif);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    z-index: 60;
    backdrop-filter: blur(8px);
    user-select: none;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    cursor: grab;
    touch-action: none;
  }
  .header:active {
    cursor: grabbing;
  }
  .title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    color: #cbd5e1;
  }
  .close {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 4px;
  }
  .close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  .body {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 60vh;
    overflow-y: auto;
  }
  .group-divider {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
    font-weight: 600;
  }
  .group-divider:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
</style>
