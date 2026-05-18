<script lang="ts">
  import type { AppSettings } from "../../types";
  import { Callout, Card, ColorField, Field, SectionHeader, Toggle } from "../../ui";

  export let cfg: AppSettings;
</script>

<SectionHeader
  title="Darstellung"
  description="Globale Visual-Optionen für die blockierten Tasten. Tasten-Stil pro Taste kannst du im Design-Modus (D) live ändern."
/>

<Card title="Block-Indikator">
  <Field hint="Ein rotes X auf blockierten Tasten — gut sichtbar im Stream.">
    <Toggle bind:checked={cfg.showBlockX} label="Rotes X über blockierten Tasten anzeigen" />
  </Field>
  <Field label="Farbe des X">
    <ColorField bind:value={cfg.blockXColor} />
  </Field>
</Card>

<Card title="Timer">
  <Field hint="Restzeit der Blockierung in Sekunden, klein unten an der Taste.">
    <Toggle bind:checked={cfg.showTimer} label="Restzeit anzeigen" />
  </Field>
  <Field label="Farbe des Timers">
    <ColorField bind:value={cfg.timerColor} />
  </Field>
</Card>

<Card title="Fenster-Hintergrund">
  <Field hint="Alpha = 0 → komplett transparent (Default, für OBS-Capture). Höher = sichtbarer Hintergrund.">
    <ColorField bind:value={cfg.backgroundColor} />
  </Field>
</Card>

<Callout variant="info">
  Tasten-Farben und Form ändern sich pro Taste im <strong>Design-Modus</strong>:
  ESC schließen, dann <strong>D</strong> drücken und auf die Taste klicken.
</Callout>
