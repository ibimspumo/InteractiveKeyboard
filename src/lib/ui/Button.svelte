<script lang="ts">
  export let variant: "primary" | "secondary" | "ghost" | "danger" = "secondary";
  export let size: "sm" | "md" = "md";
  export let disabled: boolean = false;
  export let title: string = "";
</script>

<button
  class="btn {variant} {size}"
  on:click
  {disabled}
  {title}
>
  <slot />
</button>

<style>
  .btn {
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    font-family: var(--font-ui);
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    transition: background var(--duration), border-color var(--duration), color var(--duration);
    white-space: nowrap;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.md {
    padding: 7px 14px;
    font-size: var(--fs-sm);
  }
  .btn.sm {
    padding: 4px 10px;
    font-size: var(--fs-xs);
  }
  .btn.primary {
    background: var(--c-accent);
    color: white;
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--c-accent-hover);
  }
  .btn.secondary {
    background: var(--c-bg-3);
    color: var(--c-text);
    border-color: var(--c-border);
  }
  .btn.secondary:hover:not(:disabled) {
    background: var(--c-bg-4);
    border-color: var(--c-border-strong);
  }
  .btn.ghost {
    background: transparent;
    color: var(--c-text-muted);
  }
  .btn.ghost:hover:not(:disabled) {
    background: var(--c-bg-3);
    color: var(--c-text);
  }
  .btn.danger {
    background: transparent;
    color: var(--c-danger);
    border-color: var(--c-border);
  }
  .btn.danger:hover:not(:disabled) {
    background: var(--c-danger-soft);
    border-color: var(--c-danger);
  }
</style>
