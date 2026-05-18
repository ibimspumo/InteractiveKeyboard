<script lang="ts">
  export let label: string;
  export let value: string;
  export let options: { value: string; label: string }[];
  export let onChange: (next: string) => void;

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
  <div class="seg-row">
    {#each options as opt}
      <button
        type="button"
        class="seg"
        class:active={local === opt.value}
        on:click={() => (local = opt.value)}
      >
        {opt.label}
      </button>
    {/each}
  </div>
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
  .seg-row {
    display: inline-flex;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    overflow: hidden;
  }
  .seg {
    flex: 1;
    background: transparent;
    color: #94a3b8;
    border: none;
    padding: 6px 10px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: background 100ms, color 100ms;
  }
  .seg:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }
  .seg.active {
    background: #fbbf24;
    color: #0f172a;
    font-weight: 600;
  }
</style>
