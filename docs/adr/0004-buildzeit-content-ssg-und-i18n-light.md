# ADR 0004: Buildzeit-Content, SSG und leichtgewichtige i18n

Status: akzeptiert (11.08.2026)

## Kontext

Die Site ist rein statisch (ADR 0001) und bezieht ihre Inhalte aus
`content/cv.de.json`. Zu entscheiden: wie die Inhalte in die Seite kommen,
wie vorgerendert wird, wie Mehrsprachigkeit vorbereitet wird und wie der
PDF-Download in Version 1 funktioniert.

## Entscheidung

- **Content per JSON-Import zur Buildzeit** (`resolveJsonModule`), typisiert über
  die `content-model`-Library. Kein Laufzeit-Fetch: das Prerender-HTML enthält
  den vollständigen Inhalt (SEO, kein Ladeflackern). Abgeleitete Werte (Zeiträume,
  Dauern, Statistiken) werden aus den Daten berechnet, nicht hartkodiert.
- **SSG:** `@angular/ssr` mit `outputMode: "static"` und `RenderMode.Prerender`;
  der von `ng add` erzeugte Express-Server wurde entfernt. Alle Effekte laufen
  ausschließlich im Browser (`afterNextRender` + Guards); Reveal-Ausblendungen
  greifen nur unter `html.js`, damit die Seite ohne JavaScript lesbar bleibt.
- **i18n-light:** UI-Strings zentral in `ui/ui-text.ts`; eine Sprache =
  dieses Objekt + `cv.<locale>.json`. Bewusst kein Angular-i18n-Buildfork und
  keine Runtime-Übersetzungsbibliothek für eine Ein-Seiten-Site; der Wechsel auf
  echtes Locale-Routing bleibt möglich, weil alle Texte bereits zentral liegen.
- **PDF v1 = Print-Stylesheet + `window.print()`:** dieselbe Seite liefert über
  `@media print` ein helles, druckfähiges Dokument (Effekte aus, Token-Farben
  überschrieben, kontrollierte Umbrüche). Ein vorgerendertes PDF aus dem Studio
  kann später ergänzt werden, ohne diese Entscheidung zu revidieren.

## Konsequenzen

- Content-Änderungen erfordern einen Site-Rebuild — deckt sich mit dem
  Publish-Flow aus ADR 0001 (Studio → content/ → CI → Deploy).
- Prerender-Datum steckt in berechneten Dauern („heute"-Positionen); jede
  Publikation baut neu, damit bleiben die Angaben aktuell.
- Fonts sind self-hosted via @fontsource (DSGVO); es gibt keine Requests an
  Dritt-CDNs.
