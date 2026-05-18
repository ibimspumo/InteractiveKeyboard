<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";

  import {
    settings,
    settingsOpen,
    keyRuntimes,
    loadSettings,
    saveSettings,
    bindBackendEvents,
    applyBlock,
    applyUnblock,
    applyReset,
    tickRuntimes,
    syncBlockedKeysToBackend,
    buildStatus,
  } from "./lib/stores";
  import type { AppSettings, KeyDef } from "./lib/types";
  import { aspectForLayout, rgbaToCss } from "./lib/defaults";
  import Keyboard from "./lib/overlay/Keyboard.svelte";
  import Mouse from "./lib/overlay/Mouse.svelte";
  import Settings from "./lib/settings/Settings.svelte";
  import Design from "./lib/design/Design.svelte";
  import Editor from "./lib/editor/Editor.svelte";
  import { rebuildSchemas } from "./lib/design/schemas";
  import { primeAudioContext } from "./lib/audio-pool";

  let cfg: AppSettings = $settings;
  let runtimes = $keyRuntimes;
  let isSettingsOpen = false;
  let editMode = false;
  let designMode = false;

  $: cfg = $settings;
  $: runtimes = $keyRuntimes;
  $: isSettingsOpen = $settingsOpen;
  $: rebuildSchemas(cfg);

  // Aspect-Lock dynamisch je Layout-Mode (1:1 oder 2:1).
  let windowHeight = window.innerHeight;
  let snapping = false;
  let lastSnappedMode = cfg.layoutMode;

  async function snapAspect() {
    if (snapping) return;
    snapping = true;
    try {
      const aspect = aspectForLayout(cfg.layoutMode); // breite/höhe
      // Ziel-Höhe: das kleinere von windowHeight und windowWidth/aspect.
      const targetH = Math.min(window.innerHeight, window.innerWidth / aspect);
      const targetW = targetH * aspect;
      if (
        Math.abs(window.innerWidth - targetW) > 0.5 ||
        Math.abs(window.innerHeight - targetH) > 0.5
      ) {
        const win = getCurrentWindow();
        const scaleFactor = (await win.scaleFactor()) || 1;
        await win.setSize(
          new PhysicalSize(
            Math.round(targetW * scaleFactor),
            Math.round(targetH * scaleFactor),
          ),
        );
      }
    } catch (e) {
      console.warn("aspect snap failed", e);
    } finally {
      snapping = false;
    }
  }

  // Bei Layout-Mode-Wechsel: Fenster auf passende Default-Größe setzen
  // (250 Ref-Einheiten Höhe → ähnliche Pixelgröße wie zuvor) UND aspect snappen.
  async function applyLayoutMode() {
    try {
      const aspect = aspectForLayout(cfg.layoutMode);
      const win = getCurrentWindow();
      const scaleFactor = (await win.scaleFactor()) || 1;
      // Höhe behalten falls schon gesetzt, sonst auf 500 Default.
      const curH = Math.max(window.innerHeight, 250);
      const targetH = curH;
      const targetW = targetH * aspect;
      await win.setSize(
        new PhysicalSize(
          Math.round(targetW * scaleFactor),
          Math.round(targetH * scaleFactor),
        ),
      );
    } catch (e) {
      console.warn("apply layout mode failed", e);
    }
  }

  // Watch: wenn sich layoutMode ändert, neu snappen und Maus-Position ggf. neu setzen.
  $: if (cfg.layoutMode !== lastSnappedMode) {
    lastSnappedMode = cfg.layoutMode;
    applyLayoutMode();
  }

  function onResize() {
    windowHeight = window.innerHeight;
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = setTimeout(() => snapAspect(), 120);
  }
  let snapTimer: ReturnType<typeof setTimeout> | null = null;

  function onKeyDown(e: KeyboardEvent) {
    primeAudioContext();
    if (e.key === "Escape") {
      if (designMode) {
        designMode = false;
        saveSettings(cfg);
        return;
      }
      if (editMode) {
        editMode = false;
        saveSettings(cfg);
        return;
      }
      isSettingsOpen = !isSettingsOpen;
      settingsOpen.set(isSettingsOpen);
      return;
    }
    if (isSettingsOpen) return;
    if (e.key === "d" || e.key === "D") {
      designMode = !designMode;
      if (designMode) editMode = false;
      if (!designMode) saveSettings(cfg);
    } else if (e.key === "e" || e.key === "E") {
      editMode = !editMode;
      if (editMode) designMode = false;
      if (!editMode) saveSettings(cfg);
    }
  }

  let rafHandle: number | null = null;
  function tick() {
    tickRuntimes();
    rafHandle = requestAnimationFrame(tick);
  }

  function onSettingsSave(e: CustomEvent<AppSettings>) {
    const next = e.detail;
    settings.set(next);
    saveSettings(next);
    isSettingsOpen = false;
    settingsOpen.set(false);
  }
  function onSettingsClose() {
    isSettingsOpen = false;
    settingsOpen.set(false);
  }

  async function onStatusRequest(replyId: string) {
    const ac = await invoke<boolean>("anticheat_running").catch(() => false);
    const status = buildStatus(ac);
    await invoke("status_reply", { replyId, status }).catch(console.error);
  }

  function onEditChangeKey(keyId: string, patch: Partial<KeyDef>) {
    settings.update((s) => ({
      ...s,
      keys: s.keys.map((k) => (k.id === keyId ? { ...k, ...patch } : k)),
    }));
  }

  function onEditChangeMouse(patch: Partial<AppSettings["mouse"]>) {
    settings.update((s) => ({ ...s, mouse: { ...s.mouse, ...patch } }));
  }

  function onEditChangeMouseButton(
    buttonId: string,
    patch: Partial<AppSettings["mouse"]["buttons"][number]>,
  ) {
    settings.update((s) => ({
      ...s,
      mouse: {
        ...s.mouse,
        buttons: s.mouse.buttons.map((b) =>
          b.id === buttonId ? { ...b, ...patch } : b,
        ),
      },
    }));
  }

  function onWebhookBlock(keyId: string, durationSec: number) {
    invoke<boolean>("anticheat_running")
      .then((active) => {
        if (active) {
          console.warn(`[block] Anti-Cheat aktiv — Block für ${keyId} verworfen.`);
          return;
        }
        applyBlock(keyId, durationSec);
      })
      .catch(() => applyBlock(keyId, durationSec));
  }

  onMount(async () => {
    await loadSettings();
    rebuildSchemas($settings);
    lastSnappedMode = $settings.layoutMode;
    await bindBackendEvents({
      onBlock: onWebhookBlock,
      onUnblock: applyUnblock,
      onReset: applyReset,
      onStatusRequest,
    });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    await snapAspect();
    syncBlockedKeysToBackend();
    rafHandle = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
  });

  $: bgCss = rgbaToCss(cfg.backgroundColor);
  // Skalierung: window-px-pro-ref-px. Wir nehmen Höhe (immer 500 Ref-px) als
  // Referenz, damit Tastatur und Maus konsistent groß bleiben unabhängig vom
  // Layout-Modus.
  $: scale = windowHeight / 500;

  $: showKeyboard = cfg.layoutMode === "keyboard" || cfg.layoutMode === "keyboard+mouse";
  $: showMouse = cfg.layoutMode === "mouse" || cfg.layoutMode === "keyboard+mouse";
</script>

<main
  class="root"
  style="background: {bgCss};"
  data-tauri-drag-region={editMode || designMode || isSettingsOpen ? null : true}
>
  {#if showKeyboard}
    <Keyboard
      {cfg}
      {runtimes}
      {editMode}
      {designMode}
      {scale}
    />
  {/if}

  {#if showMouse}
    <Mouse
      {cfg}
      {runtimes}
      {editMode}
      {designMode}
      {scale}
      giftEditable={editMode}
    />
  {/if}

  {#if designMode}
    <Design
      {cfg}
      on:done={() => {
        designMode = false;
        saveSettings(cfg);
      }}
    />
  {/if}

  {#if editMode}
    <Editor
      {cfg}
      {scale}
      onChangeKey={onEditChangeKey}
      onChangeMouse={onEditChangeMouse}
      onChangeMouseButton={onEditChangeMouseButton}
      on:done={() => {
        editMode = false;
        saveSettings(cfg);
      }}
    />
  {/if}

  {#if isSettingsOpen}
    <Settings {cfg} on:save={onSettingsSave} on:close={onSettingsClose} />
  {/if}
</main>

<style>
  .root {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }
</style>
