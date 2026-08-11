# ADR 0002: Keine Live-KI auf der öffentlichen Seite

Status: akzeptiert (11.08.2026)

## Kontext

„Frag meinen Lebenslauf"-Chatbots sind als Bauübung Massenware (allein 2026 rund
1.000 neue GitHub-Repos), ohne belastbare Evidenz für positive HR-Wirkung; DACH-HR
reagiert auf KI-Bewerbungsartefakte eher skeptisch. Öffentliche LLM-Endpoints bringen
zudem Prompt-Injection-, Kosten- und Halluzinationsrisiken — Details in der
[Prior-Art-Recherche](../recherche/2026-08-11-ki-cv-prior-art.md).

## Entscheidung

Die Seite enthält keine Live-KI. KI-Kompetenz wird über Inhalte gezeigt: eine
Making-of-Seite zum Claude-Code-Workflow dieses Projekts und Projekt-Fallstudien.

## Konsequenzen

- Keine API-Keys, keine laufenden Kosten, kein Abuse-Vektor, keine Halluzinationen
  über die eigene Person.
- Datenmodell und Architektur halten die Option offen (strukturierte Inhalte sind
  RAG-tauglich). Neubewertung nach Launch möglich; die Rigor-Lücken der Prior Art
  (publizierte Evals, dokumentierter Abuse-Schutz, belegte Antworten) sind in der
  Recherche festgehalten.
