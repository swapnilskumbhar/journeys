import { defineConfig } from 'vite';
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Emits a real HTML file per journey at build time.
//
// This exists because of a mistake already paid for once in howitworks: an SPA
// that routes on the URL fragment gives search engines and link unfurlers a
// single page for the whole library. Real paths need real files — a static host
// serving /observable-universe must find something there, and what it finds
// should already contain the title, description and OG image without running
// any JavaScript.
//
// The shells are thin: correct <head>, the journey's copy as crawlable text,
// and the same script tag as the root. WebGL hydrates over the top on load.
function prerenderJourneys() {
  return {
    name: 'prerender-journeys',
    apply: 'build',
    async closeBundle() {
      const dist = resolve('dist');
      const shell = join(dist, 'index.html');
      if (!existsSync(shell)) return;
      const html = readFileSync(shell, 'utf8');

      const dir = resolve('src/journeys');
      const ids = existsSync(dir)
        ? readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'meta.js')))
            .map((d) => d.name)
        : [];

      const routes = [];
      for (const id of ids) {
        const mod = await import(pathToFileURL(join(dir, id, 'meta.js')).href);
        const meta = mod.default ?? mod;
        const title = `${meta.title} — Journeys`;
        const desc = meta.summary ?? '';
        const out = html
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[\s\S]*?(")/, `$1${esc(desc)}$2`)
          .replace(/(<meta property="og:title" content=")[\s\S]*?(")/, `$1${esc(title)}$2`)
          .replace(/(<meta property="og:description" content=")[\s\S]*?(")/, `$1${esc(desc)}$2`)
          .replace(/(<meta property="og:image" content=")[\s\S]*?(")/, `$1/og/${id}.png$2`)
          .replace(/(<link rel="canonical" href="[^"]*?)\/(")/, `$1/${id}$2`)
          // crawlable copy — beats live in index.js (a lazy chunk), so the
          // summary is what a no-JS reader gets until beat text is lifted into
          // meta.js. Revisit once a journey ships.
          .replace('<div id="app"></div>', `<div id="app"><h1>${esc(meta.title)}</h1><p>${esc(desc)}</p></div>`);

        mkdirSync(join(dist, id), { recursive: true });
        writeFileSync(join(dist, id, 'index.html'), out);
        routes.push(id);
      }

      const origin = process.env.SITE_ORIGIN ?? 'https://example.com';
      const urls = ['', ...routes]
        .map((r) => `  <url><loc>${origin}/${r}</loc></url>`)
        .join('\n');
      writeFileSync(join(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
      writeFileSync(join(dist, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);

      console.log(`prerendered ${routes.length} journey route(s) + sitemap`);
    },
  };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export default defineConfig({
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
});
