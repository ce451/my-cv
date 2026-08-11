// Fails when the inline scripts/handlers in the prerendered HTML no longer
// match the CSP hashes declared in public/_headers — typically after an
// Angular update changes the hydration bootstrap scripts. Run after
// `ng build site`; wired into CI.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const hash = (value) => createHash('sha256').update(value).digest('base64');

const headers = readFileSync(new URL('../projects/site/public/_headers', import.meta.url), 'utf8');
const declared = new Set([...headers.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]));

const pages = ['index.html', 'making-of/index.html', 'datenschutz/index.html'];
const needed = new Map();
for (const page of pages) {
  const html = readFileSync(new URL(`../dist/site/browser/${page}`, import.meta.url), 'utf8');
  const scripts = html.matchAll(
    /<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+json|json)")[^>]*>([\s\S]*?)<\/script>/g,
  );
  for (const m of scripts) {
    if (m[1].trim()) {
      needed.set(hash(m[1]), `Inline-Skript in ${page}: ${m[1].trim().slice(0, 60)}…`);
    }
  }
  for (const m of html.matchAll(/\bonload="([^"]*)"/g)) {
    needed.set(hash(m[1]), `onload-Handler in ${page}: ${m[1]}`);
  }
}

const missing = [...needed].filter(([h]) => !declared.has(h));
if (missing.length > 0) {
  console.error('CSP-Hashes in public/_headers passen nicht mehr zum Build:');
  for (const [h, source] of missing) {
    console.error(`  fehlt: 'sha256-${h}' für ${source}`);
  }
  process.exit(1);
}
console.log(`CSP ok: ${needed.size} Inline-Hash(es) durch _headers abgedeckt.`);
