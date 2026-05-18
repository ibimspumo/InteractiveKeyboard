<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import type { AppSettings } from "../../types";
  import { Callout, Card, Field, GiftPicker, SectionHeader } from "../../ui";

  export let cfg: AppSettings;

  // LAN-IP wird im onMount geladen — fällt im Worst Case auf "localhost" zurück.
  // Wir bauen daraus die volle Webhook-URL für jede Taste, damit User sie direkt
  // in TikFinity / Streamerbot / Browser-Tools einfügen kann.
  let lanIp = "";
  onMount(async () => {
    try {
      const ip = await invoke<string>("get_local_ip");
      if (ip && ip.length > 0) lanIp = ip;
    } catch {
      /* ignored */
    }
  });

  // Default-Dauer in Sekunden — kommt aus den Block-Verhalten-Settings.
  $: defaultDur = Math.max(1, Math.round(cfg.defaultBlockSeconds));
  $: host = lanIp || "localhost";
  $: baseUrl = `http://${host}:${cfg.webhookPort}`;

  function webhookUrl(keyId: string): string {
    return `${baseUrl}/block?key=${keyId}&duration=${defaultDur}`;
  }

  function vkLabel(vk: number): string {
    if (vk === 0x20) return "Leertaste";
    if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
    if (vk >= 0x41 && vk <= 0x5a) return String.fromCharCode(vk);
    return `VK${vk}`;
  }

  function setGift(id: string, path: string | null) {
    cfg.keys = cfg.keys.map((k) => (k.id === id ? { ...k, giftIconPath: path } : k));
  }

  function setLabel(id: string, label: string) {
    cfg.keys = cfg.keys.map((k) => (k.id === id ? { ...k, label } : k));
  }

  function setMouseGift(id: string, path: string | null) {
    cfg.mouse = {
      ...cfg.mouse,
      buttons: cfg.mouse.buttons.map((b) => (b.id === id ? { ...b, giftIconPath: path } : b)),
    };
  }

  function setMouseLabel(id: string, label: string) {
    cfg.mouse = {
      ...cfg.mouse,
      buttons: cfg.mouse.buttons.map((b) => (b.id === id ? { ...b, label } : b)),
    };
  }

  // Per-Key Copy-Feedback: zeigt für 1.2s "Kopiert!" am Button an.
  let copied: Record<string, boolean> = {};
  async function copyWebhook(keyId: string) {
    const url = webhookUrl(keyId);
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      // Fallback: temporäres Input
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignored */
      }
      document.body.removeChild(ta);
    }
    copied = { ...copied, [keyId]: true };
    setTimeout(() => {
      copied = { ...copied, [keyId]: false };
    }, 1200);
  }

  const mouseShowLabel: Record<string, string> = {
    LMB: "Linksklick",
    RMB: "Rechtsklick",
    WHEEL: "Mausrad",
  };
  $: showMouseSection = cfg.layoutMode !== "keyboard";
</script>

<SectionHeader
  title="Tasten"
  description="Die Tasten und ihre Gift-Zuordnung. Position und Skalierung passt du im Edit-Modus (Taste E im Overlay) an, Farben und Stil im Design-Modus (Taste D)."
/>

<Callout variant="info">
  <strong>Tipp:</strong> Im Overlay drückst du <strong>E</strong> für den Edit-Modus
  (Gift-Positionen verschieben) und <strong>D</strong> für den Design-Modus
  (Farben, Form, Schriftgrößen). <strong>ESC</strong> öffnet diese Einstellungen.
</Callout>

<Card title="Tasten-Zuordnung">
  <div class="key-list">
    {#each cfg.keys as key (key.id)}
      <div class="key-row">
        <div class="head">
          <span class="kbox" title={`Virtual-Key-Code: 0x${key.vk.toString(16).padStart(2, "0").toUpperCase()}`}>
            {key.label}
          </span>
          <span class="meta">
            <span class="id">{key.id}</span>
            <span class="sep">·</span>
            <span class="vk">{vkLabel(key.vk)}</span>
          </span>
        </div>
        <Field label="Label" hint={'Text auf der Taste — z.B. "W", "JUMP", "←".'}>
          <input
            type="text"
            class="label-input"
            value={key.label}
            on:input={(e) => setLabel(key.id, e.currentTarget.value)}
            placeholder={key.id}
          />
        </Field>
        <Field label="TikTok-Gift">
          <GiftPicker
            value={key.giftIconPath}
            on:change={(e) => setGift(key.id, e.detail)}
          />
        </Field>
        <Field label="Webhook-URL" hint={`Komplette URL mit Default-Dauer (${defaultDur}s). Direkt in TikFinity / Streamerbot einfügen.`}>
          <div class="webhook-row">
            <code class="webhook-url" title={webhookUrl(key.id)}>{webhookUrl(key.id)}</code>
            <button
              class="copy-btn"
              class:copied={copied[key.id]}
              on:click={() => copyWebhook(key.id)}
              type="button"
              title="In Zwischenablage kopieren"
            >
              {copied[key.id] ? "✓ Kopiert" : "⧉ Kopieren"}
            </button>
          </div>
        </Field>
      </div>
    {/each}
  </div>
</Card>

{#if showMouseSection}
  <Card title="Maus-Buttons">
    <div class="key-list">
      {#each cfg.mouse.buttons as btn (btn.id)}
        <div class="key-row">
          <div class="head">
            <span class="kbox mouse-kbox" title={`Maus-Button: ${btn.id}`}>
              {btn.id === "WHEEL" ? "⊙" : btn.label || btn.id[0]}
            </span>
            <span class="meta">
              <span class="id">{btn.id}</span>
              <span class="sep">·</span>
              <span class="vk">{mouseShowLabel[btn.id]}</span>
            </span>
          </div>
          <Field label="Label" hint={btn.id === "WHEEL" ? 'Optional — Text unter dem Rad (z.B. "scroll").' : 'Text auf dem Button — z.B. "L", "R".'}>
            <input
              type="text"
              class="label-input"
              value={btn.label}
              on:input={(e) => setMouseLabel(btn.id, e.currentTarget.value)}
              placeholder={btn.id}
            />
          </Field>
          <Field label="TikTok-Gift">
            <GiftPicker
              value={btn.giftIconPath}
              on:change={(e) => setMouseGift(btn.id, e.detail)}
            />
          </Field>
          <Field label="Webhook-URL" hint={`Komplette URL mit Default-Dauer (${defaultDur}s).`}>
            <div class="webhook-row">
              <code class="webhook-url" title={webhookUrl(btn.id)}>{webhookUrl(btn.id)}</code>
              <button
                class="copy-btn"
                class:copied={copied[btn.id]}
                on:click={() => copyWebhook(btn.id)}
                type="button"
                title="In Zwischenablage kopieren"
              >
                {copied[btn.id] ? "✓ Kopiert" : "⧉ Kopieren"}
              </button>
            </div>
          </Field>
        </div>
      {/each}
    </div>
  </Card>
{/if}

<style>
  .key-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .key-row {
    padding: var(--sp-3);
    background: var(--c-bg-2);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .kbox {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--c-bg-3);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    font-weight: 700;
    font-size: 18px;
    color: var(--c-text);
    font-family: system-ui, sans-serif;
    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.2);
  }
  .mouse-kbox {
    border-radius: 50% 50% 40% 40% / 60% 60% 30% 30%;
    background: linear-gradient(180deg, var(--c-bg-3) 0%, var(--c-bg-2) 100%);
    font-size: 22px;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
  }
  .id {
    font-family: var(--font-mono);
    color: var(--c-accent);
    font-weight: 600;
  }
  .vk {
    color: var(--c-text);
  }
  .sep {
    color: var(--c-text-dim);
  }
  .label-input {
    flex: 1;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 10px;
    font-family: inherit;
    font-size: var(--fs-sm);
    width: 100%;
  }
  .label-input:focus {
    outline: none;
    border-color: var(--c-accent);
    background: var(--c-bg-2);
  }
  .webhook-row {
    display: flex;
    align-items: stretch;
    gap: var(--sp-2);
  }
  .webhook-url {
    flex: 1;
    min-width: 0;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 6px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: all;
  }
  .copy-btn {
    flex-shrink: 0;
    background: var(--c-bg-3);
    color: var(--c-text);
    border: 1px solid var(--c-border-strong);
    border-radius: var(--r-sm);
    padding: 6px 12px;
    font-family: inherit;
    font-size: var(--fs-xs);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 120ms, border-color 120ms, color 120ms;
  }
  .copy-btn:hover {
    background: var(--c-bg-2);
    border-color: var(--c-accent);
    color: var(--c-accent);
  }
  .copy-btn.copied {
    background: var(--c-success, #10b981);
    border-color: var(--c-success, #10b981);
    color: white;
  }
</style>
