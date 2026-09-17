# CollectMind

<p align="center">
  <a href="../README.md">English</a> |
  <b>Deutsch</b> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<div style="text-align: center">
<img src="./images/icon_origin.png"/>
</div>

CollectMind ist eine KI-gestützte Lesezeichensammlung, mit der du deine eigene Wissensdatenbank aufbauen kannst.

**Alles läuft vollständig lokal auf deinem Gerät.** Zusammenfassung, Suche und Chat werden komplett von Chromes integriertem Gemini Nano sowie einem lokalen Embedding-Modell in deinem Browser übernommen — es gibt keinen Backend-Server, keinen API-Schlüssel und kein Konto ist erforderlich. Deine Lesezeichen, Seiteninhalte und der Chatverlauf verlassen niemals deinen Rechner. Die einzige bewusste Ausnahme ist die Sicherung: Wenn du dich für ein Backup in Google Drive entscheidest, werden die Daten direkt von deinem Browser in *dein eigenes* Drive übertragen — CollectMind steht dabei zu keinem Zeitpunkt dazwischen und bekommt die Daten nie zu Gesicht.

## 1. Hauptfunktionen
* Lesezeichen nach Themen organisieren
* Die aktuelle Webseite als Lesezeichen speichern
* Webseiteninhalte automatisch zusammenfassen
* (RAG) Retrieval-Augmented-KI-Chat zu einzelnen Themen, mit anklickbaren Quellenangaben
* KI-Chat zu einer bestimmten Webseite
* **Über die gesamte Sammlung hinweg fragen** — ein „Library"-Chat-Modus, der alle Themen gleichzeitig durchsucht, damit du dir nicht merken musst, unter welchem Thema du etwas abgelegt hast
* Automatisch zusammengefasste Themenübersichten, die aktuell gehalten werden, sobald neue Seiten hinzukommen
* Antworten werden gestreamt (Wort für Wort angezeigt)
* Sichern und Wiederherstellen — entweder in eine lokale Datei oder in dein eigenes Google Drive (mehrere Sicherungen möglich, jede davon einzeln wiederherstellbar)

## 2. Funktionsweise

CollectMind läuft vollständig auf Chromes integrierter KI (Gemini Nano) sowie einem kleinen lokalen Embedding-Modell — es wird nichts an einen Server gesendet.

* **Zusammenfassen & Chatten**: Die [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api)- und [Prompt](https://developer.chrome.com/docs/ai/prompt-api)-APIs übernehmen Seitenzusammenfassungen und Chat-Antworten direkt auf dem Gerät.
* **Suche (RAG)**: Gespeicherte Seiten werden in Abschnitte zerlegt und lokal mit [Transformers.js](https://huggingface.co/docs/transformers.js) eingebettet (`Xenova/multilingual-e5-small`, funktioniert gut für gemischt englisch-/chinesischsprachige Inhalte), ausgeführt in einem eigenen Web Worker. Beim Chatten werden nur die relevantesten Abschnitte abgerufen und dem Modell übergeben — statt jede gespeicherte Seite komplett in den Prompt zu packen, was früher das Kontextfenster des Modells sprengte, sobald ein Thema mehr als eine Handvoll Seiten enthielt.
* **Speicherung**: Themen, Seiten, Chatverlauf sowie der Abschnitts-/Embedding-Index liegen alle in IndexedDB (über Dexie) auf deinem Rechner.

Den Indexierungsstatus prüfen und den Suchindex neu aufbauen kannst du unter **Einstellungen**.

## 3. Build & Ausführung
> ⚠️ Die KI-Funktionen basieren auf den in Chrome integrierten KI-Fähigkeiten, daher wird mindestens **Chrome 138** benötigt. Außerdem hat das On-Device-Modell echte Hardwareanforderungen: **≥22 GB freier Speicherplatz**, sowie entweder eine GPU mit **>4 GB VRAM** oder **16 GB+ RAM und 4+ CPU-Kerne**. Zeigt eine Statuskarte in den Einstellungen „Unavailable" an, öffne `chrome://on-device-internals`, um den genauen Grund zu sehen (meist fehlender Speicherplatz).

1. Dieses Repository klonen
2. ```npm install && npm run build```
3. Das Verzeichnis ```/dist``` in Chrome als entpackte Erweiterung laden.
4. Auf das Symbol der Erweiterung klicken, um CollectMind zu öffnen.

Beim ersten Zusammenfassen oder Chatten fordert Chrome dich auf, das On-Device-Modell herunterzuladen (einige GB); das Embedding-Modell (~120 MB) wird im Hintergrund geladen — beide werden anschließend zwischengespeichert und benötigen danach keine Netzwerkverbindung mehr.

## 4. Screenshots

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 1. Startseite </figcaption>
  <img src="./images/1.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 2. Ein Thema erstellen </figcaption>
  <img src="./images/2.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 3. Themenliste </figcaption>
  <img src="./images/3.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 4. Liste gespeicherter Seiten </figcaption>
  <img src="./images/4.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 5. Seitenzusammenfassung (KI) </figcaption>
  <img src="./images/5.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 6. Zusammenfassungsdetails </figcaption>
  <img src="./images/6.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 7. KI-Chat zu Themen </figcaption>
  <img src="./images/7.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 8. KI-Chat zu einer bestimmten Webseite </figcaption>
  <img src="./images/8.png" width="400">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 9. Die gesamte Sammlung durchsuchen (alle Themen) </figcaption>
  <img src="./images/11.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 10. Einstellungen (lokale Modelle) </figcaption>
  <img src="./images/9.png" width="200">
</figure>

<figure style="display:inline-block; text-align:center; margin: 10px;">
  <figcaption> 11. Einstellungen (Backup & Cloud) </figcaption>
  <img src="./images/10.png" width="200">
</figure>
