<script lang="ts">
  /* Range-Slider mit Wert-Anzeige rechts. */
  export let value: number;
  export let min: number = 0;
  export let max: number = 1;
  export let step: number = 0.01;
  export let format: (v: number) => string = (v) => v.toFixed(2);
  export let disabled: boolean = false;
</script>

<div class="wrap" class:disabled>
  <input type="range" {min} {max} {step} bind:value {disabled} />
  <span class="val">{format(value)}</span>
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex: 1;
    min-width: 0;
  }
  input {
    flex: 1;
    min-width: 0;
    accent-color: var(--c-accent);
  }
  .val {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    min-width: 48px;
    text-align: right;
  }
  .disabled { opacity: 0.5; }
</style>
