<script lang="ts">
  import type { AppSettings } from "../../types";
  import { defaultSettings } from "../../defaults";
  import { Button, Callout, Card, SectionHeader } from "../../ui";

  export let cfg: AppSettings;

  let confirming = false;
  function applyReset() {
    cfg = defaultSettings();
    confirming = false;
  }
</script>

<SectionHeader
  title="Zurücksetzen"
  description="Setzt alle Einstellungen — Tasten-Layout, Stile, Sounds, Webhook — auf die Standardwerte zurück."
/>

<Card>
  <Callout variant="warn">
    <strong>Achtung:</strong> Damit gehen alle Anpassungen verloren —
    Tasten-Positionen, Stile, Sound-Library-Verweise, Webhook-Port. Die Änderung
    wird erst nach <strong>„Speichern"</strong> übernommen, du kannst sie vorher
    noch mit <strong>„Verwerfen"</strong> abbrechen.
  </Callout>

  {#if !confirming}
    <Button variant="danger" on:click={() => (confirming = true)}>
      Auf Standard zurücksetzen
    </Button>
  {:else}
    <Callout variant="error">
      <strong>Wirklich zurücksetzen?</strong>
    </Callout>
    <div class="button-row">
      <Button variant="danger" on:click={applyReset}>Ja, zurücksetzen</Button>
      <Button variant="ghost" on:click={() => (confirming = false)}>Abbrechen</Button>
    </div>
  {/if}
</Card>

<style>
  .button-row {
    display: flex;
    gap: var(--sp-2);
  }
</style>
