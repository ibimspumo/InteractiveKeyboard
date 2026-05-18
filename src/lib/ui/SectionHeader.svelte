<script lang="ts">
  /* Großer Section-Header oben in jedem Tab. */
  export let title: string;
  export let description: string = "";
</script>

<header class="section-header">
  <h2>{title}</h2>
  {#if description}
    <p>{description}</p>
  {/if}
</header>

<style>
  h2 {
    font-size: var(--fs-xl);
    font-weight: 600;
    color: var(--c-text);
    margin: 0 0 var(--sp-1);
    font-family: var(--font-ui);
  }
  p {
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    margin: 0;
    line-height: 1.5;
    max-width: 70ch;
  }
</style>
