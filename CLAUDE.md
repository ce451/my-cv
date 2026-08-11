# my-cv — öffentliche CV-Website + privates Studio

Öffentliche CV-/Portfolio-Website von Christopher Elstner ([elstner.ch](https://elstner.ch))
mit privatem Content-Backend („Studio"). Zielgruppe: HR und Technik im DACH-Raum.
Qualitätsanspruch: Craft statt Spektakel — dieses Repo ist selbst Arbeitsprobe.

## Architektur (Begründungen: docs/adr/)

- `frontend/projects/site` — öffentliche Seite: Angular 22, wird rein statisch gebaut
  (SSG; `@angular/ssr` mit `outputMode: "static"` folgt mit den ersten echten Routen).
  Deutsch, von Anfang an i18n-fähig. Hosting: Cloudflare Pages, Domain elstner.ch.
- `frontend/projects/studio` — Admin-UI des privaten Content-Backends. Läuft nur lokal,
  wird nie deployed.
- `backend/` — Studio-API: .NET 10 Minimal API + EF Core + SQLite. In `backend/data/`
  (gitignored) liegen `studio.db` und `seed.json` mit den privaten Rohdaten.
- `frontend/projects/content-model` — geteilte TypeScript-Typen (Studio-Dokument +
  publiziertes Public-Schema). Mappt auf `dist/` → nach dem Clone einmal
  `npx ng build content-model` ausführen, bevor site/studio gebaut werden.
- `content/` — veröffentlichte Content-Artefakte (JSON), vom Studio per Publish erzeugt;
  einzige Datenquelle des Site-Builds. Kein Laufzeit-Backend für die öffentliche Seite.

## Verbindliche Regeln

- **Committen nach jedem Phasenabschluss und danach sofort auf alle Remotes pushen
  (stehende Anweisung vom 11.08.2026). Zwischen Phasen nicht anhalten, außer es
  fehlt Input vom User.**
- **Datenschutz für alle öffentlichen Ausgaben** (Website, öffentliches PDF, Repo):
  Wohnort nur „Weiz" — keine Straße, kein Geburtsdatum, keine Telefonnummer, keine
  private Gmail-Adresse. Kontakt läuft über eine eigene, noch einzurichtende Adresse.
  Das vollständige Bewerbungs-PDF (mehr Daten) und die öffentliche Fassung sind zwei
  Sichten auf denselben Datenbestand → das Datenmodell braucht ein Sichtbarkeitsflag.
  **Bewusst kein Impressum** (Entscheidung 11.08.2026); die /datenschutz-Seite bleibt
  minimal und ohne Adresse. Vor breiter Streuung der Seite neu bewerten.
- **Ton aller sichtbaren Texte:** sachlich und konkret, keine Selbstvermarktungs-Floskeln,
  keine KI-typischen Formulierungen. Zahlen und Fakten statt Adjektive.
- **Design:** verbindlich ist `docs/design-system.md` — Richtung „Cinematic"
  (dunkle Bühne, Teal/Amber, Space Grotesk + IBM Plex Mono, Effekt-Inventar mit
  Motion-Regeln), entschieden am 11.08.2026. Referenz-Prototyp:
  `docs/design/entwurf-d-cinematic.html`. Fonts self-hosted (DSGVO).
  Ausgeschlossen bleiben: Skill-Prozentbalken, Typewriter-Effekte, Indigo/Inter-Look.
- **Sprachen:** UI-Texte und Doku Deutsch; Code, Kommentare und Commit-Messages Englisch.
- Commits nach Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:` …).

## Definition of Done

- `frontend`: `npx ng build site`, `npx ng build studio` und `npm run test:ci` grün
- `backend`: `dotnet build` und `dotnet test` grün, keine neuen Warnungen
- Bei UI-Änderungen: Print-Ausgabe (`@media print`) mitgedacht
- Öffentliche Inhalte gegen die Datenschutz-Regeln geprüft

## Befehle

- Node über nvm: `nvm use` (liest `.nvmrc`, Node 24)
- Site dev-Server: `cd frontend && npx ng serve site`
- Studio-UI: `cd frontend && npx ng serve studio`
- Studio-API: `cd backend && dotnet run --project Studio.Api` → http://localhost:5451
- Publish ohne UI: `cd backend && dotnet run --project Studio.Api -- publish`
  (migriert, seedet bei leerer DB aus `data/seed.json`, schreibt `content/cv.de.json`)
- Tests: `cd frontend && npm run test:ci` bzw. `cd backend && dotnet test`
- CI: `.github/workflows/ci.yml`; Cloudflare-Deploy: `docs/setup-cloudflare-pages.md`

## Roadmap / Status

- [x] Phase 1 — Fundament: Workspace, Solution, CI, Doku (11.08.2026)
- [x] Phase 2a — Datenmodell mit Sichtbarkeitsflag, SQLite, Seed-Import, Publish-Pipeline,
      API (GET/PUT /api/cv, POST /api/publish) (11.08.2026)
- [x] Phase 2b — Studio-Editor-UI: Formulare für alle Bereiche, Sortieren/Hinzufügen/
      Entfernen, Speichern via PUT, Publish-Button (11.08.2026)
- [x] Phase 3a — Designphase: 5 Entwürfe (A–C dokumentenhaft verworfen — User will
      „atemberaubend"; D „Cinematic" gewählt, E Alternative), Designsystem fixiert
      in docs/design-system.md (11.08.2026)
- [x] Phase 3b — Site-Umsetzung: Sektions-Komponenten + Effekt-Direktiven nach
      Designsystem (gemeinsamer rAF-Loop, SSR-/Test-Guards, html.js-Gating,
      prefers-reduced-motion), Content typisiert aus content/cv.de.json zur Buildzeit
      mit berechneten Dauern/Statistiken, SSG via outputMode static, self-hosted
      Fonts, WebP-Porträt, Print-CSS als PDF-Weg v1 (11.08.2026)
- [x] Phase 4a — schema.org-JSON-LD (ProfilePage/Person, aus Content abgeleitet,
      im Prerender-HTML) (11.08.2026)
- [x] Phase 4b — Unterseiten /now, /uses, /making-of, /datenschutz mit Routing
      (alle Routen prerendert, anchorScrolling, View Transitions); bewusst ohne
      Impressum; Seiteninhalte liegen als Templates im Repo, nicht im Studio
      (11.08.2026)
- [ ] Phase 5 — Cloudflare Pages + elstner.ch, Launch

Datenquelle für den Erstimport ist der private Lebenslauf (lokal, außerhalb des Repos).
