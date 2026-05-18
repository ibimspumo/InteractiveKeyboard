<script lang="ts">
  /* Generisches Form-Field-Wrapper:
     Label oben, Control darunter (default-slot), optional Hint darunter.
     Mit `inline` wird das Label links und Control rechts gerendert (für kompakte Listen). */
  export let label: string = "";
  export let hint: string = "";
  export let inline: boolean = false;
  export let disabled: boolean = false;
</script>

<div class="field" class:inline class:disabled>
  {#if label}
    <span class="label">{label}</span>
  {/if}
  <div class="control">
    <slot />
  </div>
  {#if hint}
    <p class="hint">{hint}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .field.inline {
    flex-direction: row;
    align-items: center;
    gap: var(--sp-3);
  }
  .field.inline .label {
    flex: 1;
    margin: 0;
  }
  .field.inline .control {
    flex-shrink: 0;
  }
  .field.inline .hint {
    flex-basis: 100%;
    margin-top: var(--sp-1);
  }
  .label {
    font-size: var(--fs-sm);
    color: var(--c-text);
    font-weight: 500;
  }
  .control {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .hint {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    line-height: 1.45;
    margin: 0;
  }
  .disabled {
    opacity: 0.55;
    pointer-events: none;
  }
</style>
