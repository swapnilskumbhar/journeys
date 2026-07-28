// Verify the BUILT site behaves on a static host with no rewrite rules —
// i.e. GitHub Pages.
//
//   node scripts/pages-check.mjs [dist] [base]
//
// This is not `vite preview`. Preview falls back to index.html for any unknown
// path, which is exactly the behaviour GitHub Pages does NOT have, so a broken
// deep link passes there and 404s in production. The server below implements
// Pages' actual rules and nothing more:
//
//   · exact file wins
//   · a directory serves its index.html
//   · a directory requested without a trailing slash 301s to the slash form
//   · anything else is 404.html, served WITH a 404 status
//
// What it proves: the asset prefix is right (a wrong `base` shows up as failed
// requests, not as a visible error), deep links resolve to their prerendered
// shell without JavaScript, and in-app navigation stays inside the prefix.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const base = `/${String(process.argv[3] ?? '/journeys/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
const port = 5178;

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2',
  '.hdr': 'application/octet-stream',
};
const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
const isDir = async (p) => { try { return (await stat(p)).isDirectory(); } catch { return false; } };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let path = decodeURIComponent(url.pathname);

  // The repo's dist IS the /journeys/ directory on Pages.
  if (base !== '/') {
    if (path === base.slice(0, -1)) { redirect(res, base); return; }
    if (!path.startsWith(base)) { send(res, 404, 'text/plain', Buffer.from('outside base')); return; }
    path = path.slice(base.length - 1);
  }

  const target = join(dist, path);
  if (await isFile(target)) return sendFile(res, target, 200);
  if (path.endsWith('/') && await isFile(join(target, 'index.html'))) {
    return sendFile(res, join(target, 'index.html'), 200);
  }
  if (!path.endsWith('/') && await isDir(target)) {
    return redirect(res, `${base.slice(0, -1)}${path}/`);
  }
  return sendFile(res, join(dist, '404.html'), 404);
});

const send = (res, code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
const redirect = (res, to) => { res.writeHead(301, { location: to }); res.end(); };
async function sendFile(res, file, code) {
  try {
    send(res, code, TYPES[extname(file)] ?? 'application/octet-stream', await readFile(file));
  } catch {
    send(res, 404, 'text/plain', Buffer.from('not found'));
  }
}

await new Promise((r) => server.listen(port, r));
const site = `http://localhost:${port}${base}`;
console.log(`serving ${dist} as ${site} (GitHub Pages semantics)\n`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e}`));
page.on('console', (m) => {
  // "Failed to load resource" carries no URL, and the response listener below
  // sees the same failures WITH one. Keeping both means the deliberate 404 test
  // reports itself as a problem through a channel that cannot be filtered.
  if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
    problems.push(`console: ${m.text()}`);
  }
});
page.on('response', (r) => {
  // A wrong `base` is invisible on screen — it is a pile of 404s and a blank
  // page. 404.html is expected to answer 404; nothing else may.
  if (r.status() >= 400 && !r.url().includes('/nope')) {
    problems.push(`${r.status()} ${r.url()}`);
  }
});

const ok = (cond, name, detail = '') => {
  if (!cond) problems.push(`FAILED: ${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};
const mounted = () => page.waitForFunction(
  () => window.__journey?.journey?.beats?.length > 0, null, { timeout: 20000 },
);

// 1. the index
await page.goto(site, { waitUntil: 'networkidle' });
const cardHref = await page.locator('.journey-card a').first().getAttribute('href');
ok(await page.locator('.journey-card').count() > 0, 'index renders its cards');
ok(cardHref === `${base}big-bang/`, 'card link carries the deployment prefix', cardHref);

// 2. client-side navigation
await page.locator('.journey-card a').first().click();
await mounted();
ok(new URL(page.url()).pathname === `${base}big-bang/`, 'in-app nav stays inside the prefix', new URL(page.url()).pathname);

// 3. the back link
await page.locator('.back-link').click();
await page.waitForTimeout(400);
ok(new URL(page.url()).pathname === base, 'back link returns to the index', new URL(page.url()).pathname);

// 4. a cold deep link — the prerendered shell, no client routing involved
const deep = await page.goto(`${site}big-bang/`, { waitUntil: 'networkidle' });
ok(deep.status() === 200, 'deep link is served as a static file', `HTTP ${deep.status()}`);
await mounted();
ok(await page.locator('.ribbon-tick').count() > 0, 'the journey mounts from a cold deep link');
const title = await page.title();
ok(title.includes('Big Bang'), 'prerendered <title> is journey-specific', title);

// 5. the same URL without its trailing slash
const noSlash = await page.goto(`${site}big-bang`, { waitUntil: 'networkidle' });
ok(noSlash.status() === 200 && page.url().endsWith('/big-bang/'), 'missing trailing slash redirects', page.url());
await mounted();

// 6. an unknown path falls back to 404.html, and the app recovers to the index
const missing = await page.goto(`${site}nope/`, { waitUntil: 'networkidle' });
ok(missing.status() === 404, '404.html answers with a 404 status', `HTTP ${missing.status()}`);
await page.waitForTimeout(800);
ok(await page.locator('.journey-card').count() > 0, 'unknown path recovers to the index');

await browser.close();
server.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of [...new Set(problems)].slice(0, 12)) console.log(`  ${p}`);
  process.exit(1);
}
console.log('\nPAGES CHECK PASS');
