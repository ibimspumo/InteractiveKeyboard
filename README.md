<p align="center">
  <img src="icon_gen.png" alt="Interactive Keyboard" width="160" />
</p>

<h1 align="center">Interactive Keyboard</h1>

<p align="center">
Transparentes Overlay für TikTok-Live-Streams. Deine Zuschauer können dir per
Geschenk einzelne Tasten oder Maus-Tasten zeitweise sperren — die App schluckt
die Tasten/Klicks system­weit und zeigt das mit rotem X, Countdown und dem
Gift-Icon, das sie gerade geschickt haben.
</p>

<p align="center"><b>Nur für Windows.</b></p>

---

## Was kann das Programm?

Du legst es als transparentes Fenster über dein Spiel (oder in OBS). Im Stream
sieht man eine kleine Tastatur (Standard: **WASD + Space**) und/oder eine
Maus mit Links-/Rechts-Klick und Mausrad. Sobald jemand in deinem TikTok-Live
ein Geschenk sendet, kannst du dein Tool (TikFinity, Streamerbot, …) auf den
Webhook zeigen lassen — die App sperrt dann für die eingestellte Zeit die
zugeordnete Taste/Klick.

Beispiele:

<table>
  <tr>
    <td align="center" width="100"><img src="src/assets/defaults/graphics/gifts/gift_rose.webp" width="64" alt="Rose" /></td>
    <td><b>Rose</b> → blockiere <code>W</code> für 10 Sekunden → der Streamer kann nicht mehr vorwärts laufen.</td>
  </tr>
  <tr>
    <td align="center"><img src="src/assets/defaults/graphics/gifts/gift_tiktok_universe.webp" width="64" alt="TikTok Universe" /></td>
    <td><b>TikTok Universe</b> → blockiere alle <code>WASD</code> für 60 Sekunden → totaler Kontrollverlust.</td>
  </tr>
  <tr>
    <td align="center"><img src="src/assets/defaults/graphics/gifts/gift_heart.webp" width="64" alt="Heart" /></td>
    <td><b>Heart</b> → blockiere den Linksklick für 5 Sekunden → kein Schießen.</td>
  </tr>
</table>

Die App schluckt die Tasten richtig auf System-Ebene — egal ob du gerade
Fortnite, Valorant, ein Browserspiel oder Notepad offen hast.

## Drei Layouts

In den Einstellungen → **Layout** wählst du:
- **WASD Only** — nur die Tastatur (quadratisches 1:1 Fenster).
- **Maus Only** — nur die Maus mit Links/Rechts-Klick und Mausrad.
- **WASD + Maus** — beides nebeneinander im Querformat.

Das Fenster snappt automatisch auf die richtige Form.

## Wie sieht's im Stream aus?

- **Komplett transparenter Hintergrund** — perfekt für OBS-Capture, du siehst
  nichts vom Programmfenster, nur die Tasten und die Maus.
- **Rotes X + Countdown** auf gesperrten Tasten/Klicks.
- **Gift-Icon** kann pro Taste hinterlegt werden — Zuschauer sehen direkt,
  welches Geschenk wofür zuständig ist.
- **Block/Unblock-Sounds** — eingebaute Standard-Sounds, oder eigene
  einfügen (pro Taste oder global).

## Loslegen

1. Installer von der **Releases**-Seite laden und installieren.
2. App starten. Das Fenster ist transparent — du siehst nur die Tastatur/Maus.
3. **ESC** drücken → Einstellungen öffnen.
4. Im Tab **Webhook** den Port checken (Standard **8080**) und ob es im
   lokalen Netz erreichbar sein soll (Toggle "Im lokalen Netzwerk freigeben").
5. Im Tab **Tasten & Gifts** für jede Taste / jeden Maus-Button:
   - das gewünschte TikTok-Geschenk auswählen
   - die fertige Webhook-URL **kopieren** und in dein Tool (TikFinity etc.) einfügen
6. ESC nochmal → fertig. Fenster über dein Spiel positionieren und in OBS als
   "Fenstererfassung" aufnehmen.

## Bedienung im Overlay

| Taste | Was passiert |
|-------|--------------|
| **ESC** | Einstellungen öffnen/schließen |
| **D** | Design-Modus — Farben, Form, Schriftgrößen ändern (Klick auf die Taste/Maus) |
| **E** | Edit-Modus — Geschenk-Icons verschieben/skalieren, Tasten + Maus-Position layouten |

Das Fenster lässt sich an einer freien Stelle einfach mit der Maus ziehen. Die
Größe ist über die Fensterränder anpassbar; das Seitenverhältnis bleibt fix.

## Webhook-URLs

Das ist das, was du in dein TikTok-Tool einträgst. Du musst hier nichts selbst
zusammenbauen — in den Einstellungen unter **Tasten & Gifts** gibt es bei jeder
Taste einen **Kopieren**-Button für die komplette URL inkl. Default-Dauer.

Format der URL:
```
http://localhost:8080/block?key=W&duration=10
```

Die wichtigsten Keys:
- **Tasten:** `W`, `A`, `S`, `D`, `SPACE`, … (oder `space`)
- **Maus:** `LMB` (Linksklick), `RMB` (Rechtsklick), `WHEEL` (Mausrad)

Zusätzlich praktisch:
- `/unblock?key=W` — Sperre sofort aufheben
- `/reset` — alle Sperren aufheben

Wenn du im lokalen Netzwerk auf die App von einem anderen Gerät zugreifen
willst (z.B. Handy als Trigger), aktiviere "Im lokalen Netzwerk freigeben" in
den Webhook-Einstellungen. Die kopierten URLs zeigen dann automatisch deine
LAN-IP.

## Mausrad-Verhalten

Das **WHEEL**-Geschenk kann zwei Dinge gleichzeitig sperren: das **Klicken**
auf das Mausrad (= Mittelklick) UND das **Scrollen**. In den Einstellungen unter
**Layout** kannst du beide unabhängig deaktivieren:
- Nur Mittelklick sperren, Scrollen zulassen
- Nur Scrollen sperren, Mittelklick zulassen
- Oder beides — Standard

## Mehrfach-Trigger-Verhalten

Was passiert, wenn während einer aktiven Sperre noch ein Geschenk reinkommt?
Wählbar in den Einstellungen → **Block-Verhalten**:
- **Addieren** (Standard) — Restzeit + neue Dauer. So sammeln sich Geschenke an.
- **Zurücksetzen** — Restzeit wird auf die neue Dauer überschrieben.
- **Ignorieren** — weitere Geschenke laufen ins Leere bis die Sperre vorbei ist.

## Anti-Cheat-Schutz

Wenn ein bekanntes Anti-Cheat-System läuft (**Vanguard** für Valorant/LoL,
**EAC** für Fortnite/Apex, **BattlEye** für R6/PUBG, **FACEIT**), verwirft die
App alle Block-Requests automatisch. Es wird nichts geschluckt, kein Ban-Risiko.

Wichtig: das ist eine **Schutz-Funktion**, kein Versprechen. Spiel keine
kompetitiven Modi mit so einer Software an. Für PvE, Sandbox-Spiele,
Browser-Spiele und alles ohne Anti-Cheat ist es safe.

## Updates

Die App prüft beim Start automatisch auf neue Versionen über GitHub-Releases.
Wenn ein Update verfügbar ist, wird es im Hintergrund geladen und installiert
sich beim nächsten Start.

## Hinweise

- Beim ersten Start zeigt Windows SmartScreen möglicherweise eine Warnung
  ("Computer geschützt" / "Trotzdem ausführen") — das liegt daran, dass kein
  Code-Signing-Zertifikat verwendet wird. Die App ist trotzdem funktional.
- Die Einstellungen werden im Windows-AppData gespeichert
  (`%APPDATA%/de.agentz.interactivekeyboard/settings.json`).

## Lizenz

Privates Projekt.
