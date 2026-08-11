# Recherche: Entwickler-CV-Websites 2025/26 — Markt, Referenzen, HR-Sicht

> Claude-Recherche vom 11.08.2026 für das Projekt CV-Website (Repo ce451/my-cv).
> Arbeitsdokument für die Konzeptphase. Quellen jeweils verlinkt; Unsicheres am Ende gekennzeichnet.

## A) Referenzbeispiele (verifiziert, Stand Aug 2026)

**Seriös / Senior / textbasiert — relevanteste Kategorie für dein Profil:**

1. **Max Böck — https://mxb.dev** (Wien, Frontend-Dev, Codista-Mitgründer). Textbasiert, IndieWeb-Prinzipien (RSS, Webmentions), Persönlichkeit über ein ungewöhnliches Theme-System (Mario-Kart-64-Streckennamen) statt über Effekte. Bestes DACH-Referenzbeispiel für "seriös mit Charakter".
2. **Felix Krause — https://krausefx.com** (Österreich, fastlane-Gründer, ContextSDK). Reputationsaufbau rein über Substanz: technische Essays und Projekt-Deep-Dives; explizites Statement "all my blog posts are handcrafted" als Anti-KI-Signal.
3. **Rauno Freiberg — https://rauno.me** (Interaction Designer, Vercel). Minimal, aber jedes Detail sitzt; die Seite selbst ist der Kompetenznachweis ("Make it fast. Make it beautiful. Make it consistent…"). Vorbild für "Craft statt Spektakel".
4. **Anthony Fu — https://antfu.me** (Vitest/VueUse/UnoCSS). Textfokussiert, Projekte/Talks/Blog im Vordergrund, dezente generative Details. Beleg, dass Top-Engineers auf Deko verzichten.
5. **Josh W. Comeau — https://www.joshwcomeau.com** Blog-getrieben; Mikrointeraktionen und Animationsdetails demonstrieren Frontend-Können im Inhalt selbst, nicht als Selbstzweck.

**Kreativ-Showpieces (Kalibrierung der oberen Grenze — für dein Ziel eher Gegenmodell):**

6. **Bruno Simon — https://bruno-simon.com** Das berühmteste 3D-Portfolio (Three.js-Fahrwelt). Achtung, lehrreiches Detail: Beim Abruf meldet die Seite "Server currently offline. Scores can't be saved" — Spektakel-Portfolios haben Wartungskosten.
7. **Samuel Honigstein (Samsy) — samsy.ninja** ("Gen-02"): Awwwards Site of the Day + Developer Award Okt 2025, Vue/GSAP/WebGL-Räume ([Awwwards](https://www.awwwards.com/sites/gen-02-smsy-portfolio)).
8. **Jesse Zhou — https://www.jesse-zhou.com** 3D-Ramen-Shop als Navigation; oft zitiertes Beispiel für "Thema konsequent durchgezogen" ([WeAreDevelopers](https://www.wearedevelopers.com/en/magazine/561/web-developer-portfolio-inspiration-and-examples-march-2025-561)).
9. **Jordan Cruz-Correa — https://jccdev.vercel.app** Windows-98-Interface mit funktionierendem Notepad/Papierkorb — Retro-Thema als kohärentes UI, nicht als Gimmick (gleiche Quelle).

**Der Sonderfall:**

10. **Brittany Chiang — https://brittanychiang.com** Das meist-geforkte Dev-Portfolio (v4: 8.2k GitHub-Stars, unzählige Klone). Handwerklich exzellent (textlastig, Cursor-Glow, dezente Navigation) — aber genau deshalb heute ein Klon-Erkennungsmuster; das Layout gilt inzwischen als "Template" ([GitHub v4](https://github.com/bchiang7/v4)).

*Randnotiz:* cassie.codes (früher Standard-Empfehlung für verspielte SVG-Animation) ist inzwischen eine Abschiedsseite — Beispiel-Listen im Netz veralten schnell, Empfehlungen vor Übernahme prüfen.
*Verzeichnisse für weitere Recherche:* [Awwwards Portfolio-Kategorie](https://www.awwwards.com/websites/winner_category_portfolio/), [Muzli Top 100](https://muz.li/blog/top-100-most-creative-and-unique-portfolio-websites-of-2025/).

## B) Klischee-/Vermeidungsliste

| Klischee | Beleg |
|---|---|
| **Skill-Prozentbalken / Sterne-Ratings** — mehrfach unabhängig als sinnlos belegt: keine nachvollziehbaren Kriterien, Dunning-Kruger-anfällig, für ATS-Parser unsichtbar, "Template-Default, das visuelle Äquivalent eines Stockfotos" | [dev.to](https://dev.to/tim012432/do-not-put-skill-bars-on-your-resume-lh6), [dev.to/iamzoka](https://dev.to/iamzoka/don-t-use-progress-bars-in-your-cv-feb), [Hiration](https://www.hiration.com/blog/skill-bars-resume/), [uxfol.io](https://blog.uxfol.io/ux-resume-what-to-include/) |
| **Brittany-Chiang-Klon-Layout** (dunkler Hintergrund, linke Sidebar, "01. About"-Nummerierung) — als meist-geforktes Portfolio sofort erkennbar | [GitHub-Forks](https://github.com/bchiang7/v4) |
| **KI-Slop-Ästhetik**: Indigo/Lila-Gradient + Inter + drei Icon-Kacheln im Grid. 2025 breit dokumentiertes Phänomen; Tailwind-Mitgründer Wathan entschuldigte sich scherzhaft für `bg-indigo-500` als Ursache | [dev.to](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p), [Medium](https://medium.com/@ai.in.motion.blog/the-purple-problem-why-ai-cant-stop-generating-purple-websites-4381fb066883) |
| **Splash-Screens, Hintergrundmusik, verschachtelte Navigation** — "clarity beats cleverness" | [Devoted Studios](https://devotedstudios.com/how-to-build-a-portfolio-hiring-managers-cant-ignore/), [Artisan Talent](https://creative.artisantalent.com/portfolio-red-flags-for-hiring) |
| **Tutorial-Projekt-Grids** (To-do-App, Weather-App) statt weniger echter Projekte; 3–5 polierte schlagen 10+ triviale | [Hakia](https://hakia.com/skills/building-portfolio/), [Pesto](https://pesto.tech/resources/what-recruiters-look-for-in-developer-portfolios) |
| **Clutter aus HR-Sicht**: mehrspaltige Layouts, fehlende Abschnitts-Header, wenig Weißraum — scheitern im 7,4-Sekunden-Scan | [Ladders-Studie (PDF)](https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf) |
| **Bunte Designs/Animationen, Textwände, tote Links, veraltete Inhalte** — explizite DACH-HR-Warnung | [Karrierebibel](https://karrierebibel.de/bewerbungshomepage/) |
| **Typewriter-Hero ("I'm a developer\|")** — allgegenwärtig in Templates ([GitHub-Topic](https://github.com/topics/typewriter-effect?l=css)); *Einschränkung: als "verbreitet" belegt, die Bewertung "abgenutzt" ist Community-Konsens, hierfür keine harte Einzelquelle* | — |

## C) Was HR laut Quellen überzeugt

**Kernzahlen:**
- **profy.dev-Umfrage, 60+ Hiring Manager**: 93 % würden sich die Website eines unerfahrenen Kandidaten wahrscheinlich ansehen, 65 % sicher — aber 51 % sagen, ohne Website sind die Chancen nicht schlechter. Fazit der Studie: „Die Website ist der Container, die Projekte sind der Inhalt." Pflicht, wenn vorhanden: responsive, keine toten Links, aktuell. ([profy.dev](https://profy.dev/article/portfolio-websites-survey), [Spiegel auf dev.to](https://dev.to/profydev/this-survey-among-60-hiring-managers-reveals-don-t-waste-your-time-on-a-react-portfolio-website-17ge))
- **Ladders-Eye-Tracking**: 7,4 Sekunden Erst-Scan; erfolgreich sind einfache Layouts, klare Abschnitte/Überschriften, F-Muster-Lesbarkeit, fette Titel, Bullet-Erfolge ([HR Dive](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/), [Studien-PDF](https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf))
- Übersichtliche Struktur als wichtigster Lebenslauf-Aspekt für 87 % der Personalverantwortlichen — *Zahl aus Suchergebnis-Umfeld von stepstone.at/lebenslauf.at, seitengenau nicht verifiziert* ([stepstone.at](https://www.stepstone.at/Karriere-Bewerbungstipps/tabellarischer-lebenslauf/))
- 84 % der Arbeitgeber wollen laufende Anwendungen sehen, nicht nur Repos — *Sekundärangabe aus* [Hakia](https://hakia.com/skills/building-portfolio/)

**DACH-Konventionen (konservativer als US-Portfolio-Ästhetik):**
- **Foto**: keine Pflicht (GlBG in AT, AGG in DE), aber weiterhin üblich und in vielen Branchen erwartet — im Gegensatz zu den USA ([karriere.at](https://www.karriere.at/c/a/foto-im-lebenslauf), [lebenslaufapp.at](https://lebenslaufapp.at/blog/foto-im-lebenslauf), [CVOwl EU vs. USA](https://www.cvowl.com/blog/resume-photo-expectations-in-europe-vs-usa))
- **Struktur**: tabellarisch, antichronologisch (aktuellste Station zuerst), max. zwei Schriftarten ([karriere.at](https://www.karriere.at/c/a/tabellarischer-lebenslauf), [stepstone.at](https://www.stepstone.at/Karriere-Bewerbungstipps/tabellarischer-lebenslauf/))
- **Bewerbungshomepage aus DACH-HR-Sicht**: sinnvoll als Ergänzung, nie Ersatz der klassischen Unterlagen; empfohlene Elemente: Profil, Lebenslauf, Arbeitsproben, **Download-Bereich für Dokumente**; „Personaler haben grundsätzlich keine Zeit"; Pflicht: **vollständiges Impressum + DSGVO-konforme Datenschutzerklärung** ([Karrierebibel](https://karrierebibel.de/bewerbungshomepage/), [EXPERTE.de](https://www.experte.de/homepage-erstellen/bewerbungshomepage) — dort: für Programmierer eine der wenigen Berufsgruppen mit klar positivem Kosten-Nutzen-Verhältnis, „erste überzeugende Arbeitsprobe")
- Ladezeit/Performance: von HR-Quellen nicht explizit mit Zahlen belegt — nur indirekt über „keine Zeit"/Absprung. *Als unverifiziert einstufen, aber risikoarm anzunehmen.*

## D) Differenzierungschancen, die kaum jemand nutzt

1. **Ein HTML als Single Source of Truth mit Print-Stylesheet**: dieselbe Seite liefert am Bildschirm die Website und über `@media print`/CSS Paged Media einen DACH-konformen, seitenumbruch-kontrollierten PDF-Lebenslauf ([Jack Wrenn: PDF-Resume aus HTML](https://jack.wrenn.fyi/blog/pdf-resume-from-html/), [DiDoesDigital Print-Styles](https://didoesdigital.com/blog/print-styles/), [print-css.rocks](https://print-css.rocks/), [Paged.js](https://rstudio.github.io/pagedown/)). Passt exakt zum bestehenden Workflow (HTML führend) und bedient die DACH-Erwartung „PDF zum Download". Praktisch kein Portfolio bietet das.
2. **schema.org `Person`/`ProfilePage` als JSON-LD**: von Google offiziell dokumentiertes Markup, macht die Seite maschinenlesbar für Suchmaschinen und Recruiter-/KI-Tools; auf Entwickler-Portfolios fast nie vorhanden ([Google-Doku](https://developers.google.com/search/docs/appearance/structured-data/profile-page)).
3. **Zwei Lesepfade statt Einheitsseite**: HR-Pfad (7-Sekunden-tauglich: tabellarischer CV, Foto, PDF, Kontakt) und Tech-Pfad (Code, Architektur-Entscheidungen, GitHub). *Synthese aus profy.dev + Ladders + Karrierebibel, kein Standard-Pattern — genau deshalb Differenzierung.*
4. **/now- und /uses-Seiten**: etablierte, seriöse Konventionen der internationalen Dev-Szene ([sive.rs/nowff](https://sive.rs/nowff), [nownownow.com](https://nownownow.com/about) 2300+ Einträge, [uses.tech](https://uses.tech) ~930 Einträge) — im DACH-Raum praktisch unbekannt; wirkt persönlich ohne Selbstvermarktung.
5. **Tiefe statt Grid**: 2–3 Projekte als Fallstudien mit Kontext, Entscheidungen, Metriken, Live-Demo — Hiring Manager bewerten „Thinking, nicht Output" ([Artisan Talent](https://creative.artisantalent.com/portfolio-red-flags-for-hiring), [Devoted Studios](https://devotedstudios.com/how-to-build-a-portfolio-hiring-managers-cant-ignore/)).
6. **Bewusste Anti-KI-Slop-Gestaltung**: eigenständige Typografie/Farbwelt abseits von indigo-500/Inter/Icon-Kacheln ist 2025/26 ein echtes Echtheitssignal ([dev.to](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p)); Krause macht das explizit mit „handcrafted"-Statement ([krausefx.com](https://krausefx.com)).
7. **Craft statt Spektakel**: dezente, perfekt sitzende Mikrointeraktionen (Vorbilder rauno.me, joshwcomeau.com) statt WebGL-Show — auch wegen Wartungsrisiko (Bruno Simons Score-Server offline) und weil DACH-HR Animationen eher negativ bewertet (Karrierebibel).
8. **Sauberes Impressum/DSGVO als Professionalitätssignal**: in DACH ohnehin Pflicht ([Karrierebibel](https://karrierebibel.de/bewerbungshomepage/)), international auf Portfolios quasi nie vorhanden — signalisiert einem österreichischen HR-Betrachter Sorgfalt.

## E) Status Tools/Standards

- **read.cv: tot.** Jan 2025 von Perplexity übernommen, Betrieb eingestellt, Datenexport bis 16.05.2025 ([TechCrunch](https://techcrunch.com/2025/01/17/perplexity-acquires-read-cv-a-social-media-platform-for-professionals/)). Die .cv-Domains gingen an [Hello.cv](https://hello.cv/) — heute ein KI-Resume-Builder.
- **JSON Resume: aktiv.** Offener Standard (`resume.json`, Schema 1.0.0), Community-Themes, Gist-basierte [Registry](https://registry.jsonresume.org/) ([jsonresume.org](https://jsonresume.org/), [GitHub](https://github.com/jsonresume)). Als Datenbackbone nutzbar, Themes selbst wirken meist generisch.
- **Reactive Resume: aktiv.** Open Source, selbst-hostbar; seit v5.1.0 clientseitige PDF-Generierung ohne Chromium-Abhängigkeit ([rxresu.me](https://rxresu.me/), [Docs](https://docs.rxresu.me/)). Builder-Kategorie — nur als Referenz interessant.
- **schema.org**: `Person` + `ProfilePage` (JSON-LD) sind der von Google dokumentierte Weg ([Google](https://developers.google.com/search/docs/appearance/structured-data/profile-page)).
- **Print/PDF**: CSS Paged Media + `break-inside` etc. für Browser-Print; Paged.js für paginierte Ausgabe; headless Chromium für automatisierten Export ([print-css.rocks](https://print-css.rocks/), [DiDoesDigital](https://didoesdigital.com/blog/print-styles/), [Jack Wrenn](https://jack.wrenn.fyi/blog/pdf-resume-from-html/)).

**Ausdrücklich unsicher/nicht hart belegt:** Typewriter-Effekt als „Klischee" (nur Verbreitung belegt), die 87-%- und 84-%-Umfragezahlen (Sekundärangaben), Ladezeit-Erwartungen von HR (keine Primärquelle), Awwwards-Einzelnennungen aus Suchsnippets (Artiom Yakushev, Elliott Mangham — URLs nicht einzeln verifiziert).
