<script lang="ts">
  import { Toggle } from "../../ui";

  export let label: string;
  export let value: boolean;
  export let onChange: (next: boolean) => void;

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
  <Toggle bind:checked={local} {label} />
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    padding: 4px 0;
  }
</style>
