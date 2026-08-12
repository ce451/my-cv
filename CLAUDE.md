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
  private Gmail-Adresse. Öffentlicher Kontakt: „jobs" auf der Domain der Seite
  (seit 12.08.2026). **Die Adresse steht nirgends im Repo oder in öffentlichen
  Ausgaben im Klartext** (Spam-Schutz, Anweisung 12.08.2026): Der PublishMapper
  kodiert E-Mail-Kontakte Base64, das Prerender-HTML zeigt nur den Platzhalter
  „E-Mail", und `ui/email-link.ts` setzt Adresse + mailto erst nach der
  Hydration ein. Auch in Doku und Commit-Messages die Adresse nicht wörtlich
  ausschreiben.
  Das vollständige Bewerbungs-PDF (mehr Daten) und die öffentliche Fassung sind zwei
  Sichten auf denselben Datenbestand → das Datenmodell braucht ein Sichtbarkeitsflag.
  **Bewusst kein Impressum** (Entscheidung 11.08.2026); die /datenschutz-Seite bleibt
  minimal und ohne Adresse. Vor breiter Streuung der Seite neu bewerten.
  **Keine Kundennamen aus Projekten in öffentlichen Ausgaben** (Anweisung
  11.08.2026): Projektkunden und Projektnamen der Arbeitgeber (z. B. aus der
  Individualentwicklung) erscheinen weder auf der Website noch im öffentlichen
  PDF. Eigene Arbeitgeber sind ok, auch bei den Praktika (alle sechs stehen
  auf seine Anweisung wieder einzeln mit Namen auf der Seite).
- **Ton aller sichtbaren Texte:** sachlich und konkret, keine Selbstvermarktungs-Floskeln,
  keine KI-typischen Formulierungen. Zahlen und Fakten statt Adjektive.
  **Keine Gedankenstriche (Em-Dashes) in sämtlichen Texten des Projekts**
  (Anweisung 11.08.2026; gilt für Website, PDF-Varianten, Doku und Commits):
  stattdessen Doppelpunkt, Komma, Semikolon oder ·. Der Bis-Strich (–) in
  Zeiträumen wie „2008 – 2013" bleibt erlaubt.
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

## Code-Wegweiser (schneller Einstieg)

Site-Struktur unter `frontend/projects/site/src/app/`:

- `content/` — `cv-data.ts` (Buildzeit-Import von content/cv.de.json), `cv-format.ts`
  (Zeiträume, Dauern, Statistiken — berechnet, nie hartkodiert), `schema.ts` (JSON-LD)
- `ui/ui-text.ts` — alle UI-Strings zentral (i18n-light, ADR 0004)
- `fx/` — Effekte: `fx-loop.ts` (ein gemeinsamer rAF-Loop), `motion.ts` (Guards),
  `reveal`/`letters`/`counter`/`tilt`/`magnetic` (Direktiven), `particles`/`cursor`
  (Komponenten). Muster überall gleich: Init in `afterNextRender`, Guards für
  SSR/jsdom/reduced-motion/Pointer-Typ, Cleanup über `DestroyRef`.
- `sections/` — Hero, IntroStats, Timeline, Projects, Skills, Education, Contact;
  `pages/` — Home (Sektionen) + /making-of, /datenschutz
- Styles global in `styles.scss` (Tokens → Bühne → Sektionen → Unterseiten → Print →
  reduced-motion). Reveal-Ausblendung greift nur unter `html.js` (No-JS bleibt lesbar).

Content-Typen ändern — immer in dieser Reihenfolge:
Backend-DTO (`Contracts/`) + Entity + `CvMapper`/`PublishMapper` + EF-Migration →
TS-Typen in `content-model` (danach `npx ng build content-model`) →
Studio-Editorformulare → Tests nachziehen (der Visibility-Leak-Test in
`PublishMapperTests` ist Pflicht) → Studio-Publish → commit/push.

Deploy: Push auf `main` → CI (frontend + backend) → nur bei Grün Deploy auf das
Cloudflare-Pages-Projekt `elstner-cv` → https://elstner.ch (GitHub-Secrets:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). PRs/Branches deployen nicht.

Sonderdateien in `frontend/projects/site/public/` (landen 1:1 im Deploy-Root):
`_headers` (Security- und Cache-Header inkl. CSP — die script-src-Hashes decken
die Inline-Skripte des Prerenders ab; `tools/verify-csp.mjs` prüft das in der CI
und schlägt nach Angular-Updates an), `404.html` (deaktiviert den
Pages-SPA-Fallback → echte 404s), `robots.txt`, `sitemap.xml`, `og-image.png`,
`fonts/` (Latin-Subsets + OFL.txt; via `@font-face` in styles.scss und
`preload` in index.html — kein @fontsource mehr). Host-Redirects (www → Apex)
kann Pages-`_redirects` NICHT — das geht nur als Redirect Rule auf Zone-Ebene
im Dashboard (Kontrast: Canonical-Tags fangen das SEO-seitig bereits ab).

Neue Route? Dann immer: in `app.routes.ts` eintragen, im Komponenten-Konstruktor
`PageHead.apply(...)` aufrufen (Canonical/Description/OG/JSON-LD, siehe
`ui/page-head.ts`), `sitemap.xml` erweitern.

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
      (11.08.2026). /now und /uses in Phase 6 wieder entfernt.
- [x] Phase 5 — Live auf Cloudflare Pages + Custom Domain https://elstner.ch,
      Deploy nur nach grünem CI (11.08.2026)
- [x] Phase 6 — Feinschliff nach User-Feedback (11.08.2026): Hero mit Tagline,
      Highlights-Zeile und größerem Porträt; CE-Favicon (SVG + ICO + Apple-Touch);
      Cursor-Ring +25 % mit Amber-„Planet", nativer Cursor versteckt; hellere
      Partikel; Stat „Technologien im Projekteinsatz" statt Betriebszugehörigkeit;
      Projektkarten mit Repo-Links (Schema: Profile.Tagline/Highlights,
      PersonalEntry.Links + Migration); „Firewall" aus den Skills gestrichen;
      /now und /uses entfernt; Timeline-Punkte pixelgenau auf der Linie
- [x] Phase 7 — Technik-Härtung nach unabhängigem Review (11.08.2026):
      Open-Graph/Twitter-Tags + og-image (1200×630), Canonical + eigene
      Description + korrektes JSON-LD pro Route (Person um knowsAbout/
      hasOccupation/worksFor/@id erweitert; Unterseiten als WebPage),
      robots.txt + sitemap.xml + echte 404-Seite,
      Security-Header (HSTS, CSP mit Hash-Allowlist + CI-Wächter
      tools/verify-csp.mjs, frame-ancestors, Permissions-Policy),
      immutable-Cache für gehashte Assets, Fonts direkt self-hosted mit
      preload (statt @fontsource, Mono nur noch 400), Kontrastfix --faint
      (AA), Mobil-Nav mit Sektionslinks, Icons verkleinert
- [x] Phase 8 — „Runde Sache" (11.08.2026): Kundenprojekte und Kundennamen
      komplett entfernt (neue Datenschutz-Regel oben), Rolle öffentlich
      „Senior Full-Stack Softwareentwickler", neue Tagline („Zwölf Jahre Code,
      der in Fabriken und Arztpraxen läuft"), Redundanzen gestrafft
      (DE/EN, Anforderung-bis-Support), Praktika auf eine Zeile ohne Namen,
      Präsenzdienst raus, HTBLA ausgeschrieben + Matura, Stat-Box zählt
      jetzt die Kenntnisse-Liste, Making-of von der Projekt-Sektion verlinkt
      und entschlackt (FamHub/82-KB/0-€ raus, CSP-Zeile rein), laufende
      Station ohne Dauer mit Puls-Punkt, Cursor als „Atom" (Teal-Kern +
      drei Amber-Elektronen mit Canvas-Schweif auf präzedierenden Ellipsen),
      Mobil ganz ohne Kopfleiste, Partikel resize-stabil (URL-Leiste),
      Magnetic-CTA gleitet statt springt
- [x] Phase 9 — Nachzügler (11.08.2026, spätabends): Em-Dash-Verbot projektweit
      umgesetzt (Ton-Regel oben, Titel-Trenner jetzt ·), Praktika wieder alle
      sechs einzeln sichtbar, PDF-Option komplett entfernt (Nav-Button und
      Kontakt-Link raus; das Print-Stylesheet für Strg+P bleibt), Intro neu
      („Zuhören, bauen, ausliefern, dranbleiben: …"), Tagline final
      „12 Jahre Code, Projekt- und Teamarbeit", Cursor-Elektronen weiß mit
      Ruhe-Schweifen (12→30 Segmente) und größeren Bahnen (18/26/34px);
      Kopfleiste komplett entfernt, stattdessen Nach-oben-Button unten
      rechts mit Lesefortschritts-Ring; Custom Scrollbar in Teal
- [x] Phase 10 — Externes Feedback eingearbeitet (12.08.2026): HGS-Station
      ausgebaut (4 anonymisierte Projekt-Bullets ohne Kundennamen,
      Junior-zu-Senior als Entwicklung in der Summary, „rund zehn Kunden"
      vom User bestätigt); Long-Polling mit belegter Zahl („im Leerlauf
      über 80 % weniger Requests": Evidenz 10-s-Polling vorher vs. 60-s-Hold
      nachher, aus den Arbeits-Repos verifiziert, nur die Zahl öffentlich);
      Dauer-Angaben im Werdegang komplett entfernt (nur noch Zeiträume +
      Puls bei laufender Station); Präsenzdienst wieder drin; Cursor-Kern
      mit leichtem Glow. Stat-Mitte („28 Technologien") auf User-Entscheid
      vorerst behalten.
- [x] Phase 11 — Kontakt-Mail live (12.08.2026): primärer CTA in der
      Kontakt-Sektion (LinkedIn als Alternative), in der Hero-Meta-Zeile
      (zweizeilig: Kontakte oben, Skills darunter), im Footer und auf
      /datenschutz. Spam-Schutz wie oben beschrieben (Base64 in der
      Publish-Pipeline, Platzhalter im Prerender, Einsetzen nach Hydration);
      Cloudflares Email-Obfuscation per email_off-Marker deaktiviert, weil
      die Edge-Umschreibung mit Angulars Hydration kollidiert (Adresse wurde
      doppelt gerendert). Cursor-Canvas-DPR-Bug auf skalierten Monitoren
      gefixt (fehlende CSS-Größe).

## Offene Punkte

- Lebenslauf-PDF: Entscheidung 11.08.2026 (spätabends): Es gibt bewusst KEINE
  PDF-Option auf der Seite (Buttons entfernt). Die bereinigte Vorlage
  `~/nas/Beruf/01_Unterlagen/lebenslauf-public.html` bleibt auf der NAS
  liegen, falls das Thema wiederkommt. Headless-Rendering funktioniert auf
  dieser Maschine nicht (Playwright-Chromium rendert keinen Text, Vivaldi-
  CLI-Print hängt); PDFs druckt der User selbst.
- GitHub Actions bei Gelegenheit auf checkout/setup-node v5 (Node-20-Deprecation).
- Vor breiter Streuung: Impressum-Frage neu bewerten.
- Aus dem Review vom 11.08.2026 bewusst offen: Content-Feinschliff (wartet auf
  User-Review), JS-Bundle-Verkleinerung (Effekte lazy laden — größerer Umbau),
  GitHub-Profil/READMEs befüllen (liegt außerhalb dieses Repos beim User),
  www→Apex-301 als Redirect Rule im Cloudflare-Dashboard (1 Klick beim User —
  Vorlage „Redirect from WWW to Root"; bis dahin neutralisieren die
  Canonical-Tags das Duplikat).
  Volltext der Reviews: NAS, 05_Skills/cv-website-recherche/
  2026-08-11-unabhaengiges-review.md.

Datenquelle für den Erstimport ist der private Lebenslauf (lokal, außerhalb des Repos).
