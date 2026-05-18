<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { settings } from "../stores";
  import {
    SOUND_PREFIX,
    countSoundRefs,
    defaultNameForPath,
    displayNameForSoundRef,
    findSoundEntry,
    newSoundId,
    resolveSoundUrl,
  } from "../sound-library";
  import { previewAudio } from "./audio-preview";
  import type { AppSettings, SoundEntry, SoundRef } from "../types";

  // value-Format: null | "sound:<id>" | legacy rohpfad
  export let value: SoundRef = null;
  // Placeholder, wenn nichts gewählt (z.B. "Default (up.mp3)" oder "Kein Sound").
  export let placeholder: string = "Kein Sound";
  // Optionaler Volume-Offset in dB. Wenn ein number übergeben wird, zeigt der
  // Picker neben dem Trigger einen kleinen dB-Slider und emittiert bei
  // Änderung volumeChange. null/undefined = Slider nicht anzeigen.
  export let volumeDb: number | null = null;

  const dispatch = createEventDispatcher<{
    change: SoundRef;
    volumeChange: number;
  }>();

  let open_ = false;

  // Reaktiv auf Settings, damit Library-Änderungen das Trigger-Label aktualisieren.
  let cfg: AppSettings;
  const unsubSettings = settings.subscribe((v) => (cfg = v));
  onDestroy(() => unsubSettings());

  $: triggerLabel = (() => {
    if (!value) return placeholder;
    return displayNameForSoundRef(cfg, value, placeholder);
  })();
  $: triggerEntry = findSoundEntry(cfg, value);

  // Legacy: roher Pfad wurde mal außerhalb der Bibliothek gewählt. Wir bieten
  // an, ihn nachträglich in die Bibliothek aufzunehmen.
  $: isLegacyRawPath =
    typeof value === "string" && !value.startsWith(SOUND_PREFIX);

  function previewRef(ref: SoundRef) {
    const url = resolveSoundUrl(cfg, ref);
    // Bei Preview den effektiven Pegel anhören (Master + Spot-Offset).
    const offset = typeof volumeDb === "number" ? volumeDb : 0;
    previewAudio(url, cfg.volumeDb + offset);
  }

  function onVolumeInput(e: Event) {
    const t = e.currentTarget as HTMLInputElement;
    const next = Number(t.value);
    if (Number.isFinite(next)) dispatch("volumeChange", next);
  }

  function pick(entryId: string) {
    dispatch("change", `${SOUND_PREFIX}${entryId}`);
    close();
  }

  function clear() {
    dispatch("change", null);
    close();
  }

  async function addNewSound(): Promise<SoundEntry | null> {
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] },
        ],
      });
      if (typeof result !== "string") return null;
      const entry: SoundEntry = {
        id: newSoundId(),
        name: defaultNameForPath(result),
        path: result,
      };
      settings.update((s) => ({
        ...s,
        soundLibrary: [...s.soundLibrary, entry],
      }));
      return entry;
    } catch (e) {
      console.warn("file dialog failed", e);
      return null;
    }
  }

  // "+ Sound hochladen" im Modal: nach Upload direkt auswählen (User-Wunsch).
  async function addAndPick() {
    const entry = await addNewSound();
    if (entry) pick(entry.id);
  }

  function rename(entryId: string, name: string) {
    settings.update((s) => ({
      ...s,
      soundLibrary: s.soundLibrary.map((e) =>
        e.id === entryId ? { ...e, name: name || e.name } : e,
      ),
    }));
  }

  function remove(entryId: string) {
    const uses = countSoundRefs(cfg, entryId);
    const entry = cfg.soundLibrary.find((e) => e.id === entryId);
    const name = entry?.name ?? entryId;
    const extra =
      uses > 0
        ? `\n\nDer Sound wird noch an ${uses} Stelle(n) verwendet — diese werden „leer".`
        : "";
    if (!confirm(`Sound "${name}" wirklich aus der Bibliothek löschen?${extra}`))
      return;
    settings.update((s) => ({
      ...s,
      soundLibrary: s.soundLibrary.filter((e) => e.id !== entryId),
    }));
    // Wenn der gerade aktive Eintrag gelöscht wurde → value räumen.
    if (value === `${SOUND_PREFIX}${entryId}`) clear();
  }

  // Legacy-Pfad in die Bibliothek aufnehmen + direkt referenzieren.
  function importLegacy() {
    if (!isLegacyRawPath || typeof value !== "string") return;
    const entry: SoundEntry = {
      id: newSoundId(),
      name: defaultNameForPath(value),
      path: value,
    };
    settings.update((s) => ({
      ...s,
      soundLibrary: [...s.soundLibrary, entry],
    }));
    dispatch("change", `${SOUND_PREFIX}${entry.id}`);
  }

  function close() {
    open_ = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open_) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }
  onMount(() => window.addEventListener("keydown", onKeyDown, true));
  onDestroy(() => window.removeEventListener("keydown", onKeyDown, true));
</script>

<div class="picker-trigger">
  <button class="trigger-btn" on:click={() => (open_ = true)} title="Sound ändern">
    <span class="thumb" class:empty={!value}>{value ? "🔊" : "♪"}</span>
    <span class="trigger-label" class:empty={!value}>{triggerLabel}</span>
    {#if value}
      <button
        type="button"
        class="trigger-action"
        on:click|stopPropagation={() => previewRef(value)}
        title="Vorhören"
      >▶</button>
      <button
        type="button"
        class="trigger-action"
        on:click|stopPropagation={clear}
        title="Auswahl entfernen"
      >✕</button>
    {/if}
    <span class="trigger-cta">Bibliothek</span>
  </button>

  {#if volumeDb !== null && value}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
    <label
      class="vol-knob"
      title={`Lautstärke-Offset für diesen Sound (zur Master-Lautstärke addiert).\nAktuell: ${volumeDb.toFixed(1)} dB`}
      on:click|stopPropagation
    >
      <span class="vol-icon">🔊</span>
      <input
        type="range"
        class="vol-slider"
        min={-40}
        max={12}
        step={0.5}
        value={volumeDb}
        on:input={onVolumeInput}
        on:change={onVolumeInput}
      />
      <span class="vol-value">{volumeDb > 0 ? "+" : ""}{volumeDb.toFixed(1)}<span class="vol-unit">dB</span></span>
    </label>
  {/if}
</div>

{#if open_}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-scrim" on:click={close} role="presentation">
    <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions -->
    <div
      class="modal"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-label="Sound-Bibliothek"
    >
      <header class="modal-head">
        <div class="head-title">Sound-Bibliothek</div>
        <button class="head-close" on:click={close} title="Schließen (ESC)">✕</button>
      </header>

      <div class="actions-row">
        <button class="action-btn primary" on:click={addAndPick}>
          <span class="ax-emoji">＋</span> Sound hochladen…
        </button>
        <button class="action-btn" on:click={clear}>
          <span class="ax-emoji">∅</span> Kein Sound
        </button>
        <span class="count-hint">
          {cfg.soundLibrary.length} Sound{cfg.soundLibrary.length === 1 ? "" : "s"}
        </span>
      </div>

      {#if isLegacyRawPath}
        <div class="legacy-row">
          <span class="legacy-text">
            Aktueller Pfad ist nicht in der Bibliothek (alter Eintrag):
            <span class="legacy-path">{value}</span>
          </span>
          <button class="action-btn" on:click={importLegacy}>
            → In Bibliothek übernehmen
          </button>
        </div>
      {/if}

      <div class="list">
        {#each cfg.soundLibrary as entry (entry.id)}
          {@const selected = value === `${SOUND_PREFIX}${entry.id}`}
          <div class="list-item" class:selected>
            <button
              class="row-pick"
              on:click={() => pick(entry.id)}
              title="Auswählen"
            >
              <span class="row-icon">🔊</span>
              <input
                type="text"
                class="row-name"
                value={entry.name}
                on:click|stopPropagation
                on:change={(e) => rename(entry.id, e.currentTarget.value)}
                on:blur={(e) => rename(entry.id, e.currentTarget.value)}
              />
              <span class="row-path" title={entry.path}>{entry.path}</span>
            </button>
            <div class="row-actions">
              <button
                class="mini-btn"
                on:click={() => previewRef(`${SOUND_PREFIX}${entry.id}`)}
                title="Vorhören"
              >▶</button>
              <button
                class="mini-btn danger"
                on:click={() => remove(entry.id)}
                title="Aus Bibliothek löschen"
              >✕</button>
            </div>
          </div>
        {:else}
          <div class="empty-state">
            Bibliothek ist leer. Klick „Sound hochladen…", um den ersten Eintrag
            anzulegen.
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .picker-trigger > .trigger-btn {
    flex: 1;
    min-width: 0;
  }
  .vol-knob {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 3px 6px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .vol-knob:hover {
    background: var(--c-bg-4);
    border-color: var(--c-border-strong);
  }
  .vol-icon {
    font-size: 11px;
    color: var(--c-text-dim);
  }
  .vol-slider {
    width: 80px;
    accent-color: var(--c-accent);
  }
  .vol-value {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--c-text-muted);
    min-width: 38px;
    text-align: right;
    white-space: nowrap;
  }
  .vol-unit {
    margin-left: 2px;
    opacity: 0.6;
  }
  .trigger-btn {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 6px 4px 8px;
    cursor: pointer;
    color: var(--c-text);
    transition: background var(--duration), border-color var(--duration);
    font-family: inherit;
    text-align: left;
  }
  .trigger-btn:hover {
    background: var(--c-bg-4);
    border-color: var(--c-border-strong);
  }
  .thumb {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 6px;
    background: linear-gradient(155deg, #1a2a3a 0%, #0a1018 100%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }
  .thumb.empty {
    color: var(--c-text-dim);
  }
  .trigger-label {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-label.empty {
    color: var(--c-text-dim);
    font-style: italic;
  }
  .trigger-action {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
    border-radius: var(--r-sm);
    font-size: 11px;
    flex-shrink: 0;
  }
  .trigger-action:hover {
    background: var(--c-bg-4);
    color: var(--c-text);
  }
  .trigger-cta {
    color: var(--c-accent);
    font-size: var(--fs-xs);
    font-weight: 600;
    flex-shrink: 0;
    padding-left: 4px;
  }

  .modal-scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-3);
    animation: scrim-in 140ms ease-out;
  }
  @keyframes scrim-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .modal {
    background: var(--c-bg-1);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    width: 100%;
    max-width: 720px;
    max-height: calc(100vh - 24px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modal-in 160ms cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  @keyframes modal-in {
    from { transform: translateY(8px) scale(0.98); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }
  .modal-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
    background: var(--c-bg-2);
  }
  .head-title {
    flex: 1;
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .head-close {
    width: 28px;
    height: 28px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--c-text-muted);
    cursor: pointer;
    font-size: 14px;
  }
  .head-close:hover {
    background: var(--c-bg-3);
    color: var(--c-text);
  }

  .actions-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
  }
  .action-btn {
    background: var(--c-bg-3);
    border: 1px solid var(--c-border);
    color: var(--c-text);
    border-radius: var(--r-sm);
    padding: 5px 12px;
    font-size: var(--fs-xs);
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .action-btn:hover {
    background: var(--c-bg-4);
  }
  .action-btn.primary {
    background: var(--c-accent-soft);
    border-color: var(--c-accent-border, var(--c-accent));
    color: white;
  }
  .action-btn.primary:hover {
    background: var(--c-accent);
  }
  .ax-emoji {
    color: var(--c-text-dim);
    font-weight: 700;
  }
  .count-hint {
    margin-left: auto;
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
    font-family: var(--font-mono);
  }

  .legacy-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: var(--c-bg-2);
    border-bottom: 1px solid var(--c-border);
    font-size: var(--fs-xs);
  }
  .legacy-text {
    flex: 1;
    color: var(--c-text-muted);
  }
  .legacy-path {
    font-family: var(--font-mono);
    color: var(--c-text);
    margin-left: 4px;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .list::-webkit-scrollbar { width: 8px; }
  .list::-webkit-scrollbar-thumb {
    background: var(--c-bg-3);
    border-radius: 4px;
  }
  .list-item {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--c-bg-2);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    padding: 4px;
    transition: background var(--duration), border-color var(--duration);
  }
  .list-item:hover {
    background: var(--c-bg-3);
  }
  .list-item.selected {
    border-color: var(--c-accent);
    background: var(--c-accent-soft);
  }
  .row-pick {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    background: transparent;
    border: none;
    color: var(--c-text);
    cursor: pointer;
    padding: 4px 6px;
    min-width: 0;
    text-align: left;
  }
  .row-icon {
    font-size: 14px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }
  .row-name {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    padding: 3px 6px;
    color: var(--c-text);
    font-family: inherit;
    font-size: var(--fs-sm);
  }
  .row-name:hover {
    background: var(--c-bg-1);
    border-color: var(--c-border);
  }
  .row-name:focus {
    outline: none;
    background: var(--c-bg-1);
    border-color: var(--c-accent);
  }
  .row-path {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--c-text-dim);
    flex: 0 1 40%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }
  .row-actions {
    display: inline-flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .mini-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--c-border);
    background: var(--c-bg-3);
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    cursor: pointer;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background var(--duration), color var(--duration);
  }
  .mini-btn:hover {
    background: var(--c-bg-4);
    color: var(--c-text);
  }
  .mini-btn.danger:hover {
    background: var(--c-danger-soft);
    color: var(--c-danger);
    border-color: var(--c-danger);
  }
  .empty-state {
    text-align: center;
    color: var(--c-text-dim);
    padding: var(--sp-5) var(--sp-3);
    font-size: var(--fs-sm);
  }
</style>
