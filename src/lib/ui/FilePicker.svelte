<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { createEventDispatcher } from "svelte";
  import Button from "./Button.svelte";

  /* File-Picker mit Anzeige des aktuellen Filenames. Optional play- und clear-Slots. */
  export let value: string | null = null;
  export let placeholder: string = "—";
  export let filters: { name: string; extensions: string[] }[] = [];
  export let onPlay: (() => void) | null = null;

  const dispatch = createEventDispatcher<{ change: string | null }>();

  async function pick() {
    const file = await open({ multiple: false, filters });
    if (typeof file === "string") {
      value = file;
      dispatch("change", file);
    }
  }

  function clear() {
    value = null;
    dispatch("change", null);
  }

  function shortName(p: string | null): string {
    if (!p) return placeholder;
    const parts = p.split(/[/\\]/);
    return parts[parts.length - 1] ?? p;
  }
</script>

<div class="wrap">
  <span class="path" title={value ?? ""} class:empty={!value}>
    {shortName(value)}
  </span>
  <div class="actions">
    {#if onPlay}
      <Button size="sm" variant="ghost" on:click={onPlay} title="Vorhören (mit eingestellter Lautstärke)">▶</Button>
    {/if}
    <Button size="sm" on:click={pick} title="Datei wählen">Wählen</Button>
    {#if value}
      <Button size="sm" variant="ghost" on:click={clear} title="Zurücksetzen">✕</Button>
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1;
    min-width: 0;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 4px 4px 10px;
  }
  .path {
    flex: 1;
    font-size: var(--fs-xs);
    color: var(--c-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    min-width: 0;
  }
  .path.empty {
    color: var(--c-text-dim);
    font-style: italic;
    font-family: var(--font-ui);
  }
  .actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
</style>
