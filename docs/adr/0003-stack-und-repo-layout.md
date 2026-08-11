# ADR 0003: Stack Angular 22 + .NET 10, ein Repo

Status: akzeptiert (11.08.2026)

## Kontext

Vorgabe: Angular + .NET (vorhandene Berufserfahrung vertiefen). .NET 8 und 9
erreichen beide am 10.11.2026 das Support-Ende; aktuelle LTS ist .NET 10.
Angular steht bei v22 (SSG via `outputMode: "static"`).

## Entscheidung

- Ein öffentliches Monorepo, das zugleich Arbeitsprobe ist: ein Angular-Workspace
  (`frontend/` mit den Projekten `site` und `studio`), eine .NET-Solution
  (`backend/`, `.slnx`), `content/` als Publikationsschnittstelle, `docs/` für
  ADRs und Recherche.
- Versionen: Angular 22 mit Node 24 (`.nvmrc`), .NET 10 LTS (`global.json`).
- Die Site startet auf Deutsch, wird aber i18n-fähig gebaut; das Verfahren
  (Angular-i18n vs. Runtime-Übersetzung) wird in der Designphase entschieden,
  bevor echte Texte entstehen.

## Konsequenzen

- Studio-Code ist öffentlich (bewusst: Arbeitsprobe), Studio-Daten nicht
  (gitignored, siehe ADR 0001).
- Gemeinsame Content-Typen zwischen `site` und `studio` werden ab Phase 2 als
  Library im Angular-Workspace geteilt.
- Test-Stack wie generiert: vitest (Frontend), xunit (Backend).
