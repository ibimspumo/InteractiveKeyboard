<script lang="ts">
  import type { AppSettings, MultiTriggerMode } from "../../types";
  import { Callout, Card, Field, NumberInput, SectionHeader } from "../../ui";

  export let cfg: AppSettings;

  const modeOptions: { value: MultiTriggerMode; label: string; desc: string }[] = [
    {
      value: "add",
      label: "Addieren",
      desc: "Erneute Blockierung addiert ihre Dauer zur Restzeit. Bis zum unten konfigurierten Maximum.",
    },
    {
      value: "reset",
      label: "Zurücksetzen",
      desc: "Erneute Blockierung setzt die Restzeit auf die neue Dauer (überschreibt alles vorherige).",
    },
    {
      value: "ignore",
      label: "Ignorieren",
      desc: "Während die Taste blockiert ist, werden neue Block-Requests verworfen.",
    },
  ];
</script>

<SectionHeader
  title="Block-Verhalten"
  description="Was passiert bei mehrfacher Einlösung des Webhooks auf einer bereits blockierten Taste?"
/>

<Card title="Bei Mehrfach-Trigger">
  <div class="seg-list">
    {#each modeOptions as opt}
      <label class="seg" class:active={cfg.multiTriggerMode === opt.value}>
        <input type="radio" bind:group={cfg.multiTriggerMode} value={opt.value} />
        <div class="seg-text">
          <span class="seg-label">{opt.label}</span>
          <span class="seg-desc">{opt.desc}</span>
        </div>
      </label>
    {/each}
  </div>
</Card>

<Card title="Maximale Block-Dauer (Addieren-Modus)">
  <Field
    label="Maximum"
    inline
    hint="Obergrenze für die addierte Restzeit. 0 = unbegrenzt."
  >
    <NumberInput
      bind:value={cfg.maxBlockSeconds}
      min={0}
      max={3600}
      step={1}
      suffix="s"
      disabled={cfg.multiTriggerMode !== "add"}
      width="110px"
    />
  </Field>
  {#if cfg.multiTriggerMode !== "add"}
    <Callout variant="info">Nur im „Addieren"-Modus relevant.</Callout>
  {/if}
</Card>

<Card title="Default-Block-Dauer">
  <Field
    label="Sekunden"
    inline
    hint="Wird verwendet, wenn der Webhook keine duration mitschickt (z.B. /block?key=W)."
  >
    <NumberInput
      bind:value={cfg.defaultBlockSeconds}
      min={0.1}
      max={600}
      step={0.5}
      suffix="s"
      width="110px"
    />
  </Field>
</Card>

<style>
  .seg-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .seg {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background var(--duration), border-color var(--duration);
  }
  .seg:hover {
    background: var(--c-bg-3);
  }
  .seg.active {
    background: var(--c-accent-soft);
    border-color: var(--c-accent);
  }
  .seg input {
    margin-top: 3px;
    flex-shrink: 0;
  }
  .seg-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .seg-label {
    font-size: var(--fs-sm);
    color: var(--c-text);
    font-weight: 600;
  }
  .seg-desc {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    line-height: 1.5;
  }
</style>
