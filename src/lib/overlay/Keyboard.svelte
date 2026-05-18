<script lang="ts">
  import type { AppSettings, KeyRuntime } from "../types";
  import Key from "./Key.svelte";

  // Container der die Tastatur in Ref-500-Koordinaten rendert. Die Skalierung
  // (window/500) wird einmal hier berechnet und an jede Taste durchgereicht.

  export let cfg: AppSettings;
  export let runtimes: Record<string, KeyRuntime>;
  export let editMode: boolean = false;
  export let designMode: boolean = false;
  // Scale wird zentral in App.svelte aus windowHeight/500 berechnet, damit
  // Tastatur und Maus im Querformat homogen skalieren.
  export let scale: number;

  // Refs auf jede Key-Komponente halten, damit der Editor die Bbox messen kann.
  type KeyRef = {
    getElement: () => HTMLElement | undefined;
    getGiftElement: () => HTMLElement | undefined;
  };
  const keyRefs: Record<string, KeyRef> = {};
  export function getKeyRef(id: string): KeyRef | undefined {
    return keyRefs[id];
  }
</script>

<div
  class="kb-root"
  data-tauri-drag-region={editMode || designMode ? null : true}
>
  {#each cfg.keys as def (def.id)}
    <Key
      bind:this={keyRefs[def.id]}
      {def}
      runtime={runtimes[def.id]}
      {cfg}
      {scale}
      {editMode}
      {designMode}
      giftEditable={editMode}
    />
  {/each}
</div>

<style>
  .kb-root {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
