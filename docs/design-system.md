# Designsystem „Cinematic"

Verbindlich für die öffentliche Seite. Entschieden am 11.08.2026 nach fünf Entwürfen
(A–C dokumentenhaft → verworfen, D gewählt, E Alternative). Referenz-Prototyp:
`docs/design/entwurf-d-cinematic.html` — die Umsetzung in Angular übernimmt dessen
Look & Motion, nicht zwingend dessen Markup.

## Charakter

Dunkle Bühne, cineastisch, präzise. Die Seite inszeniert den Inhalt — sie ersetzt ihn
nicht. Jeder Effekt hat einen Zweck (Führung, Tiefe, Fokus); reine Deko-Effekte ohne
Bezug zum Inhalt werden nicht ergänzt. Dark-only ist eine bewusste Entscheidung
(kein Light-Theme); die Print-Ausgabe ist davon unabhängig hell.

## Farben (Tokens)

| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | `#0a0d11` | Seitenhintergrund |
| `--panel` | `rgba(255,255,255,0.035)` | Kartenflächen |
| `--line` | `rgba(255,255,255,0.09)` | Rahmen, Trennlinien |
| `--ink` | `#e9edf1` | Primärtext |
| `--muted` | `#97a2ad` | Sekundärtext (Kontrast ≥ 7:1 auf bg) |
| `--faint` | `#5d6771` | Tertiär/Meta |
| `--teal` | `#3fd0c0` | Akzent: Links, Marker, CTA, Glow |
| `--teal-soft` | `rgba(63,208,192,0.14)` | Chip-Hintergründe |
| `--amber` | `#ffb454` | Zweitakzent, sehr sparsam (Labels, einzelne Zeichen) |

Verboten (recherchebelegt, siehe docs/recherche/): Indigo/Lila-Verläufe, Inter als
Schrift, Skill-Prozentbalken, Typewriter-Effekte, Template-Icon-Grids.

## Typografie

- **Display/Fließtext:** Space Grotesk 400–700. Headlines 700 mit `letter-spacing: -0.02…-0.03em`.
- **Labels/Meta/Zahlen:** IBM Plex Mono 400–500, klein (0.68–0.85rem), Uppercase mit
  `letter-spacing: 0.08–0.3em`, `tabular-nums` für Zahlen/Zeiträume.
- Fluide Größen via `clamp()` — Hero `clamp(3rem, 11vw, 8.2rem)`, H2 `clamp(1.6rem, 3.4vw, 2.4rem)`.
- **DSGVO: Fonts werden self-hosted** (keine Google-Fonts-CDN-Einbindung auf der finalen Seite).

## Fläche & Form

- Sektionsrhythmus: `padding-top: 7rem`, Inhaltsbreite max. 74rem.
- Karten: Radius 18px, `--panel`-Fläche, 1px `--line`-Rahmen, Hover: Teal-Rahmen +
  weicher Teal-Schatten + `translateY(-3px)`.
- Chips: Pill (999px), Mono, klein; Skills neutral, Tech-Chips teal.
- Sektionstitel: Mono-Nummer (`01`) + Titel + auslaufende Linie.

## Motion-Prinzipien

- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` überall. Reveal-Dauer 0.7–0.9s,
  Stagger-Schritte 0.08s, Hero-Buchstaben 35ms.
- **Nur `transform`, `opacity`, `filter`** werden animiert — nie Layout-Eigenschaften.
- **`prefers-reduced-motion: reduce`:** alle Animationen aus, Inhalte sofort sichtbar,
  Canvas/Cursor deaktiviert. Pflicht bei jedem neuen Effekt.
- Effekte nur bei `(hover: hover) and (pointer: fine)`, wo Maus vorausgesetzt ist
  (Tilt, Magnetic, Cursor).

## Effekt-Inventar (Umsetzung als Angular-Direktiven/-Komponenten in 3b)

| Effekt | Spezifikation |
|---|---|
| Partikel-Konstellation | Fixed Canvas, ≤ 90 Punkte (`innerWidth/16`), Verbindungslinien < 130px, Maus-Repulsion 130px, dpr ≤ 2; Punkte `rgba(132,212,205,.62)`, Linien bis α .16 (bewusst gut sichtbar, 11.08.2026) |
| Aurora | 2 geblurrte Radialgradienten (Petrol + Amber), 26s/32s alternierende Drift |
| Filmkorn | SVG-Noise als Data-URI, Opacity 0.05, `mix-blend-mode: overlay` |
| Hero-Letters | Wortweise Spans, Buchstaben `translateY(115%) rotate(4deg) blur(6px)` → 0, Stagger 35ms |
| Scroll-Reveal | `.rv` + IntersectionObserver (threshold 0.16), einmalig |
| Timeline | Statische Spur + Teal-Progress `scaleY(scroll)`, Knoten mit Glow; Spur und Knoten zentrieren auf gemeinsamer Achse `--tl-x` (ganzzahlige px) |
| Geisterjahre | Outline-Text `clamp(5rem,16vw,12rem)`, Parallax-Faktor 0.12, mobil aus |
| Zähler | Ease-out-cubic, 1.3s, deutsches Dezimalkomma |
| Tilt-Karten | `rotateX ±7° / rotateY ±9°` + wanderndes Glow-Highlight |
| Magnetic CTA | Versatz ×0.25/0.35 zur Cursorposition, federnder Rücklauf |
| Cursor | „Atom" (11.08.2026): Teal-Kern (8px, wächst über Links auf 14px) auf dem Pointer; drei weiße Elektronen kreisen auf verkippten, langsam präzedierenden Ellipsen (rx 18/26/34px, individuelle Richtung + Tempo-Wobble) um einen nachlaufenden Anker (lerp 0.14) und ziehen einen ausblendenden Canvas-Schweif (12 Segmente in Bewegung, 30 in Ruhe); Rechtsklick spawnt statt des Kontextmenüs ein weiteres Elektron, jedes neue mit größerem Radius (+9px) und höherem Tempo (+0.012), Obergrenze 16; gespawnte Elektronen faden nach 10 s Lebensdauer über 2 s aus, Linksklick schickt sie sofort mit 0,45-s-Fade weg (12.08.2026); nativer Cursor via `html.cursor-hidden` ausgeblendet; nur Desktop |
| Nach-oben-Button | Ersetzt die Kopfleiste (11.08.2026): 52px-Glaskreis unten rechts (48px mobil), Pfeil in Teal, Lesefortschritt als 2.5px-Conic-Ring (`--p` vom Scroll-Listener); erscheint ab 0.6·Viewport Scroll, hover invertiert auf Teal |
| Scrollbar | Custom: schmaler Teal-Verlaufs-Balken (webkit + `scrollbar-color`), Balken „schwebt" über 3px-Rand; nur während des Scrollens sichtbar (`html.scrolling`, 0,9 s Nachlauf), Spurbreite bleibt reserviert |

## Accessibility & Performance

- Fokus: `outline: 2px solid var(--teal)` mit Offset, überall sichtbar.
- Mobil ist Pinch-Zoom per Viewport-Meta deaktiviert (bewusste Entscheidung 12.08.2026;
  bekannter A11y-Trade-off, iOS ignoriert `user-scalable=no` teilweise).
- Horizontales Scrollen ist global unterbunden: `overflow-x: clip` auf html UND body
  (hidden nur auf body reicht mobil nicht, dort pannt sonst das html-Element);
  im Print wieder `visible`.
- Deko-Elemente (Canvas, Aurora, Grain, Geisterjahre, Cursor) tragen `aria-hidden`.
- Kontraste: Primärtext ≥ 12:1, Sekundärtext ≥ 7:1, Teal auf bg ≥ 7:1.
- Budget: Effekt-JS ohne Libraries (~8 KB), kein Layout-Shift durch Effekte,
  Canvas pausiert bei `document.hidden` (in 3b ergänzen).
- Semantik: eine `h1`, Sektionen mit `h2`, Timeline als Liste auszeichnen (3b).

## Print (Phase 3b/4)

`@media print` liefert ein helles, DACH-konformes Dokument aus derselben Seite:
alle Effekte und Deko aus, Serifen-/Systemschrift, kontrollierte Seitenumbrüche —
das ist der öffentliche PDF-Download. Layout-Referenz: bestehender privater
Lebenslauf (tabellarisch, antichronologisch).

## Offen für 3b

- Foto-Platzierung (Foto ist freigegeben): Vorschlag kleiner runder Ausschnitt mit
  dezentem Teal-Ring im Hero-Metabereich oder „Über mich"-Block — beim Umsetzen
  mit echtem Foto entscheiden.
- E-Mail-Kontakt ergänzen, sobald die neue Adresse existiert (bis dahin LinkedIn primär).
