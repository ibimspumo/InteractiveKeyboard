<script lang="ts">
  export let variant: "info" | "success" | "warn" | "error" = "info";
</script>

<div class="callout {variant}">
  <slot />
</div>

<style>
  .callout {
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    font-size: var(--fs-sm);
    line-height: 1.5;
    border: 1px solid;
  }
  .callout :global(strong) { font-weight: 600; }
  .info {
    background: var(--c-accent-soft);
    border-color: var(--c-accent-border);
    color: #c8d6ff;
  }
  .success {
    background: var(--c-success-soft);
    border-color: rgba(46, 204, 113, 0.4);
    color: #a6e9c5;
  }
  .warn {
    background: var(--c-warn-soft);
    border-color: rgba(224, 166, 74, 0.4);
    color: #f0c886;
  }
  .error {
    background: var(--c-danger-soft);
    border-color: rgba(239, 90, 90, 0.4);
    color: #f5a6a6;
  }
</style>
