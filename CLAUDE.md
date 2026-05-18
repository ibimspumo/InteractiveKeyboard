# CLAUDE.md

Instruktionen für Claude Code beim Arbeiten an diesem Repo.

## Was ist Interactive Keyboard

Tauri 2 + Svelte Desktop-App für TikTok-Streamer (Windows-only). Transparentes
1:1-Overlay (500×500), das eine kleine Tastatur rendert (WASD + Space, beliebig
erweiterbar). Externe Tools / Webhooks können einzelne Tasten zeitlich
blockieren — die App schluckt die Tasten systemweit per Win32-Low-Level-Hook
und zeigt das visuell mit rotem X + Countdown.

App-Sprache **Deutsch only**. Plattform: **Windows**.

## Stack

- **Tauri 2** (Rust + Webview)
- **Frontend**: Svelte + TypeScript + Vite (Syntax-kompatibel mit Svelte 5)
- **Webhook-Server**: axum 0.7
- **Key-Blocking**: `windows`-Crate (SetWindowsHookExW + WH_KEYBOARD_LL)
- **Persistenz**: `tauri-plugin-store` (`%APPDATA%/de.agentz.interactivekeyboard/settings.json`)
- **Auto-Update**: `tauri-plugin-updater` via GitHub Releases mit minisign

## Architektur

```
HTTP-Request → axum-Handler → Tauri-Event "webhook"
                                       ↓
                              App.svelte handler
                                       ↓
                              keyRuntimes-Update
                                       ↓
                       set_blocked_keys(vks) → Rust
                                       ↓
                       BLOCKED-HashSet (für hook_proc gelesen)
                                       ↓
                       hook_proc liefert LRESULT(1) → Event geschluckt
```

Frontend hält den State (welche Tasten wie lange blockiert). Rust hält nur
die aktuelle Liste blockierter VK-Codes; bei jedem Tick (Frontend rAF)
synct das Frontend die aktuelle Liste ans Backend.

## Verzeichnislayout

```
src/                       Svelte-Frontend
  App.svelte               Game-Loop, Aspect-Lock, ESC/D/E Shortcuts
  lib/
    types.ts               AppSettings, KeyDef, SoundRef, MultiTriggerMode
    defaults.ts            defaultSettings(), Default-Sounds, RGBA-Helpers
    stores.ts              Svelte stores + Webhook-Event-Binding + Block-Logik
    version.ts             APP_VERSION (manuell bei Release bumpen!)
    audio-pool.ts          Burst-fester Web-Audio-Pool (block/unblock Kategorien)
    sound-library.ts       SoundRef-Resolver (sound:<id> / Pfad / null)
    gift-icons.ts          TikTok-Gift-Resolver (gift:<key>)
    overlay/               Keyboard.svelte + Key.svelte
    editor/                Editor.svelte — Gift-Positionierung (E)
    design/                Design.svelte + DesignPanel.svelte + schemas.ts (D)
    settings/              Settings.svelte + sections/*.svelte
    ui/                    Design-System (Button, Card, …)
  assets/defaults/         Default-Sounds (block.mp3/unblock.mp3) + Gift-WebPs
src-tauri/
  src/
    main.rs                bin entry
    lib.rs                 Builder + AppState + Plugins + Hook-Init
    webhook.rs             axum-Routen + Server-Lifecycle
    commands.rs            #[tauri::command] Funktionen
    keyblock.rs            Windows Low-Level Keyboard Hook
  tauri.conf.json          Fenster (transparent, 500×500), Plugins, Updater
  capabilities/default.json
.github/workflows/release.yml  Build-Pipeline (Windows NSIS)
```

## Settings-Modell

`AppSettings` (`src/lib/types.ts`) ist die Single-Source-of-Truth.
- Beim Start aus dem Store geladen, mit `defaultSettings()` gemergt (Migration).
- Nur beim Klick auf "Speichern" persistiert.
- Bei Save: `invoke("apply_settings", ...)` an Rust → Webhook-Server-Restart
  bei Port/Enable/BindAll-Änderung.

Neues Setting-Feld einbauen:
1. In `types.ts` ergänzen
2. In `defaults.ts` Default setzen (Migration alter Configs)
3. Klassifizieren:
   - **Inhalt/Technik** → Settings-Section (`src/lib/settings/sections/*.svelte`)
   - **Position/Größe** → **Edit-Modus** (nur Gift-Position aktuell)
   - **Visueller Stil** → **Design-Modus** (Schema in `src/lib/design/schemas.ts`)

## Modi (E / D)

Im Overlay-Hauptfenster:
- **ESC**: Settings-Panel öffnen/schließen
- **D**: Design-Modus (Stil-Editor, Klick auf eine Taste → Panel)
- **E**: Edit-Modus (Gift-Icons per Drag positionieren)

D und E sind **mutex** — eins schaltet das andere aus. ESC bricht beides ab
und persistiert.

## Webhook-API

```
GET /block?key=W&duration=10     Blockiert Taste W für 10 Sek
GET /block?vk=87&duration=10     Identisch, per Virtual-Key-Code
GET /w?duration=10               Kurzform (jede ein-Zeichen-Taste + "space")
GET /unblock?key=W               Hebt Sperre auf
GET /reset                       Alle Sperren aufheben
GET /status                      JSON {keys, webhookPort, anticheatRunning}
```

Default-Port: 8080. `webhookBindAllInterfaces=true` → 0.0.0.0, sonst nur
localhost.

**Mehrfach-Trigger** (cfg.multiTriggerMode):
- `add` (Default): Restzeit + neue Dauer (gekappt bei `maxBlockSeconds`)
- `reset`: Restzeit auf neue Dauer setzen
- `ignore`: Neue Requests verwerfen, bis die Sperre abgelaufen ist

## Anti-Cheat

Vor jedem Block-Apply ruft `App.svelte` `invoke("anticheat_running")` auf.
Bei `true` → Request stillschweigend verworfen. So vermeiden wir Bans in
Valorant/Fortnite/R6/etc. Liste der erkannten Prozesse in
`src-tauri/src/keyblock.rs::ANTICHEAT_PROCS`.

## Fenster-Verhalten

- **1:1 Aspect-Lock**: JS-Listener in App.svelte snappt nach jedem Resize
  auf das kleinere Maß
- **Drag**: `data-tauri-drag-region` auf Root-Container und Keys (nicht im
  Edit/Design-Modus, dort wird stattdessen das Element gezogen)
- **Transparenz**: `transparent: true` + `decorations: false` für OBS-Capture

## Versionierung & Release

Version steht an **vier** Stellen — alle gleichzeitig hochsetzen:
1. `package.json`
2. `src-tauri/Cargo.toml`
3. `src-tauri/tauri.conf.json`
4. `src/lib/version.ts`

**Pflicht bei jedem Release**: eine Release-Notes-Datei
`release-notes/vX.Y.Z.md` anlegen, bevor der Tag gepusht wird. Der Workflow
liest diese Datei und nutzt ihren Inhalt als GitHub-Release-Body. Inhalt auf
Deutsch, kein generischer Platzhalter — was tatsächlich geändert wurde:

- **Features**: neue, sichtbare Funktionen
- **Änderungen**: nennenswerte Verhaltensänderungen
- **Fixes**: behobene Bugs
- **Breaking**: alles was an Configs / Webhook-API bricht (extra hervorheben)
- **Known Issues** falls relevant

Fehlt die Datei, fällt der Workflow auf einen Hinweistext zurück — das ist
nur ein Notnagel, **nicht** der Normalfall.

Release-Flow:
```powershell
# 1. Versionen in den 4 Dateien hochsetzen
# 2. release-notes/vX.Y.Z.md mit den Changes schreiben
# 3. Commit + Tag + Push
git add -A
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

Der Tag triggert `.github/workflows/release.yml` → Windows-Build (NSIS),
signiertes `latest.json` und Installer als Draft-Release. Nach erfolgreichem
Build wird das Release automatisch publiziert.

**Wichtig:** Kein Windows Code-Signing-Cert vorhanden → SmartScreen-Warnungen
für User, aber funktional OK. Die **Update**-Signatur (minisign) ist davon
unabhängig und funktioniert.

## Bekannte Stolperfallen

- **Tauri-Updater `pubkey` leer**: muss vor erstem Release durch den Output
  von `npx @tauri-apps/cli signer generate` ersetzt werden (Public-Key-Base64).
  Privater Key kommt als GitHub-Secret. Bevor das nicht passiert, schlägt der
  Updater-Check stillschweigend fehl.
- **Tauri-Plugins**: Bei jedem neuen Plugin sowohl Cargo + JS-Package + Capability
  ergänzen, sonst Build-Fehler.
- **CSS transform + drag region**: funktioniert, weil Hit-Testing transformierte
  Geometrie respektiert.
- **LowLevelHooksTimeout** (Registry-Default 300ms): Hook-Proc muss <300ms
  brauchen, sonst kickt Windows den Hook. Wir tun in `hook_proc` nur einen
  read-lock + HashSet-Lookup → unkritisch.

## Befehle

```powershell
npm install                                # Deps installieren
npm run start                              # Dev-Mode (Vite + Tauri)
npm run build                              # Frontend-Build (nur Vite)
npm run tauri build                        # Full Release-Build lokal
npx svelte-check --tsconfig ./tsconfig.json  # Type-Check
cd src-tauri && cargo check                # Rust-Build only
node scripts/generate-app-icon.mjs         # App-Icon via OpenRouter neu generieren
npx tauri icon icon_gen.png                # Alle Größen aus icon_gen.png erzeugen
node scripts/scrape-tiktok-gifts.mjs       # Gift-Library aktualisieren
```

## Wo ich was finde

- Game-Loop & Shortcuts: `src/App.svelte`
- Tasten-Rendering: `src/lib/overlay/Key.svelte`
- Webhook-Routen: `src-tauri/src/webhook.rs`
- Block-Logik (Multi-Trigger): `src/lib/stores.ts::applyBlock`
- Win32 Hook: `src-tauri/src/keyblock.rs`
- Design-Schemas: `src/lib/design/schemas.ts`
- Permissions: `src-tauri/capabilities/default.json`
