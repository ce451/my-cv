# Recherche: Prior Art KI-interaktive Lebenslauf-/Portfolio-Websites (2024–2026)

> Claude-Recherche vom 11.08.2026 für das Projekt CV-Website (Repo ce451/my-cv).
> Entscheidung am 11.08.2026: **keine Live-KI auf der Seite** — KI-Kompetenz wird über Inhalte gezeigt (Making-of, Fallstudien). Dieses Dokument bleibt als Beleg der Entscheidungsgrundlage und für eine spätere Neubewertung.

## (1) Verbreitung: Auf GitHub Klischee, als Produkt/Standard nicht

- GitHub-Suche „resume chatbot": **2.041 Repos**, „portfolio chatbot": **3.134 Repos**.
- Neue „resume chatbot"-Repos: 2023: 53 → 2024: 163 → 2025: 791 → **2026 bis 11.08.: 976** (mehr als das gesamte Vorjahr).
- Aber kein Leuchtturm-Projekt: höchste Stars 190 ([Resume-Screening-RAG-Pipeline](https://github.com/Hungreeee/Resume-Screening-RAG-Pipeline), Screener) bzw. 44 ([medevs/smart-portfolio](https://github.com/medevs/smart-portfolio)).
- Tutorials/Templates überall (dev.to, Medium, Towards AI, Packt); Google-Cloud-Tutorial schon 2021 mit Dialogflow. Interaktive Resumes seit Robby Leonardi 2013.
- **Auf Hacker News fast keine Resonanz** — Ausnahme: [Show HN „My AI Native Resume" (Jake Gaylor, MCP-Server), 05.05.2025: 301 Punkte](https://news.ycombinator.com/item?id=43891245).
- Mainstream-Presse: [CNBC Make It, 30.04.2026, zwei Jobsuchende mit CV-Chatbots](https://www.cnbc.com/2026/04/30/these-2-job-seekers-built-ai-chatbots-to-talk-to-recruiters-for-them.html).

**Subgenres:**
- Terminal-Portfolios statisch = Commodity ([Topic](https://github.com/topics/terminal-portfolio)); mit echtem LLM = selten, keines >30★.
- **CV als MCP-Server**: Mikro-Genre; nach Gaylor nur Nachahmer mit 0–5★; Gaylors [node-candidate-mcp-server: 81★](https://github.com/jhgaylor/node-candidate-mcp-server).
- **llms.txt**: Beweislast dagegen — [Ahrefs 05/2026: 97% aller llms.txt bekommen null Requests](https://ahrefs.com/blog/llmstxt-study/); [John Mueller: vergleichbar mit Keywords-Meta-Tag](https://www.searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/).
- Generator-Produkte: nur Beta-Indie-SaaS ([chatmycv.app](https://www.chatmycv.app/), [chatmyresu.me](https://chatmyresu.me/)); Chatfolio bereits tot.
- **DACH: praktisch leer.** Dreifacher Negativbefund (keine Beispiele, keine heise/golem/t3n-Coverage, keine Produkte).

**Fazit:** Als Bau-Übung international ein Klischee — als ausgereiftes Feature nicht. Ein weiterer simpler RAG-Chatbot beweist 2026 nichts mehr.

## (2) Konkrete Beispiele mit Technik

| # | Projekt | Technik | Kostenkontrolle |
|---|---|---|---|
| 1 | [Jake Gaylor „AI Native Resume"](https://github.com/jhgaylor/node-candidate-mcp-server) (81★) | MCP-Server (Streamable HTTP + SSE), A2A Agent Card, llms.txt-Fallback | nicht dokumentiert |
| 2 | [medevs/smart-portfolio](https://github.com/medevs/smart-portfolio) (44★) | Next.js 15, LangChain-RAG, OpenAI, Supabase pgvector | keine |
| 3 | [nikolailehbrink/portfolio](https://github.com/nikolailehbrink/portfolio) (35★) | Astro + LlamaIndex.TS + OpenAI | keine |
| 4 | [anujjainbatu/portfolio](https://github.com/anujjainbatu/portfolio) (27★) | Next.js-Template, JSON-konfiguriert, Gemini | Free-Tier + Fallback |
| 5 | [okasputra-Tutorial 12/2025](https://dev.to/okasputra/stop-sending-static-resumes-how-i-built-a-chat-with-my-resume-bot-nextjs-rag-4kdm) | Next.js 15 + Express, gpt-4o-mini, SSE | billiges Modell |
| 6 | [chihebnouri.live](https://dev.to/chih3b/i-built-an-ai-powered-portfolio-with-nextjs-supabase-groq-heres-how-mm0) | Next.js + Supabase, Groq/Llama 3.3, Terminal + Voice | Groq-Free-Tier |
| 7 | [ghotet 06/2025](https://dev.to/ghotet/i-just-wanted-a-portfolio-now-i-have-an-interactive-local-ai-front-end-that-doubles-as-a-resume-561c) | DOS-UI, **LLM komplett im Browser, kein Backend** | strukturell keine API |
| 8 | „VAi" + „ChatJC" ([CNBC 04/2026](https://www.cnbc.com/2026/04/30/these-2-job-seekers-built-ai-chatbots-to-talk-to-recruiters-for-them.html)) | CV+LinkedIn als Quellen; Guardrails: nur Quellenmaterial, anonymes Frage-Logging | Stack nicht offengelegt |

Produkte: chatmyresu.me (Free 10 Chats/Mon, Pro $9/200 Chats), airesume.chat ($19,99/Mon). Muster: fast immer Backend-Proxy + billiges Modell.

## (3) Probleme + real eingesetzte Gegenmaßnahmen

- **Prompt Injection** = [OWASP LLM01:2025 Risiko Nr. 1](https://genai.owasp.org/llmrisk/llm01-prompt-injection/). Referenzfälle: [Chevrolet-Bot verkauft Tahoe für $1](https://the-decoder.com/people-buy-brand-new-chevrolets-for-1-from-a-chatgpt-chatbot/), [DPD-Bot abgeschaltet](https://www.itv.com/news/2024-01-19/dpd-disables-ai-chatbot-after-customer-service-bot-appears-to-go-rogue). Portfolio-spezifisch: [renatoworks/ai-security](https://github.com/renatoworks/ai-security) dokumentiert 16 Injection-Techniken samt Tests.
- **Kosten-Runaway**: geleakte Keys binnen Minuten missbraucht; „LLMjacking" Worst Case >$46.000/Tag ([Sysdig](https://www.sysdig.com/blog/llmjacking-stolen-cloud-credentials-used-in-new-ai-attack)).
- **Halluzination über die eigene Person**: meistgenannte Sorge in [HN-Diskussion](https://news.ycombinator.com/item?id=38245665); Haftungs-Präzedenz: [Air Canada haftet für Chatbot-Auskunft](https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416).
- **Gegenmaßnahmen-Referenzstack** ([renatoworks/ai-security](https://github.com/renatoworks/ai-security)): Input-Sanitization, Zero-Trust-System-Prompt, Rate-Limit 15 Req/24h/IP, Input max. 500 Zeichen, Output-Cap 300 Tokens, kleines Modell, Provider-Budget-Cap. Ergänzend: [Upstash Ratelimit](https://ai-sdk.dev/docs/advanced/rate-limiting), [Vercel WAF](https://vercel.com/kb/guide/securing-ai-app-rate-limiting), [Cloudflare Turnstile](https://davidmuraya.com/blog/cloudflare-turnstile-invisible-bot-protection/), [WebLLM client-only](https://webllm.mlc.ai/).
- **Befund:** In den verbreiteten OSS-Repos/Tutorials ist keine dieser Maßnahmen dokumentiert — Best Practice und Massenpraxis klaffen auseinander.
- Kontext invers: Prompt Injection *im* Lebenslauf gegen Recruiter-KI breit dokumentiert; Anbieter werten sie als Red Flag mit Auto-Reject ([builtin](https://builtin.com/articles/hidden-ai-prompts-in-resume), [Mintz 07/2026](https://www.mintz.com/insights-center/viewpoints/2226/2026-07-13-ai-prompt-injections-emerging-risk-employers)).

## (4) Recruiter-/HR-Reaktionen: dünn, nur anekdotisch

- **Keine Umfrage, kein HR-Fachartikel spezifisch zu „Chat-with-my-resume"** (zweifach unabhängig gesucht, EN+DE — echte Datenlücke).
- Positiv (anekdotisch): CNBC-Fälle (VAi: 3.300 Views, 492 Fragen/30 Tage, ein Referral); protoconstruct 2023: „10x more people reaching out".
- Skeptisch: HN („you couldn't explain what your skills are…"); Recruiter installieren keine MCP-Clients; [„GitHub side projects after 2023 no longer reliable signal"](https://acflippo.substack.com/p/ai-broke-recruiting); ~1/5 der Hiring Manager lehnt KI-generierte Bewerbungen ab ([TopResume 2025](https://topresume.com/career-advice/ai-in-hiring-survey)); 67% der HR-Leader: KI-Bewerbungsflut verlangsamt Hiring ([Robert Half 03/2026](https://press.roberthalf.com/2026-03-10-Robert-Half-survey-67-of-HR-leaders-report-AI-generated-applications-are-slowing-hiring)). DACH: ~31% nutzen KI im Recruiting ([yena.ai](https://www.yena.ai/de/blog/ki-im-recruiting-studie-dach-2026)).

## (5) Wenig besetzte Winkel (falls später doch Live-KI)

1. **Zuverlässigkeit messbar machen (Evals)** — quasi unbesetzt; einzige Fundstelle: [Vishal Bakshi portfolio-llm](https://vishalbakshi.github.io/blog/posts/2025-06-26-portfolio-llm/).
2. **Security-by-Design als öffentliches Showcase** entlang OWASP LLM Top 10 — nur ein Beispiel gefunden.
3. **Zitierende/grounded Antworten** (nur mit wörtlichem Beleg aus dem CV) — bei Personal-CV-Bots nicht gefunden.
4. **Deutschsprachiger Raum** — faktisch Erstbesetzung möglich.
5. **Client-only ohne Backend (WebLLM)** — löst Abuse-/Kostenproblem strukturell.
6. **Frage-Analytics als Feedback-Loop** — der belegbar nützlichste Teil des Musters.
