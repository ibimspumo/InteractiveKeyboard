<script lang="ts">
  import { check, type Update } from "@tauri-apps/plugin-updater";
  import { relaunch } from "@tauri-apps/plugin-process";
  import { APP_VERSION } from "../../version";
  import { Button, Callout, Card, SectionHeader } from "../../ui";

  type State =
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "up-to-date" }
    | { kind: "available"; update: Update }
    | { kind: "downloading"; progress: number; total: number | null }
    | { kind: "installing" }
    | { kind: "done"; willRestart: boolean }
    | { kind: "error"; message: string };

  let state: State = { kind: "idle" };

  async function checkForUpdate() {
    state = { kind: "checking" };
    try {
      const update = await check();
      state = update ? { kind: "available", update } : { kind: "up-to-date" };
    } catch (err) {
      state = { kind: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  async function downloadAndInstall() {
    if (state.kind !== "available") return;
    const update = state.update;
    state = { kind: "downloading", progress: 0, total: null };

    let downloaded = 0;
    let total: number | null = null;

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? null;
            state = { kind: "downloading", progress: 0, total };
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            state = { kind: "downloading", progress: downloaded, total };
            break;
          case "Finished":
            state = { kind: "installing" };
            break;
        }
      });
      state = { kind: "done", willRestart: true };
      setTimeout(() => relaunch().catch(console.error), 1500);
    } catch (err) {
      state = { kind: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  function fmtBytes(n: number | null): string {
    if (n === null) return "?";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function percent(s: Extract<State, { kind: "downloading" }>): number {
    if (!s.total) return 0;
    return Math.min(100, Math.round((s.progress / s.total) * 100));
  }
</script>

<SectionHeader
  title="Updates"
  description="Updates werden über die GitHub-Releases des Projekts verteilt und signiert verifiziert."
/>

<Card>
  <div class="version-row">
    <span class="label">Installierte Version</span>
    <span class="version">v{APP_VERSION}</span>
  </div>

  {#if state.kind === "idle"}
    <Button variant="primary" on:click={checkForUpdate}>Nach Updates suchen</Button>
  {:else if state.kind === "checking"}
    <Button variant="primary" disabled>Suche läuft…</Button>
  {:else if state.kind === "up-to-date"}
    <Callout variant="success">Du bist auf der neuesten Version.</Callout>
    <Button variant="secondary" on:click={checkForUpdate}>Erneut prüfen</Button>
  {:else if state.kind === "available"}
    <Callout variant="info">
      <strong>Update verfügbar: v{state.update.version}</strong>
      {#if state.update.date}
        <div class="meta">Veröffentlicht: {state.update.date}</div>
      {/if}
      {#if state.update.body}
        <pre class="changelog">{state.update.body}</pre>
      {/if}
    </Callout>
    <div class="button-row">
      <Button variant="primary" on:click={downloadAndInstall}>
        Herunterladen &amp; installieren
      </Button>
      <Button variant="ghost" on:click={() => (state = { kind: "idle" })}>
        Später
      </Button>
    </div>
  {:else if state.kind === "downloading"}
    <Callout variant="info">
      Lade herunter… {fmtBytes(state.progress)}
      {#if state.total}/ {fmtBytes(state.total)} ({percent(state)}%){/if}
      <div class="progress-bar">
        <div class="progress-fill" style="width: {state.total ? percent(state) : 100}%"></div>
      </div>
    </Callout>
  {:else if state.kind === "installing"}
    <Callout variant="info">Installiere Update…</Callout>
  {:else if state.kind === "done"}
    <Callout variant="success">Update installiert. Die App startet gleich neu…</Callout>
  {:else if state.kind === "error"}
    <Callout variant="error">Fehler: {state.message}</Callout>
    <Button variant="secondary" on:click={() => (state = { kind: "idle" })}>
      Erneut versuchen
    </Button>
  {/if}
</Card>

<style>
  .version-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: var(--sp-2);
    border-bottom: 1px solid var(--c-border);
  }
  .label {
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }
  .version {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    color: var(--c-text);
    font-weight: 600;
  }
  .button-row {
    display: flex;
    gap: var(--sp-2);
  }
  .meta {
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    margin-top: var(--sp-1);
  }
  .changelog {
    margin-top: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: rgba(0, 0, 0, 0.35);
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    color: var(--c-text);
    white-space: pre-wrap;
    font-family: var(--font-mono);
    max-height: 200px;
    overflow-y: auto;
  }
  .progress-bar {
    margin-top: var(--sp-2);
    height: 6px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--c-accent);
    transition: width 0.15s ease-out;
  }
</style>
