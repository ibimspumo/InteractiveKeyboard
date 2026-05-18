<script lang="ts">
  import { NumberInput } from "../../ui";

  export let label: string;
  export let value: number;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number = 1;
  export let suffix: string = "";
  export let hint: string = "";
  export let onChange: (next: number) => void;

  // Sync ohne Echo-Loop: lastExternal merkt sich den zuletzt von außen
  // empfangenen Wert. Nur Änderungen von local, die von außen abweichen,
  // lösen onChange aus.
  let local = value;
  let lastExternal = value;
  $: if (value !== lastExternal) {
    lastExternal = value;
    local = value;
  }
  $: if (local !== lastExternal) {
    lastExternal = local;
    onChange(local);
  }
</script>

<div class="row">
  <span class="label">{label}</span>
  <NumberInput bind:value={local} {min} {max} {step} {suffix} width="100%" />
  {#if hint}
    <span class="hint">{hint}</span>
  {/if}
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
  .hint {
    font-size: 10px;
    color: #64748b;
  }
</style>
