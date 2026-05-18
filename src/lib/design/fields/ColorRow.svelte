<script lang="ts">
  import type { RGBA } from "../../types";
  import { ColorField } from "../../ui";

  export let label: string;
  export let value: RGBA;
  export let withAlpha: boolean = true;
  export let onChange: (next: RGBA) => void;

  // Sync ohne Echo-Loop (RGBA = Objekt → JSON-Vergleich).
  let local: RGBA = value;
  let lastExternalKey = JSON.stringify(value);
  $: {
    const externalKey = JSON.stringify(value);
    if (externalKey !== lastExternalKey) {
      lastExternalKey = externalKey;
      local = value;
    }
  }
  $: {
    const localKey = JSON.stringify(local);
    if (localKey !== lastExternalKey) {
      lastExternalKey = localKey;
      onChange(local);
    }
  }
</script>

<div class="row">
  <span class="label">{label}</span>
  <ColorField bind:value={local} {withAlpha} />
</div>

<style>
  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
</style>
