# ADR 0001: Öffentliche Seite statisch, Content-Backend privat

Status: akzeptiert (11.08.2026)

## Kontext

Die CV-Website braucht pflegbare, strukturierte Inhalte, aber kein Login und keine
dynamischen Serverfunktionen. Öffentliche Gratis-Hosts für .NET sind rar und haben
Haken (Cold Starts, Kreditkartenpflicht, ephemerer Storage — siehe
[Hosting-Recherche](../recherche/2026-08-11-hosting.md)). Ein öffentlich erreichbares
Backend wäre außerdem Angriffsfläche und Wartungslast für eine Ein-Personen-Seite.

## Entscheidung

Die öffentliche Seite wird zur Buildzeit vollständig statisch erzeugt (Angular SSG)
und über Cloudflare Pages ausgeliefert. Inhalte werden in einem privaten, nur lokal
laufenden Studio (.NET 10 + SQLite + Angular-Admin) gepflegt und als versionierte
JSON-Artefakte nach `content/` publiziert; der Site-Build liest ausschließlich `content/`.

## Konsequenzen

- Kein öffentliches Laufzeit-Backend: keine Serverkosten, keine Angriffsfläche,
  keine Cold Starts; Hosting 0 €.
- Content-Änderungen erfordern Publish + Git-Push + CI-Build — bewusst akzeptiert,
  die Publish-Frequenz ist niedrig.
- SQLite-DB und Rohdaten bleiben lokal (gitignored); ins öffentliche Repo gelangt
  nur, was ohnehin auf der Website steht.
- Falls später doch eine öffentliche API nötig wird: Render Free oder Self-Host
  hinter Cloudflare Tunnel (siehe Hosting-Recherche).
