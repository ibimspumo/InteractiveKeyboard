<script lang="ts">
  /* Saubere CSS-only Switch — Ersatz für rohe <input type="checkbox"> Bind:
     <Toggle bind:checked={cfg.foo} label="Foo aktivieren" /> */
  export let checked: boolean = false;
  export let label: string = "";
  export let disabled: boolean = false;
</script>

<label class="toggle" class:disabled>
  <input type="checkbox" bind:checked {disabled} />
  <span class="track">
    <span class="thumb"></span>
  </span>
  {#if label}
    <span class="text">{label}</span>
  {/if}
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    cursor: pointer;
    user-select: none;
    font-size: var(--fs-sm);
    color: var(--c-text);
  }
  .toggle.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .track {
    position: relative;
    width: 34px;
    height: 20px;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: 999px;
    transition: background var(--duration), border-color var(--duration);
    flex-shrink: 0;
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--c-text-muted);
    border-radius: 50%;
    transition: transform var(--duration), background var(--duration);
  }
  input:checked + .track {
    background: var(--c-accent);
    border-color: var(--c-accent);
  }
  input:checked + .track .thumb {
    transform: translateX(14px);
    background: white;
  }
  input:focus-visible + .track {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
  }
</style>
