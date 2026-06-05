// Adds a "Take-home resources" link to each standalone encounter module (public/m1.html .. m9.html).
// Idempotent: guarded by a marker so re-running won't duplicate. Run from the repo root:
//   node inject-resources-links.mjs            (defaults to ./public)
//   node inject-resources-links.mjs public/encounters     (or pass a dir)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'public';
const MARKER = 'data-resources-link';
const BLOCK = `
<!-- resources entry point (injected) -->
<div ${MARKER} style="max-width:860px;margin:0 auto;padding:14px 22px 40px;text-align:center">
  <a href="/resources.html" style="display:inline-block;border:1px solid rgba(255,255,255,.15);border-radius:.6rem;padding:.6rem 1.15rem;color:#1ABC9C;text-decoration:none;font-family:'Hanken Grotesk',system-ui,sans-serif;font-weight:600">
    Take-home resources &rarr;
  </a>
</div>
`;

const files = readdirSync(dir).filter((f) => /^m\d+\.html$/i.test(f)).sort();
if (!files.length) { console.log(`no m*.html files in ${dir}/`); process.exit(0); }

let changed = 0;
for (const f of files) {
  const p = join(dir, f);
  let html = readFileSync(p, 'utf8');
  if (html.includes(MARKER)) { console.log('skip (already linked):', f); continue; }
  if (!html.includes('</body>')) { console.log('no </body>, skipped:', f); continue; }
  html = html.replace('</body>', BLOCK + '</body>');
  writeFileSync(p, html);
  changed++;
  console.log('linked:', f);
}
console.log(`done: ${changed} of ${files.length} module(s) updated`);
