<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import type { AppSettings, SoundEntry } from "../../types";
  import {
    Button,
    Card,
    Field,
    SectionHeader,
    Slider,
    SoundPicker,
  } from "../../ui";
  import { previewAudio } from "../../ui/audio-preview";
  import { DEFAULT_BLOCK_SOUND_URL, DEFAULT_UNBLOCK_SOUND_URL } from "../../defaults";
  import {
    countSoundRefs,
    defaultNameForPath,
    newSoundId,
    resolveSoundUrl,
  } from "../../sound-library";

  export let cfg: AppSettings;

  function playBlock() {
    const url =
      resolveSoundUrl(cfg, cfg.globalBlockSoundPath) ?? DEFAULT_BLOCK_SOUND_URL;
    const off = cfg.globalBlockSoundPath ? cfg.globalBlockSoundVolumeDb : 0;
    previewAudio(url, cfg.volumeDb + off);
  }
  function playUnblock() {
    const url =
      resolveSoundUrl(cfg, cfg.globalUnblockSoundPath) ?? DEFAULT_UNBLOCK_SOUND_URL;
    const off = cfg.globalUnblockSoundPath ? cfg.globalUnblockSoundVolumeDb : 0;
    previewAudio(url, cfg.volumeDb + off);
  }

  // ===== Bibliothek-Verwaltung =====
  async function addSound() {
    try {
      const file = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }],
      });
      if (typeof file !== "string") return;
      const entry: SoundEntry = {
        id: newSoundId(),
        name: defaultNameForPath(file),
        path: file,
      };
      cfg.soundLibrary = [...cfg.soundLibrary, entry];
    } catch (e) {
      console.warn("file dialog failed", e);
    }
  }

  function renameEntry(id: string, name: string) {
    cfg.soundLibrary = cfg.soundLibrary.map((e) =>
      e.id === id ? { ...e, name: name || e.name } : e,
    );
  }

  function removeEntry(id: string) {
    const entry = cfg.soundLibrary.find((e) => e.id === id);
    const uses = countSoundRefs(cfg, id);
    const extra =
      uses > 0
        ? `\n\nDer Sound wird noch an ${uses} Stelle(n) verwendet — diese werden „leer".`
        : "";
    if (!confirm(`Sound "${entry?.name ?? id}" wirklich löschen?${extra}`)) return;
    cfg.soundLibrary = cfg.soundLibrary.filter((e) => e.id !== id);
  }

  function previewEntry(id: string) {
    const e = cfg.soundLibrary.find((x) => x.id === id);
    if (!e) return;
    previewAudio(resolveSoundUrl(cfg, `sound:${id}`), cfg.volumeDb);
  }
</script>

<SectionHeader
  title="Audio"
  description="Master-Lautstärke, Sound-Bibliothek und globale Block/Unblock-Sounds. Pro-Taste-Overrides findest du im Edit-Modus-Inspektor… (TODO)."
/>

<Card title="Lautstärke">
  <Field
    label="Master (dB)"
    hint="Beeinflusst alle Sounds. -80 = stumm, 0 = unverändert, +24 = maximal verstärkt."
  >
    <Slider
      bind:value={cfg.volumeDb}
      min={-80}
      max={24}
      step={0.5}
      format={(v) => `${v.toFixed(1)} dB`}
    />
  </Field>
  <Field hint="Testet Block- und Unblock-Sound mit der oben gewählten Lautstärke.">
    <div class="test-row">
      <Button size="sm" on:click={playBlock}>▶ Block testen</Button>
      <Button size="sm" on:click={playUnblock}>▶ Unblock testen</Button>
    </div>
  </Field>
</Card>

<Card
  title="Sound-Bibliothek"
  hint="Zentrale Liste aller Sounds. Lade einen Sound einmal hoch und referenziere ihn überall (global, pro Taste)."
>
  <div class="lib-toolbar">
    <Button variant="primary" size="sm" on:click={addSound}>
      + Sound hochladen…
    </Button>
    <span class="hint-count">
      {cfg.soundLibrary.length} Eintrag{cfg.soundLibrary.length === 1 ? "" : "e"}
    </span>
  </div>

  {#if cfg.soundLibrary.length === 0}
    <div class="empty">Noch keine Sounds in der Bibliothek.</div>
  {:else}
    <div class="lib-list">
      {#each cfg.soundLibrary as entry (entry.id)}
        {@const uses = countSoundRefs(cfg, entry.id)}
        <div class="lib-row">
          <span class="row-icon">🔊</span>
          <input
            type="text"
            class="row-name"
            value={entry.name}
            on:change={(e) => renameEntry(entry.id, e.currentTarget.value)}
            on:blur={(e) => renameEntry(entry.id, e.currentTarget.value)}
          />
          <span class="row-uses">{uses > 0 ? `${uses}× verwendet` : "ungenutzt"}</span>
          <span class="row-path" title={entry.path}>{entry.path}</span>
          <button class="mini-btn" on:click={() => previewEntry(entry.id)} title="Vorhören">▶</button>
          <button class="mini-btn danger" on:click={() => removeEntry(entry.id)} title="Löschen">✕</button>
        </div>
      {/each}
    </div>
  {/if}
</Card>

<Card
  title="Globale Block/Unblock-Sounds"
  hint="Werden gespielt, wenn eine Taste keinen eigenen Sound zugewiesen hat. Pro-Taste-Overrides findest du in der Tasten-Sektion (im Webhook-Tab)."
>
  <Field label="Block-Sound">
    <SoundPicker
      value={cfg.globalBlockSoundPath}
      placeholder="Default (block.mp3)"
      volumeDb={cfg.globalBlockSoundVolumeDb}
      on:change={(e) => (cfg.globalBlockSoundPath = e.detail)}
      on:volumeChange={(e) => (cfg.globalBlockSoundVolumeDb = e.detail)}
    />
  </Field>
  <Field label="Unblock-Sound">
    <SoundPicker
      value={cfg.globalUnblockSoundPath}
      placeholder="Default (unblock.mp3)"
      volumeDb={cfg.globalUnblockSoundVolumeDb}
      on:change={(e) => (cfg.globalUnblockSoundPath = e.detail)}
      on:volumeChange={(e) => (cfg.globalUnblockSoundVolumeDb = e.detail)}
    />
  </Field>
</Card>

<Card title="Pro-Taste-Override (optional)">
  <p class="hint-text">
    Eine Taste kann ihren eigenen Block/Unblock-Sound erhalten, der den globalen
    überschreibt. Lass das Feld leer, um den globalen Default zu verwenden.
  </p>
  {#each cfg.keys as key, i (key.id)}
    <div class="key-row">
      <span class="kbox">{key.label}</span>
      <div class="picker-stack">
        <Field label={`Block-Sound (${key.id})`}>
          <SoundPicker
            value={key.blockSoundPath}
            placeholder="Global verwenden"
            volumeDb={key.blockSoundVolumeDb}
            on:change={(e) => {
              cfg.keys = cfg.keys.map((k, j) => j === i ? { ...k, blockSoundPath: e.detail } : k);
            }}
            on:volumeChange={(e) => {
              cfg.keys = cfg.keys.map((k, j) => j === i ? { ...k, blockSoundVolumeDb: e.detail } : k);
            }}
          />
        </Field>
        <Field label={`Unblock-Sound (${key.id})`}>
          <SoundPicker
            value={key.unblockSoundPath}
            placeholder="Global verwenden"
            volumeDb={key.unblockSoundVolumeDb}
            on:change={(e) => {
              cfg.keys = cfg.keys.map((k, j) => j === i ? { ...k, unblockSoundPath: e.detail } : k);
            }}
            on:volumeChange={(e) => {
              cfg.keys = cfg.keys.map((k, j) => j === i ? { ...k, unblockSoundVolumeDb: e.detail } : k);
            }}
          />
        </Field>
      </div>
    </div>
  {/each}
</Card>

<style>
  .test-row {
    display: flex;
    gap: var(--sp-2);
  }
  .lib-toolbar {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-bottom: var(--sp-2);
  }
  .hint-count {
    font-size: var(--fs-xs);
    color: var(--c-text-dim);
    font-family: var(--font-mono);
  }
  .empty {
    color: var(--c-text-dim);
    font-style: italic;
    font-size: var(--fs-sm);
    padding: var(--sp-2) 0;
  }
  .lib-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lib-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 8px;
  }
  .row-icon {
    width: 20px;
    text-align: center;
  }
  .row-name {
    flex: 1;
    min-width: 100px;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    padding: 4px 8px;
    font-family: inherit;
    font-size: var(--fs-sm);
  }
  .row-name:focus {
    outline: none;
    border-color: var(--c-accent);
  }
  .row-uses {
    font-size: 10px;
    color: var(--c-text-dim);
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .row-path {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--c-text-dim);
    flex: 0 1 35%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
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
  .hint-text {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    margin: 0 0 var(--sp-3);
  }
  .key-row {
    display: flex;
    gap: var(--sp-3);
    padding: var(--sp-3);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    margin-bottom: var(--sp-2);
  }
  .kbox {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    font-weight: 700;
    color: var(--c-text);
  }
  .picker-stack {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-width: 0;
  }
</style>
