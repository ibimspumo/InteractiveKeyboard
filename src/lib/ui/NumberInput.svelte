<script lang="ts">
  /* Konsistenter Number-Input mit optionalem Suffix (z.B. "px", "s"). */
  export let value: number;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number = 1;
  export let suffix: string = "";
  export let width: string = "96px";
  export let disabled: boolean = false;
</script>

<div class="wrap" style="--w: {width}" class:disabled>
  <input type="number" {min} {max} {step} bind:value {disabled} />
  {#if suffix}
    <span class="suffix">{suffix}</span>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: var(--w);
  }
  input {
    width: 100%;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 8px;
    font-size: var(--fs-sm);
    font-family: var(--font-ui);
    transition: border-color var(--duration), background var(--duration);
  }
  input:hover:not(:disabled) {
    border-color: var(--c-border-strong);
  }
  input:focus {
    outline: none;
    border-color: var(--c-accent);
    background: var(--c-bg-2);
  }
  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .suffix {
    position: absolute;
    right: var(--sp-2);
    pointer-events: none;
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
  }
  .wrap:has(.suffix) input {
    padding-right: 28px;
  }
</style>
