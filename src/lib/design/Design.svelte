<script lang="ts">
  // Design-Modus: Overlay-Layer, das alle DOM-Nodes mit data-design-target im
  // Document einsammelt, Hover-Outlines rendert und beim Klick ein
  // DesignPanel öffnet. Analog zum Edit-Modus, aber ohne Drag/Resize —
  // hier geht's ausschließlich um Style-Eigenschaften.

  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import type { AppSettings } from "../types";
  import { SCHEMAS, type DesignSchema } from "./schemas";
  import DesignPanel from "./DesignPanel.svelte";

  export let cfg: AppSettings;

  const dispatch = createEventDispatcher<{ done: void }>();

  type Rect = { left: number; top: number; width: number; height: number };
  // key = eindeutige Identität pro DOM-Node; id = Schema-ID (kann mehrfach
  // vorkommen, wenn dasselbe Schema mehrere klickbare Bereiche im Overlay hat).
  type Target = { key: string; id: string; label: string; el: HTMLElement; rect: Rect };

  let targets: Target[] = [];
  let hoverId: string | null = null;
  let selectedId: string | null = null;
  let panelPos = { x: 0, y: 0 };

  function rectOf(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // DOM scannen + Bbox messen. Wird per RAF wiederholt (Overlay-Elemente
  // animieren teilweise, z.B. HP-Balken Width).
  function rescan() {
    const nodes = document.querySelectorAll<HTMLElement>("[data-design-target]");
    const next: Target[] = [];
    const seenPerId: Record<string, number> = {};
    for (const el of Array.from(nodes)) {
      const id = el.dataset.designTarget;
      if (!id) continue;
      const schema = SCHEMAS[id];
      if (!schema) continue;
      const n = (seenPerId[id] = (seenPerId[id] ?? 0) + 1);
      const key = `${id}#${n}`;
      next.push({ key, id, label: schema.label, el, rect: rectOf(el) });
    }
    targets = next;
  }

  let rafHandle: number | null = null;
  function loop() {
    rescan();
    rafHandle = requestAnimationFrame(loop);
  }

  onMount(async () => {
    await tick();
    rescan();
    rafHandle = requestAnimationFrame(loop);
  });
  onDestroy(() => {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  });

  function selectTarget(id: string, rect: Rect) {
    selectedId = id;
    // Panel rechts vom Target platzieren, falls Platz; sonst links.
    const PANEL_W = 280;
    const margin = 12;
    let x = rect.left + rect.width + margin;
    if (x + PANEL_W > window.innerWidth - margin) {
      x = Math.max(margin, rect.left - PANEL_W - margin);
    }
    let y = Math.max(margin, rect.top);
    panelPos = { x, y };
  }

  function onBackdropDown(e: PointerEvent) {
    if (e.target === e.currentTarget) {
      selectedId = null;
    }
  }

  function done() {
    dispatch("done");
  }

  $: selectedSchema = selectedId ? (SCHEMAS[selectedId] as DesignSchema | undefined) : undefined;
</script>

<div class="design-root" on:pointerdown={onBackdropDown}>
  {#each targets as t (t.key)}
    <button
      type="button"
      class="hitzone"
      class:selected={selectedId === t.id}
      class:hovered={hoverId === t.id && selectedId !== t.id}
      style="
        left: {t.rect.left}px;
        top: {t.rect.top}px;
        width: {t.rect.width}px;
        height: {t.rect.height}px;
      "
      on:pointerenter={() => (hoverId = t.id)}
      on:pointerleave={() => (hoverId = null)}
      on:pointerdown|stopPropagation={() => selectTarget(t.id, t.rect)}
      aria-label={t.label}
    >
      <span class="tag">{t.label}</span>
    </button>
  {/each}

  <!-- Toolbar -->
  <div class="toolbar" on:pointerdown|stopPropagation>
    <div class="title">
      Design-Modus
      {#if selectedSchema}
        <span class="sel-tag">· {selectedSchema.label}</span>
      {/if}
    </div>
    <div class="tools">
      <button class="tb-btn primary" on:click={done} title="Fertig (D / ESC)">✓ Fertig</button>
    </div>
    <div class="hint">Klick auf ein Element zum Bearbeiten · D/ESC schließt</div>
  </div>

  {#if selectedSchema}
    <DesignPanel
      schema={selectedSchema}
      {cfg}
      initialX={panelPos.x}
      initialY={panelPos.y}
      on:close={() => (selectedId = null)}
    />
  {/if}
</div>

<style>
  .design-root {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(0.5px);
    cursor: default;
  }
  .hitzone {
    position: fixed;
    background: transparent;
    border: 2px dashed rgba(255, 200, 120, 0.5);
    border-radius: 4px;
    padding: 0;
    color: white;
    font-family: var(--font-ui, system-ui, sans-serif);
    cursor: pointer;
    transition: border-color 100ms, background 100ms;
    box-sizing: border-box;
  }
  .hitzone:hover,
  .hitzone.hovered {
    border-color: rgba(255, 200, 120, 0.95);
    background: rgba(255, 200, 120, 0.1);
  }
  .hitzone.selected {
    border: 2px solid #fbbf24;
    background: rgba(251, 191, 36, 0.12);
  }
  .tag {
    position: absolute;
    top: -22px;
    left: 0;
    font-size: 11px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.75);
    color: #fde68a;
    padding: 2px 6px;
    border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
  }

  .toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px 10px 6px;
    color: white;
    font-family: var(--font-ui, system-ui, sans-serif);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    min-width: 240px;
    max-width: calc(100% - 24px);
    backdrop-filter: blur(8px);
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: #cbd5e1;
    text-align: center;
    margin-bottom: 6px;
  }
  .sel-tag {
    color: #fbbf24;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }
  .tb-btn {
    min-width: 34px;
    height: 30px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
  }
  .tb-btn.primary {
    background: #fbbf24;
    color: #0f172a;
    border-color: #fbbf24;
    font-weight: 600;
    font-size: 12px;
  }
  .tb-btn.primary:hover {
    background: #fcd34d;
    border-color: #fcd34d;
  }
  .hint {
    margin-top: 6px;
    font-size: 10px;
    color: #94a3b8;
    text-align: center;
  }
</style>
