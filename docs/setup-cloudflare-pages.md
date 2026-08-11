# Setup: Cloudflare Pages + elstner.ch

Stand 11.08.2026 — elstner.ch liegt bereits auf Cloudflare-Nameservern (verifiziert:
`donovan.ns.cloudflare.com` / `miki.ns.cloudflare.com`), es existieren noch keine
A/AAAA-Records.

## Einmalige Schritte (macht der Betreiber im Cloudflare-/GitHub-Dashboard)

1. Cloudflare: My Profile → API Tokens → Create Token → Custom Token mit
   Berechtigung **Account → Cloudflare Pages → Edit**.
2. Account-ID notieren (Dashboard, rechte Spalte der Zonen-Übersicht).
3. GitHub-Repo → Settings → Secrets and variables → Actions → zwei Secrets anlegen:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Deploy-Job in `.github/workflows/ci.yml` einkommentieren (Marker „DEPLOY").
5. Nach dem ersten Deploy: Pages-Projekt → Custom Domains → `elstner.ch` hinzufügen
   (DNS-Record legt Cloudflare selbst an).

## Warum Actions-Deploy statt Git-Integration

Cloudflare Pages könnte das Repo auch direkt bauen (Build-Command
`npm ci && npx ng build site`, Output `frontend/dist/site/browser`). Wir deployen
bewusst aus GitHub Actions: so geht nur ein Stand live, der zuvor Build **und**
Tests bestanden hat, und die Pipeline bleibt an einem Ort nachvollziehbar.
