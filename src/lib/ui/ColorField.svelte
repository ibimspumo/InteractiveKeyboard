<script lang="ts">
  import type { RGBA } from "../types";
  import { hexToRgba, rgbaToHex } from "../defaults";

  /* RGBA-Color-Picker: hex-color + alpha-Slider. Bind:value für RGBA. */
  export let value: RGBA;
  export let withAlpha: boolean = true;

  function onHex(e: Event) {
    const hex = (e.currentTarget as HTMLInputElement).value;
    value = { ...hexToRgba(hex), a: value.a };
  }
  function onAlpha(e: Event) {
    const a = parseFloat((e.currentTarget as HTMLInputElement).value);
    value = { ...value, a };
  }
</script>

<div class="wrap">
  <div class="swatch-wrap">
    <input
      type="color"
      value={rgbaToHex(value)}
      on:input={onHex}
    />
  </div>
  {#if withAlpha}
    <input
      class="alpha"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={value.a}
      on:input={onAlpha}
    />
    <span class="val">{value.a.toFixed(2)}</span>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex: 1;
    min-width: 0;
  }
  .swatch-wrap {
    width: 32px;
    height: 28px;
    border-radius: var(--r-sm);
    border: 1px solid var(--c-border);
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
    background: repeating-conic-gradient(#2a2a30 0% 25%, #1a1a20 0% 50%) 0 0 / 8px 8px;
  }
  input[type="color"] {
    width: 200%;
    height: 200%;
    margin: -25% 0 0 -25%;
    border: none;
    padding: 0;
    cursor: pointer;
    background: none;
  }
  .alpha {
    flex: 1;
    min-width: 0;
    accent-color: var(--c-accent);
  }
  .val {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    min-width: 36px;
    text-align: right;
  }
</style>
