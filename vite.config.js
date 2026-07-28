import { defineConfig } from 'vite';
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// WHERE THIS IS DEPLOYED.
//
// GitHub Pages serves a project repo from a SUBPATH — swapnilskumbhar/journeys
// lands at /journeys/, not at the domain root — so the built asset URLs, every
// in-app link, the canonical tags and the sitemap all have to carry that
// prefix. Both values are read from the environment, so moving to a custom
// domain later is `SITE_BASE=/` on one workflow line and nothing else.
//
// Dev deliberately stays at the root: the review scripts (shots.mjs,
// scroll-check.mjs) drive http://localhost:5175/<id> directly, and a dev-only
// prefix would break every one of them to prove nothing. `BASE_URL` is '/'
// there, which is the case src/routes.js has to handle anyway.
const SITE_BASE = normalizeBase(process.env.SITE_BASE ?? '/journeys/');
const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://swapnilskumbhar.github.io').replace(/\/+$/, '');

function normalizeBase(b) {
  const trimmed = String(b).replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

// Absolute, deployed URL for a path relative to the site root. og:image and
// canonical must be absolute — a relative one resolves against the crawler's
// idea of the page, which is not reliably ours.
const siteUrl = (path = '') => `${SITE_ORIGIN}${SITE_BASE}${path}`;

// Emits a real HTML file per journey at build time.
//
// This exists because of a mistake already paid for once in howitworks: an SPA
// that routes on the URL fragment gives search engines and link unfurlers a
// single page for the whole library. Real paths need real files — a static host
// serving /observable-universe must find something there, and what it finds
// should already contain the title, description and OG image without running
// any JavaScript.
//
// It is also what makes GitHub Pages viable with no SPA rewrite rule: every
// journey is a directory with its own index.html, so deep links resolve as
// ordinary static files.
//
// The shells are thin: correct <head>, the journey's copy as crawlable text,
// and the same script tag as the root. WebGL hydrates over the top on load.
function prerenderJourneys() {
  return {
    name: 'prerender-journeys',
    apply: 'build',
    async closeBundle() {
      const dist = resolve('dist');
      const shellPath = join(dist, 'index.html');
      if (!existsSync(shellPath)) return;
      const shell = readFileSync(shellPath, 'utf8');

      const dir = resolve('src/journeys');
      const ids = existsSync(dir)
        ? readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'meta.js')))
            .map((d) => d.name)
        : [];

      // The root shell. index.html is checked in with example.com placeholders
      // so the source stays host-agnostic; the real origin is only known here.
      writeFileSync(shellPath, rewriteHead(shell, {
        canonical: siteUrl(),
        image: siteUrl('og/default.png'),
      }));

      // 404.html — GitHub Pages serves it for any path with no file behind it.
      // Every real journey has a prerendered directory index, so this only
      // catches genuinely unknown URLs; booting the app there lands the reader
      // on the index instead of on Pages' own error page.
      writeFileSync(join(dist, '404.html'), rewriteHead(shell, {
        title: 'Not found — Journeys',
        canonical: siteUrl(),
        image: siteUrl('og/default.png'),
      }));

      const routes = [];
      for (const id of ids) {
        const mod = await import(pathToFileURL(join(dir, id, 'meta.js')).href);
        const meta = mod.default ?? mod;
        const title = `${meta.title} — Journeys`;
        const desc = meta.summary ?? '';
        const out = rewriteHead(shell, {
          title,
          description: desc,
          canonical: siteUrl(`${id}/`),
          image: siteUrl(`og/${id}.png`),
        })
          // crawlable copy — beats live in index.js (a lazy chunk), so the
          // summary is what a no-JS reader gets until beat text is lifted into
          // meta.js. Revisit once a journey ships.
          .replace('<div id="app"></div>', `<div id="app"><h1>${esc(meta.title)}</h1><p>${esc(desc)}</p></div>`);

        mkdirSync(join(dist, id), { recursive: true });
        writeFileSync(join(dist, id, 'index.html'), out);
        routes.push(id);
      }

      // Jekyll is GitHub Pages' default processor and it silently drops files
      // and directories whose names begin with an underscore. Vite emits none
      // today, but the failure mode is one missing asset and a blank page, and
      // an empty file is a cheap way to never think about it again.
      writeFileSync(join(dist, '.nojekyll'), '');

      const urls = ['', ...routes.map((r) => `${r}/`)]
        .map((r) => `  <url><loc>${siteUrl(r)}</loc></url>`)
        .join('\n');
      writeFileSync(join(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
      writeFileSync(join(dist, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl('sitemap.xml')}\n`);

      console.log(
        `prerendered ${routes.length} journey route(s) + 404 + sitemap · ${siteUrl()}`,
      );
    },
  };
}

// --- head rewriting --------------------------------------------------------
// Regex over known, self-authored markup, rather than a DOM parser dependency
// for four attributes. The one rule: never assume the attributes are on one
// line. The previous version matched `<meta name="description" content="`
// literally, index.html wraps that tag across three lines, and so the
// description and og:description were never substituted on ANY prerendered
// page — a silent miss, because a regex that does not match just returns the
// string unchanged. Hence setMeta warns instead.

function rewriteHead(html, { title, description, canonical, image }) {
  let out = html;
  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
    out = setMeta(out, 'property', 'og:title', title);
  }
  if (description) {
    out = setMeta(out, 'name', 'description', description);
    out = setMeta(out, 'property', 'og:description', description);
  }
  if (canonical) {
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canonical)}$2`);
  }
  if (image) out = setMeta(out, 'property', 'og:image', image);
  return out;
}

// Attribute values in the shell are HTML-escaped, so a bare " cannot appear
// inside one and [^"]* is safe as the value match.
function setMeta(html, key, name, value) {
  const re = new RegExp(`(<meta\\s[^>]*\\b${key}="${name}"[^>]*\\bcontent=")[^"]*(")`, 'i');
  if (!re.test(html)) {
    console.warn(`[prerender] no <meta ${key}="${name}"> found to rewrite — index.html and this plugin have drifted apart`);
    return html;
  }
  return html.replace(re, `$1${esc(value)}$2`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export default defineConfig(({ command, isPreview }) => ({
  // Dev serve is the only thing that runs at the root. `vite preview` serves
  // the BUILT files, which already have the prefix baked into their asset URLs,
  // so it has to serve them from the prefix too or every request 404s.
  base: command === 'serve' && !isPreview ? '/' : SITE_BASE,
  plugins: [prerenderJourneys()],
  build: {
    target: 'es2022',
    // One chunk per journey. If a journey's assets ever land in the shared
    // index chunk, the lazy split has broken and every visitor downloads every
    // journey — the same failure mode howitworks guards against.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return null;
        },
      },
    },
  },
}));
