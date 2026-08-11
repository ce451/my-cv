# Setup: Cloudflare Pages + elstner.ch

Stand 11.08.2026 — elstner.ch liegt bereits auf Cloudflare-Nameservern (verifiziert:
`donovan.ns.cloudflare.com` / `miki.ns.cloudflare.com`), es existieren noch keine
A/AAAA-Records.

## Status

Erledigt am 11.08.2026: API-Token (Account → Cloudflare Pages → Edit) und die
GitHub-Secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` existieren, der
Deploy-Job in `.github/workflows/ci.yml` ist aktiv. Pages-Projekt: **elstner-cv**
(→ elstner-cv.pages.dev; „my-cv" wäre als globale pages.dev-Subdomain riskant).

## Verbleibender manueller Schritt

Nach dem ersten erfolgreichen Deploy einmalig im Dashboard:
Workers & Pages → Projekt **elstner-cv** → Custom Domains → `elstner.ch` hinzufügen.
Cloudflare legt den DNS-Record selbst an (Zone liegt im selben Account); der
API-Token hat bewusst keine DNS-Rechte, darum geht dieser Schritt nicht über CI.

## Warum Actions-Deploy statt Git-Integration

Cloudflare Pages könnte das Repo auch direkt bauen (Build-Command
`npm ci && npx ng build site`, Output `frontend/dist/site/browser`). Wir deployen
bewusst aus GitHub Actions: so geht nur ein Stand live, der zuvor Build **und**
Tests bestanden hat, und die Pipeline bleibt an einem Ort nachvollziehbar.
