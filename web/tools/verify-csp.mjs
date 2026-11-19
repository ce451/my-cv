// Fails when the inline scripts or handlers in the built pages no longer match the
// script-src hashes in public/_headers (after an edit of the inline script in
// index.html). Run after `npm run build`; wired into CI.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const hash = (value) => createHash('sha256').update(value).digest('base64');
const dist = process.argv[2] ?? new URL('../dist/', import.meta.url).pathname;

const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const declared = new Set([...headers.matchAll(/'sha256-([A-Za-z0-9+/=]+)'/g)].map((m) => m[1]));

const pages = ['index.html', 'datenschutz.html', '404.html'];
const needed = new Map();
for (const page of pages) {
  const html = readFileSync(`${dist}/${page}`, 'utf8');
  const scripts = html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+json|json)")[^>]*>([\s\S]*?)<\/script>/g);
  for (const m of scripts) if (m[1].trim()) needed.set(hash(m[1]), `Inline-Skript in ${page}: ${m[1].trim().slice(0, 60)}...`);
  for (const m of html.matchAll(/\bon[a-z]+="([^"]*)"/g)) needed.set(hash(m[1]), `Handler in ${page}: ${m[1]}`);
}

const missing = [...needed].filter(([h]) => !declared.has(h));
if (missing.length > 0) {
  console.error('CSP-Hashes in public/_headers passen nicht mehr zum Build:');
  for (const [h, source] of missing) console.error(`  fehlt: 'sha256-${h}' für ${source}`);
  process.exit(1);
}
const unused = [...declared].filter((h) => !needed.has(h));
if (unused.length > 0) console.warn(`Hinweis: ${unused.length} Hash(es) in _headers ohne Gegenstück im Build.`);
console.log(`CSP ok: ${needed.size} Inline-Hash(es) durch _headers abgedeckt.`);
