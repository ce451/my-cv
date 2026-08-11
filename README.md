# my-cv

Quellcode meiner CV-/Portfolio-Website ([elstner.ch](https://elstner.ch)) — im Aufbau.

**Architektur:** Die öffentliche Seite (Angular 22) wird rein statisch gebaut und über
Cloudflare Pages ausgeliefert. Inhalte pflege ich in einem privaten, nur lokal laufenden
Backend („Studio", .NET 10 + SQLite) und veröffentliche sie als versionierte
JSON-Artefakte nach `content/` — es gibt kein öffentliches Laufzeit-Backend.

| Pfad | Inhalt |
|---|---|
| `frontend/projects/site` | öffentliche Website (Angular, SSG) |
| `frontend/projects/studio` | Admin-UI des privaten Content-Backends |
| `backend/` | Studio-API (.NET 10) |
| `content/` | veröffentlichte Inhalte (JSON) |
| `docs/` | Architekturentscheidungen (ADRs) und Recherche |

Entwickelt mit Unterstützung von Claude Code; Arbeitsweise und Regeln: [CLAUDE.md](CLAUDE.md).
