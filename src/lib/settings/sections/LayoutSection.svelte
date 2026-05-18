<script lang="ts">
  import type { AppSettings, LayoutMode } from "../../types";
  import { Callout, Card, Field, SectionHeader, Toggle } from "../../ui";
  import { defaultMousePositionForLayout } from "../../defaults";

  export let cfg: AppSettings;

  type ModeOption = {
    id: LayoutMode;
    label: string;
    desc: string;
    aspect: string;
  };

  const options: ModeOption[] = [
    { id: "keyboard", label: "WASD Only", desc: "Nur Tastatur. Quadratisch.", aspect: "1:1" },
    { id: "mouse", label: "Maus Only", desc: "Nur Maus. Quadratisch.", aspect: "1:1" },
    { id: "keyboard+mouse", label: "WASD + Maus", desc: "Tastatur links, Maus rechts. Querformat.", aspect: "2:1" },
  ];

  function pick(mode: LayoutMode) {
    if (mode === cfg.layoutMode) return;
    cfg.layoutMode = mode;
    // In "keyboard"-Only ist die Maus ausgeblendet — Position bleibt zur späteren
    // Wiederverwendung erhalten.
    if (mode === "keyboard") return;

    // Sonst: Maus muss in den richtigen Quadranten des neuen Layouts. Gift-Offsets
    // werden NICHT angefasst (die sind relativ zu den Sub-Button-Centern innerhalb
    // der Maus-Bbox und bleiben dadurch automatisch erhalten).
    const m = cfg.mouse;
    let needsRepos = false;
    if (mode === "keyboard+mouse") {
      // Tastatur liegt im linken Quadranten 0..500, Maus im rechten 500..1000.
      // Maus muss komplett rechts der Mittellinie liegen.
      if (m.x < 500 || m.x + m.width > 1010 || m.y < 0 || m.y + m.height > 510) {
        needsRepos = true;
      }
    } else if (mode === "mouse") {
      // Mouse-Only: Maus zentriert im 500×500-Quadranten.
      if (m.x < 0 || m.x + m.width > 510 || m.y < 0 || m.y + m.height > 510) {
        needsRepos = true;
      }
    }
    if (needsRepos) {
      const pos = defaultMousePositionForLayout(mode, m.width, m.height);
      cfg.mouse = { ...m, x: pos.x, y: pos.y };
    }
  }
</script>

<SectionHeader
  title="Layout"
  description="Welche Bedien-Elemente sichtbar sind und in welcher Form das Fenster läuft. Wechsel passt das Fenster automatisch an die neue Aspect-Ratio an."
/>

<Card title="Modus">
  <div class="mode-grid">
    {#each options as opt}
      <button
        type="button"
        class="mode"
        class:active={cfg.layoutMode === opt.id}
        on:click={() => pick(opt.id)}
      >
        <span class="mode-aspect">{opt.aspect}</span>
        <span class="mode-label">{opt.label}</span>
        <span class="mode-desc">{opt.desc}</span>
      </button>
    {/each}
  </div>
</Card>

<Card title="Mausrad-Verhalten">
  <Field hint="Beide aktiviert (Default): WHEEL blockiert Mittelklick UND Scroll. Einzeln deaktivieren, wenn du z.B. nur den Klick freilassen willst.">
    <Toggle bind:checked={cfg.mouse.wheel.click} label="Mittelklick blockieren wenn WHEEL aktiv" />
    <Toggle bind:checked={cfg.mouse.wheel.scroll} label="Scrollen blockieren wenn WHEEL aktiv" />
  </Field>
  {#if !cfg.mouse.wheel.click && !cfg.mouse.wheel.scroll}
    <Callout variant="warn">
      Beide Optionen aus → WHEEL hat keinen Effekt mehr. Block-Requests landen
      im Frontend (Timer/X läuft visuell), aber das Betriebssystem schluckt
      weder Klicks noch Scroll.
    </Callout>
  {/if}
</Card>

<Callout variant="info">
  Weitere Layouts (komplette Tastatur, eigene Layouts) kommen in zukünftigen Versionen
  und werden hier ausgewählt.
</Callout>

<style>
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--sp-2);
  }
  .mode {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: var(--sp-3);
    background: var(--c-bg-2);
    border: 1.5px solid var(--c-border);
    border-radius: var(--r-sm);
    cursor: pointer;
    text-align: left;
    color: var(--c-text);
    font-family: inherit;
    transition: border-color 120ms, background 120ms;
  }
  .mode:hover {
    border-color: var(--c-border-strong);
    background: var(--c-bg-3);
  }
  .mode.active {
    border-color: var(--c-accent);
    background: var(--c-accent-soft);
  }
  .mode-aspect {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--c-text-dim);
    letter-spacing: 0.5px;
  }
  .mode.active .mode-aspect { color: var(--c-accent); }
  .mode-label {
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .mode-desc {
    font-size: 11px;
    color: var(--c-text-muted);
    line-height: 1.3;
  }
  @media (max-width: 520px) {
    .mode-grid { grid-template-columns: 1fr; }
  }
</style>
