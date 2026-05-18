<script lang="ts">
  /* Visueller Container für gruppierte Settings. */
  export let title: string = "";
  export let hint: string = "";
  export let padding: "sm" | "md" = "md";
</script>

<section class="card {padding}">
  {#if title}
    <header class="head">
      <h3>{title}</h3>
      {#if hint}<p>{hint}</p>{/if}
    </header>
  {/if}
  <div class="body">
    <slot />
  </div>
</section>

<style>
  .card {
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  .head {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--c-border);
    background: rgba(255, 255, 255, 0.015);
  }
  .head h3 {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--c-text);
    margin: 0;
  }
  .head p {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    margin: 4px 0 0;
    line-height: 1.45;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .md .body {
    padding: var(--sp-4);
  }
  .sm .body {
    padding: var(--sp-3);
    gap: var(--sp-2);
  }
</style>
