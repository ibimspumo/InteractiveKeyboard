<script lang="ts">
  // Edit-Modus: Gift-Icons + (optional) Tasten und Maus-Körper verschieben/skalieren.
  //
  // Funktionsweise:
  //  - Standardmäßig editieren wir nur die Gift-Icons (Drag verschiebt, Eck-
  //    Handles skalieren). Das gilt sowohl für Tasten-Gifts (KeyDef.giftOffset*)
  //    als auch für Maus-Sub-Button-Gifts (MouseButtonDef.giftOffset*).
  //  - Mit dem "Layout"-Toggle in der Toolbar werden Tasten und der Maus-Körper
  //    selbst freigegeben: dann zeigen sich zusätzlich Hit-Zonen über jeder
  //    Taste / über dem Maus-Körper, die per Drag die Positionen aktualisieren.
  //  - Maus-Sub-Buttons (LMB/RMB/WHEEL) haben FIXE Positionen innerhalb der
  //    Maus-Bbox — verschiebbar ist nur der Maus-Körper als Ganzes.
  //  - SelectedId-Format:
  //      "gift:<keyId>"        — Tasten-Gift
  //      "key:<keyId>"         — Taste
  //      "mgift:<buttonId>"    — Maus-Button-Gift
  //      "mbox"                — Maus-Körper
  //
  // Eck-Handles am Gift: gegenüberliegende Ecke ist Anker (bleibt im Screen-Raum
  // unbewegt), neue giftScale + giftOffsets werden so berechnet, dass der Anker
  // fix bleibt. Funktioniert für Tasten- wie Maus-Gifts gleich, weil beide
  // mit der Basis-Pixelgröße 64*scale*giftScale rendern.

  import { createEventDispatcher, onMount, onDestroy, tick } from "svelte";
  import type { AppSettings, KeyDef, MouseButtonDef, MouseDef } from "../types";

  export let cfg: AppSettings;
  export let scale: number; // window-px-pro-ref-px
  export let onChangeKey: (keyId: string, patch: Partial<KeyDef>) => void;
  export let onChangeMouse: (patch: Partial<MouseDef>) => void = (_p) => {};
  export let onChangeMouseButton: (
    buttonId: string,
    patch: Partial<MouseButtonDef>,
  ) => void = (_id, _p) => {};

  const dispatch = createEventDispatcher<{ done: void }>();

  // ViewBox-Konstanten müssen mit Mouse.svelte übereinstimmen.
  const VIEW_W = 300;
  const VIEW_H = 420;
  // Maus-Button-Center in viewBox-lokalen Koordinaten — analog zu Mouse.svelte.
  const MOUSE_CENTERS: Record<string, { cx: number; cy: number }> = {
    LMB: { cx: 75, cy: 100 },
    RMB: { cx: 225, cy: 100 },
    WHEEL: { cx: 150, cy: 60 },
  };

  type Rect = { left: number; top: number; width: number; height: number };
  type GiftTarget = {
    kind: "gift";
    selId: string;
    keyId: string;
    label: string;
    rect: Rect;
  };
  type KeyTarget = {
    kind: "key";
    selId: string;
    keyId: string;
    label: string;
    rect: Rect;
  };
  type MouseGiftTarget = {
    kind: "mgift";
    selId: string;
    buttonId: string;
    label: string;
    rect: Rect;
  };
  type MouseBoxTarget = {
    kind: "mbox";
    selId: string;
    label: string;
    rect: Rect;
  };

  let giftTargets: GiftTarget[] = [];
  let keyTargets: KeyTarget[] = [];
  let mouseGiftTargets: MouseGiftTarget[] = [];
  let mouseBoxTarget: MouseBoxTarget | null = null;
  let selectedId: string | null = null;
  let rafHandle: number | null = null;

  // Toggle: Layout-Elemente (Tasten + Maus-Körper) selbst verschieben.
  let layoutMovable: boolean = false;
  $: if (!layoutMovable && (selectedId?.startsWith("key:") || selectedId === "mbox")) {
    selectedId = null;
  }

  function rectOf(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // Maus-Button-Labels für UI-Anzeige.
  const MOUSE_BUTTON_LABEL: Record<string, string> = {
    LMB: "Linksklick",
    RMB: "Rechtsklick",
    WHEEL: "Mausrad",
  };

  function rescan() {
    const gifts: GiftTarget[] = [];
    const keys: KeyTarget[] = [];
    for (const k of cfg.keys) {
      const keyEl = document.querySelector<HTMLElement>(`[data-design-target="key.${k.id}"]`);
      if (!keyEl) continue;
      const keyRect = rectOf(keyEl);
      keys.push({ kind: "key", selId: `key:${k.id}`, keyId: k.id, label: k.label, rect: keyRect });
      const giftEl = document.querySelector<HTMLElement>(`[data-design-target="key.${k.id}.gift"]`);
      if (giftEl) {
        gifts.push({ kind: "gift", selId: `gift:${k.id}`, keyId: k.id, label: k.label, rect: rectOf(giftEl) });
      }
    }
    giftTargets = gifts;
    keyTargets = keys;

    // Maus: Bbox + drei Sub-Gifts (sofern sichtbar im aktuellen Layout)
    const mouseEl = document.querySelector<HTMLElement>(`[data-design-target="mouse"]`);
    if (mouseEl) {
      mouseBoxTarget = {
        kind: "mbox",
        selId: "mbox",
        label: "Maus",
        rect: rectOf(mouseEl),
      };
    } else {
      mouseBoxTarget = null;
    }
    const mGifts: MouseGiftTarget[] = [];
    for (const b of cfg.mouse.buttons) {
      const el = document.querySelector<HTMLElement>(`[data-design-target="mouse.${b.id}.gift"]`);
      if (el) {
        mGifts.push({
          kind: "mgift",
          selId: `mgift:${b.id}`,
          buttonId: b.id,
          label: `Maus ${MOUSE_BUTTON_LABEL[b.id] ?? b.id}`,
          rect: rectOf(el),
        });
      }
    }
    mouseGiftTargets = mGifts;
  }

  function loop() {
    rescan();
    rafHandle = requestAnimationFrame(loop);
  }

  onMount(async () => {
    await tick();
    rescan();
    rafHandle = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
  onDestroy(() => {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  });

  type Handle = "nw" | "ne" | "sw" | "se";
  const HANDLES: Handle[] = ["nw", "ne", "sw", "se"];

  type Drag =
    | { type: "idle" }
    | {
        type: "moveGift";
        keyId: string;
        startX: number;
        startY: number;
        startOffsetX: number;
        startOffsetY: number;
      }
    | {
        type: "moveKey";
        keyId: string;
        startX: number;
        startY: number;
        startKeyX: number;
        startKeyY: number;
      }
    | {
        type: "resizeGift";
        keyId: string;
        handle: Handle;
        startX: number;
        startY: number;
        anchorX: number;
        anchorY: number;
        startScale: number;
        keyCenterRefX: number;
        keyCenterRefY: number;
      }
    | {
        type: "moveMouseGift";
        buttonId: string;
        startX: number;
        startY: number;
        startOffsetX: number;
        startOffsetY: number;
        // boxW in screen-px zum Zeitpunkt des Drag-Starts (für stabile Konversion).
        boxW: number;
        boxH: number;
      }
    | {
        type: "resizeMouseGift";
        buttonId: string;
        handle: Handle;
        startX: number;
        startY: number;
        anchorX: number;
        anchorY: number;
        startScale: number;
        // Button-Center in Screen-px (Anker zur Berechnung neuer Offsets).
        buttonCenterScreenX: number;
        buttonCenterScreenY: number;
        boxW: number;
        boxH: number;
      }
    | {
        type: "moveMouseBox";
        startX: number;
        startY: number;
        startMouseX: number;
        startMouseY: number;
      };
  let drag: Drag = { type: "idle" };

  // === Keyboard-Gift ===
  function startMoveGift(e: PointerEvent, keyId: string) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = `gift:${keyId}`;
    const k = cfg.keys.find((kk) => kk.id === keyId);
    if (!k) return;
    drag = {
      type: "moveGift",
      keyId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: k.giftOffsetX,
      startOffsetY: k.giftOffsetY,
    };
  }

  function startMoveKey(e: PointerEvent, keyId: string) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = `key:${keyId}`;
    const k = cfg.keys.find((kk) => kk.id === keyId);
    if (!k) return;
    drag = {
      type: "moveKey",
      keyId,
      startX: e.clientX,
      startY: e.clientY,
      startKeyX: k.x,
      startKeyY: k.y,
    };
  }

  function startResizeGift(e: PointerEvent, keyId: string, handle: Handle) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = `gift:${keyId}`;
    const k = cfg.keys.find((kk) => kk.id === keyId);
    const t = giftTargets.find((x) => x.keyId === keyId);
    if (!k || !t) return;
    const b = t.rect;
    const anchorX = handle === "nw" || handle === "sw" ? b.left + b.width : b.left;
    const anchorY = handle === "nw" || handle === "ne" ? b.top + b.height : b.top;
    drag = {
      type: "resizeGift",
      keyId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      anchorX,
      anchorY,
      startScale: k.giftScale,
      keyCenterRefX: k.x + k.width / 2,
      keyCenterRefY: k.y + k.height / 2,
    };
  }

  // === Maus-Gift ===
  function startMoveMouseGift(e: PointerEvent, buttonId: string) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = `mgift:${buttonId}`;
    const b = cfg.mouse.buttons.find((bb) => bb.id === buttonId);
    if (!b || !mouseBoxTarget) return;
    drag = {
      type: "moveMouseGift",
      buttonId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: b.giftOffsetX,
      startOffsetY: b.giftOffsetY,
      boxW: mouseBoxTarget.rect.width,
      boxH: mouseBoxTarget.rect.height,
    };
  }

  function startResizeMouseGift(e: PointerEvent, buttonId: string, handle: Handle) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = `mgift:${buttonId}`;
    const btn = cfg.mouse.buttons.find((bb) => bb.id === buttonId);
    const t = mouseGiftTargets.find((x) => x.buttonId === buttonId);
    if (!btn || !t || !mouseBoxTarget) return;
    const b = t.rect;
    const anchorX = handle === "nw" || handle === "sw" ? b.left + b.width : b.left;
    const anchorY = handle === "nw" || handle === "ne" ? b.top + b.height : b.top;
    const center = MOUSE_CENTERS[buttonId] ?? { cx: VIEW_W / 2, cy: VIEW_H / 2 };
    const buttonCenterScreenX =
      mouseBoxTarget.rect.left + (center.cx / VIEW_W) * mouseBoxTarget.rect.width;
    const buttonCenterScreenY =
      mouseBoxTarget.rect.top + (center.cy / VIEW_H) * mouseBoxTarget.rect.height;
    drag = {
      type: "resizeMouseGift",
      buttonId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      anchorX,
      anchorY,
      startScale: btn.giftScale,
      buttonCenterScreenX,
      buttonCenterScreenY,
      boxW: mouseBoxTarget.rect.width,
      boxH: mouseBoxTarget.rect.height,
    };
  }

  // === Maus-Bbox ===
  function startMoveMouseBox(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = "mbox";
    drag = {
      type: "moveMouseBox",
      startX: e.clientX,
      startY: e.clientY,
      startMouseX: cfg.mouse.x,
      startMouseY: cfg.mouse.y,
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (drag.type === "idle") return;

    if (drag.type === "moveGift") {
      const dxRef = (e.clientX - drag.startX) / scale;
      const dyRef = (e.clientY - drag.startY) / scale;
      onChangeKey(drag.keyId, {
        giftOffsetX: Math.round(drag.startOffsetX + dxRef),
        giftOffsetY: Math.round(drag.startOffsetY + dyRef),
      });
      return;
    }

    if (drag.type === "moveKey") {
      const dxRef = (e.clientX - drag.startX) / scale;
      const dyRef = (e.clientY - drag.startY) / scale;
      onChangeKey(drag.keyId, {
        x: Math.round(drag.startKeyX + dxRef),
        y: Math.round(drag.startKeyY + dyRef),
      });
      return;
    }

    if (drag.type === "resizeGift") {
      const sx0 = drag.startX - drag.anchorX;
      const sy0 = drag.startY - drag.anchorY;
      const startDist = Math.hypot(sx0, sy0);
      if (startDist < 1) return;

      const sx = e.clientX - drag.anchorX;
      const sy = e.clientY - drag.anchorY;
      const dot = (sx * sx0 + sy * sy0) / startDist;
      const signedDist = Math.max(0, dot);
      const factor = signedDist / startDist;

      const minScale = 0.05;
      const maxScale = 8;
      const newScale = Math.max(
        minScale,
        Math.min(maxScale, +(drag.startScale * factor).toFixed(3)),
      );

      const newSizeScreen = 64 * newScale * scale;
      let newLeftScreen: number;
      let newTopScreen: number;
      switch (drag.handle) {
        case "se":
          newLeftScreen = drag.anchorX;
          newTopScreen = drag.anchorY;
          break;
        case "sw":
          newLeftScreen = drag.anchorX - newSizeScreen;
          newTopScreen = drag.anchorY;
          break;
        case "ne":
          newLeftScreen = drag.anchorX;
          newTopScreen = drag.anchorY - newSizeScreen;
          break;
        case "nw":
        default:
          newLeftScreen = drag.anchorX - newSizeScreen;
          newTopScreen = drag.anchorY - newSizeScreen;
          break;
      }

      const newCenterX_ref = (newLeftScreen + newSizeScreen / 2) / scale;
      const newCenterY_ref = (newTopScreen + newSizeScreen / 2) / scale;
      onChangeKey(drag.keyId, {
        giftScale: newScale,
        giftOffsetX: Math.round(newCenterX_ref - drag.keyCenterRefX),
        giftOffsetY: Math.round(newCenterY_ref - drag.keyCenterRefY),
      });
      return;
    }

    if (drag.type === "moveMouseGift") {
      // Maus-Gift-Offset ist in viewBox-lokalen Units (0..VIEW_W,0..VIEW_H).
      // Delta in screen-px → relative Frac der Wrap-Größe → * VIEW_*
      const dxScreen = e.clientX - drag.startX;
      const dyScreen = e.clientY - drag.startY;
      const dxLocal = (dxScreen / drag.boxW) * VIEW_W;
      const dyLocal = (dyScreen / drag.boxH) * VIEW_H;
      onChangeMouseButton(drag.buttonId, {
        giftOffsetX: Math.round(drag.startOffsetX + dxLocal),
        giftOffsetY: Math.round(drag.startOffsetY + dyLocal),
      });
      return;
    }

    if (drag.type === "resizeMouseGift") {
      const sx0 = drag.startX - drag.anchorX;
      const sy0 = drag.startY - drag.anchorY;
      const startDist = Math.hypot(sx0, sy0);
      if (startDist < 1) return;

      const sx = e.clientX - drag.anchorX;
      const sy = e.clientY - drag.anchorY;
      const dot = (sx * sx0 + sy * sy0) / startDist;
      const signedDist = Math.max(0, dot);
      const factor = signedDist / startDist;

      const minScale = 0.05;
      const maxScale = 8;
      const newScale = Math.max(
        minScale,
        Math.min(maxScale, +(drag.startScale * factor).toFixed(3)),
      );

      const newSizeScreen = 64 * newScale * scale;
      let newLeftScreen: number;
      let newTopScreen: number;
      switch (drag.handle) {
        case "se":
          newLeftScreen = drag.anchorX;
          newTopScreen = drag.anchorY;
          break;
        case "sw":
          newLeftScreen = drag.anchorX - newSizeScreen;
          newTopScreen = drag.anchorY;
          break;
        case "ne":
          newLeftScreen = drag.anchorX;
          newTopScreen = drag.anchorY - newSizeScreen;
          break;
        case "nw":
        default:
          newLeftScreen = drag.anchorX - newSizeScreen;
          newTopScreen = drag.anchorY - newSizeScreen;
          break;
      }

      const newCenterX_screen = newLeftScreen + newSizeScreen / 2;
      const newCenterY_screen = newTopScreen + newSizeScreen / 2;
      // Delta vom Button-Center → viewBox-lokale Units
      const newOffX = ((newCenterX_screen - drag.buttonCenterScreenX) / drag.boxW) * VIEW_W;
      const newOffY = ((newCenterY_screen - drag.buttonCenterScreenY) / drag.boxH) * VIEW_H;
      onChangeMouseButton(drag.buttonId, {
        giftScale: newScale,
        giftOffsetX: Math.round(newOffX),
        giftOffsetY: Math.round(newOffY),
      });
      return;
    }

    if (drag.type === "moveMouseBox") {
      const dxRef = (e.clientX - drag.startX) / scale;
      const dyRef = (e.clientY - drag.startY) / scale;
      onChangeMouse({
        x: Math.round(drag.startMouseX + dxRef),
        y: Math.round(drag.startMouseY + dyRef),
      });
      return;
    }
  }

  function onPointerUp() {
    drag = { type: "idle" };
  }

  function onBackdrop(e: PointerEvent) {
    if (e.target === e.currentTarget) {
      selectedId = null;
    }
  }

  // === Toolbar-Aktionen ===
  type SelKind = "gift" | "key" | "mgift" | "mbox" | null;
  function selectedKind(): SelKind {
    if (!selectedId) return null;
    if (selectedId === "mbox") return "mbox";
    if (selectedId.startsWith("gift:")) return "gift";
    if (selectedId.startsWith("key:")) return "key";
    if (selectedId.startsWith("mgift:")) return "mgift";
    return null;
  }
  function selectedSubId(): string | null {
    if (!selectedId || selectedId === "mbox") return null;
    return selectedId.split(":")[1] ?? null;
  }

  function resetSelectedPosition() {
    const kind = selectedKind();
    const id = selectedSubId();
    if (kind === "gift" && id) {
      onChangeKey(id, { giftOffsetX: 0, giftOffsetY: 0 });
    } else if (kind === "key" && id) {
      const k = cfg.keys.find((kk) => kk.id === id);
      if (!k) return;
      onChangeKey(id, { x: Math.round(250 - k.width / 2) });
    } else if (kind === "mgift" && id) {
      onChangeMouseButton(id, { giftOffsetX: 0, giftOffsetY: 0 });
    } else if (kind === "mbox") {
      // Maus auf default-Position für aktuellen Layout-Modus zurücksetzen
      const mode = cfg.layoutMode;
      const w = cfg.mouse.width;
      const h = cfg.mouse.height;
      let x = 0;
      let y = (500 - h) / 2;
      if (mode === "mouse") x = (500 - w) / 2;
      else x = 500 + (500 - w) / 2;
      onChangeMouse({ x: Math.round(x), y: Math.round(y) });
    }
  }

  function resetScaleSelected() {
    const kind = selectedKind();
    const id = selectedSubId();
    if (kind === "gift" && id) {
      onChangeKey(id, { giftScale: 1 });
    } else if (kind === "mgift" && id) {
      onChangeMouseButton(id, { giftScale: 1 });
    }
  }

  function done() {
    dispatch("done");
  }

  function cursorFor(h: Handle): string {
    return h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize";
  }

  $: selectedGiftTarget =
    selectedKind() === "gift"
      ? giftTargets.find((t) => t.keyId === selectedSubId())
      : undefined;
  $: selectedMouseGiftTarget =
    selectedKind() === "mgift"
      ? mouseGiftTargets.find((t) => t.buttonId === selectedSubId())
      : undefined;
  $: selectedKey = (() => {
    const id = selectedSubId();
    if (!id) return null;
    if (selectedKind() === "gift" || selectedKind() === "key") {
      return cfg.keys.find((k) => k.id === id) ?? null;
    }
    return null;
  })();
  $: selectedMouseButton = (() => {
    const id = selectedSubId();
    if (!id || selectedKind() !== "mgift") return null;
    return cfg.mouse.buttons.find((b) => b.id === id) ?? null;
  })();

  // Headline für Toolbar
  $: selectionTitle = (() => {
    const k = selectedKind();
    if (!k) return "";
    if (k === "gift" && selectedKey) return `Gift ${selectedKey.label}`;
    if (k === "key" && selectedKey) return `Taste ${selectedKey.label}`;
    if (k === "mgift" && selectedMouseButton)
      return `Maus-Gift ${MOUSE_BUTTON_LABEL[selectedMouseButton.id] ?? selectedMouseButton.id}`;
    if (k === "mbox") return "Maus-Körper";
    return "";
  })();
  $: scaleReadout = (() => {
    if (selectedKind() === "gift" && selectedKey) return selectedKey.giftScale.toFixed(2);
    if (selectedKind() === "mgift" && selectedMouseButton)
      return selectedMouseButton.giftScale.toFixed(2);
    return null;
  })();
</script>

<div class="ed-root" on:pointerdown={onBackdrop} role="presentation">
  <!-- Tasten-Outlines (immer sichtbar, zur Orientierung) -->
  {#each keyTargets as t (t.keyId)}
    <div
      class="key-outline"
      class:movable={layoutMovable}
      style="
        left: {t.rect.left}px;
        top: {t.rect.top}px;
        width: {t.rect.width}px;
        height: {t.rect.height}px;
      "
    ></div>
  {/each}

  <!-- Maus-Outline (immer sichtbar wenn Maus gerendert wird) -->
  {#if mouseBoxTarget}
    <div
      class="key-outline mouse-outline"
      class:movable={layoutMovable}
      style="
        left: {mouseBoxTarget.rect.left}px;
        top: {mouseBoxTarget.rect.top}px;
        width: {mouseBoxTarget.rect.width}px;
        height: {mouseBoxTarget.rect.height}px;
      "
    ></div>
  {/if}

  <!-- Layout-Hit-Zonen (Tasten + Maus-Körper) — nur wenn layoutMovable -->
  {#if layoutMovable}
    {#each keyTargets as t (t.keyId)}
      <button
        type="button"
        class="hit key"
        class:selected={selectedId === t.selId}
        style="
          left: {t.rect.left}px;
          top: {t.rect.top}px;
          width: {t.rect.width}px;
          height: {t.rect.height}px;
        "
        on:pointerdown={(e) => startMoveKey(e, t.keyId)}
        aria-label={`Taste ${t.label}`}
      >
        <span class="tag tag-key">{t.label}</span>
      </button>
    {/each}
    {#if mouseBoxTarget}
      <button
        type="button"
        class="hit mbox"
        class:selected={selectedId === "mbox"}
        style="
          left: {mouseBoxTarget.rect.left}px;
          top: {mouseBoxTarget.rect.top}px;
          width: {mouseBoxTarget.rect.width}px;
          height: {mouseBoxTarget.rect.height}px;
        "
        on:pointerdown={(e) => startMoveMouseBox(e)}
        aria-label="Maus verschieben"
      >
        <span class="tag tag-key">Maus</span>
      </button>
    {/if}
  {/if}

  <!-- Tasten-Gifts (immer Drag-bar) -->
  {#each giftTargets as t (t.keyId)}
    <button
      type="button"
      class="hit gift"
      class:selected={selectedId === t.selId}
      style="
        left: {t.rect.left}px;
        top: {t.rect.top}px;
        width: {t.rect.width}px;
        height: {t.rect.height}px;
      "
      on:pointerdown={(e) => startMoveGift(e, t.keyId)}
      aria-label={`${t.label} Gift`}
    >
      <span class="tag">{t.label}</span>
    </button>
  {/each}

  <!-- Maus-Gifts (immer Drag-bar wenn sichtbar) -->
  {#each mouseGiftTargets as t (t.buttonId)}
    <button
      type="button"
      class="hit gift mouse-gift"
      class:selected={selectedId === t.selId}
      style="
        left: {t.rect.left}px;
        top: {t.rect.top}px;
        width: {t.rect.width}px;
        height: {t.rect.height}px;
      "
      on:pointerdown={(e) => startMoveMouseGift(e, t.buttonId)}
      aria-label={`${t.label} Gift`}
    >
      <span class="tag">{t.label}</span>
    </button>
  {/each}

  <!-- Eck-Handles für ausgewähltes Tasten-Gift -->
  {#if selectedGiftTarget}
    {@const b = selectedGiftTarget.rect}
    {#each HANDLES as h}
      {@const isLeft = h === "nw" || h === "sw"}
      {@const isTop = h === "nw" || h === "ne"}
      <div
        class="handle"
        style="
          left: {isLeft ? b.left : b.left + b.width}px;
          top: {isTop ? b.top : b.top + b.height}px;
          cursor: {cursorFor(h)};
        "
        on:pointerdown={(e) => startResizeGift(e, selectedGiftTarget.keyId, h)}
        role="presentation"
      ></div>
    {/each}
  {/if}

  <!-- Eck-Handles für ausgewähltes Maus-Gift -->
  {#if selectedMouseGiftTarget}
    {@const b = selectedMouseGiftTarget.rect}
    {#each HANDLES as h}
      {@const isLeft = h === "nw" || h === "sw"}
      {@const isTop = h === "nw" || h === "ne"}
      <div
        class="handle"
        style="
          left: {isLeft ? b.left : b.left + b.width}px;
          top: {isTop ? b.top : b.top + b.height}px;
          cursor: {cursorFor(h)};
        "
        on:pointerdown={(e) => startResizeMouseGift(e, selectedMouseGiftTarget.buttonId, h)}
        role="presentation"
      ></div>
    {/each}
  {/if}

  <div class="toolbar" on:pointerdown|stopPropagation role="presentation">
    <div class="title">
      Edit-Modus
      {#if selectedId}
        <span class="sel">· {selectionTitle}</span>
        {#if scaleReadout}
          <span class="scale-readout">{scaleReadout}×</span>
        {/if}
      {/if}
    </div>
    <div class="tools">
      <button
        class="btn"
        disabled={!selectedId}
        on:click={resetSelectedPosition}
        title={
          selectedKind() === "gift" || selectedKind() === "mgift"
            ? "Gift-Position zurücksetzen"
            : selectedKind() === "mbox"
              ? "Maus auf Default-Position"
              : "Taste horizontal zentrieren"
        }
      >⊕</button>
      <button
        class="btn"
        disabled={selectedKind() !== "gift" && selectedKind() !== "mgift"}
        on:click={resetScaleSelected}
        title="Gift-Skalierung auf 1.0×"
      >1:1</button>
      <div class="sep"></div>
      <button
        class="btn toggle"
        class:active={layoutMovable}
        on:click={() => (layoutMovable = !layoutMovable)}
        title="Tasten + Maus selbst verschieben (Vorsicht — verändert das Layout!)"
      >⌨ Layout</button>
      <div class="sep"></div>
      <button class="btn primary" on:click={done} title="Fertig (E / ESC)">✓ Fertig</button>
    </div>
    <div class="hint">
      {#if layoutMovable}
        Tasten + Maus + Gifts ziehen · Gift-Ecken skalieren · E/ESC schließt
      {:else}
        Gift ziehen verschiebt · Ecken skalieren · „Layout" zum Layouten · E/ESC schließt
      {/if}
    </div>
  </div>
</div>

<style>
  .ed-root {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.22);
    backdrop-filter: blur(0.5px);
  }
  .key-outline {
    position: fixed;
    border: 1px dashed rgba(120, 200, 255, 0.32);
    border-radius: 6px;
    pointer-events: none;
    transition: border-color 100ms;
  }
  .key-outline.movable {
    border-color: rgba(244, 114, 182, 0.55);
  }
  .mouse-outline {
    border-radius: 16px;
    border-style: dashed;
  }
  .hit {
    position: fixed;
    background: transparent;
    padding: 0;
    color: white;
    cursor: move;
    transition: border-color 100ms, background 100ms;
    box-sizing: border-box;
    border-radius: 6px;
  }
  .hit.gift {
    border: 2px dashed rgba(120, 200, 255, 0.7);
  }
  .hit.gift:hover {
    border-color: rgba(120, 200, 255, 1);
    background: rgba(120, 200, 255, 0.12);
  }
  .hit.gift.selected {
    border: 2px solid #38bdf8;
    background: rgba(56, 189, 248, 0.18);
  }
  .hit.gift.mouse-gift {
    border-color: rgba(167, 139, 250, 0.7);
  }
  .hit.gift.mouse-gift:hover {
    border-color: rgba(167, 139, 250, 1);
    background: rgba(167, 139, 250, 0.12);
  }
  .hit.gift.mouse-gift.selected {
    border: 2px solid #a78bfa;
    background: rgba(167, 139, 250, 0.18);
  }
  .hit.key {
    border: 2px dashed rgba(244, 114, 182, 0.7);
  }
  .hit.key:hover {
    border-color: rgba(244, 114, 182, 1);
    background: rgba(244, 114, 182, 0.1);
  }
  .hit.key.selected {
    border: 2px solid #f472b6;
    background: rgba(244, 114, 182, 0.15);
  }
  .hit.mbox {
    border: 2px dashed rgba(251, 191, 36, 0.75);
    border-radius: 16px;
  }
  .hit.mbox:hover {
    border-color: rgba(251, 191, 36, 1);
    background: rgba(251, 191, 36, 0.08);
  }
  .hit.mbox.selected {
    border: 2px solid #fbbf24;
    background: rgba(251, 191, 36, 0.12);
  }
  .handle {
    position: fixed;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    margin-top: -7px;
    background: white;
    border: 2px solid #38bdf8;
    border-radius: 3px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    z-index: 2;
  }
  .handle:hover {
    background: #e0f2fe;
  }
  .tag {
    position: absolute;
    top: -22px;
    left: 0;
    font-size: 11px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.75);
    color: #e0f2fe;
    padding: 2px 6px;
    border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
  }
  .tag-key {
    top: auto;
    bottom: -22px;
    color: #fbcfe8;
  }
  .toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 8px 10px 6px;
    color: white;
    font-family: system-ui, sans-serif;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    min-width: 320px;
    max-width: calc(100% - 24px);
    backdrop-filter: blur(8px);
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: #cbd5e1;
    text-align: center;
    margin-bottom: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .sel {
    color: #38bdf8;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .scale-readout {
    font-family: ui-monospace, "JetBrains Mono", Consolas, monospace;
    font-size: 10px;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.35);
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: none;
    letter-spacing: 0;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
  }
  .btn {
    min-width: 34px;
    height: 30px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: white;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }
  .btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .btn.primary {
    background: #38bdf8;
    color: #0f172a;
    border-color: #38bdf8;
    font-weight: 600;
    font-size: 12px;
  }
  .btn.toggle {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .btn.toggle.active {
    background: rgba(244, 114, 182, 0.22);
    border-color: rgba(244, 114, 182, 0.7);
    color: #fbcfe8;
  }
  .btn.toggle.active:hover {
    background: rgba(244, 114, 182, 0.32);
  }
  .sep {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 4px;
  }
  .hint {
    margin-top: 6px;
    font-size: 10px;
    color: #94a3b8;
    text-align: center;
  }
</style>
