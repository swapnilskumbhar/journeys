// The URL shape, in one place.
//
// Rule 6 says real URLs from day one. That is only actually true if the same
// code works at a domain root AND under a prefix, because the prefix is decided
// by where the thing is deployed, not by the app: GitHub Pages serves a project
// repo from /journeys/, a custom domain would serve it from /.
//
// Vite bakes the deployed prefix into `import.meta.env.BASE_URL` at build time
// and leaves it as '/' in dev, so every link and every route lookup goes through
// here rather than hardcoding a leading slash. A hardcoded "/" is the same class
// of bug as a hardcoded world-space position: it works on the machine it was
// written on and breaks somewhere else.

const BASE = import.meta.env.BASE_URL || '/';
// '/journeys' — no trailing slash, so it can be used as a prefix to compare
// against. '' when deployed at the root, which makes every test below a no-op.
const PREFIX = BASE.replace(/\/+$/, '');

// The journey id for a browser path — '' means the index.
// Tolerates the path with or without its trailing slash, because Pages will
// redirect /journeys/big-bang to /journeys/big-bang/ and a reader may arrive at
// either form.
export function slugAt(pathname) {
  let p = pathname;
  if (PREFIX && (p === PREFIX || p.startsWith(`${PREFIX}/`))) p = p.slice(PREFIX.length);
  return p.replace(/^\/+|\/+$/g, '');
}

// The href for a journey, or for the index when called with nothing.
//
// Trailing slash on purpose. Each journey is prerendered to <id>/index.html, so
// a static host resolves /journeys/big-bang by 301-ing to the directory form —
// linking straight to it saves the round trip and keeps every URL identical to
// the canonical tag the build writes into that page.
export function hrefFor(slug = '') {
  return slug ? `${PREFIX}/${slug}/` : `${PREFIX}/`;
}
