import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { journeyMetas, loadJourney } from './engine/journey.js';
import { mountJourney } from './engine/player.js';
import { mountHome } from './home.js';

// History API routing from day one — NOT hash routing.
//
// howitworks shipped `#/jet-engine`, and URL fragments never reach the server
// and are not indexed as distinct pages, so thirty explainers are one page to
// search. Every journey here gets a real path from the start, and the build
// emits a prerendered HTML shell per path (see vite.config.js) so crawlers and
// link unfurlers get real title/description/OG without executing WebGL.

const app = document.querySelector('#app');
let current = null;
let nav = 0;

async function route() {
  const token = ++nav;
  current?.destroy();
  current = null;

  const slug = location.pathname.replace(/^\/+|\/+$/g, '');
  if (!slug) {
    setHead({ title: 'Journeys — scroll through time, distance and scale' });
    current = mountHome(app, journeyMetas);
    return;
  }

  const journey = await loadJourney(slug);
  if (token !== nav) return; // navigated again while the chunk loaded
  if (!journey) {
    setHead({ title: 'Not found — Journeys' });
    current = mountHome(app, journeyMetas);
    return;
  }
  setHead({ title: `${journey.title} — Journeys`, description: journey.summary });
  current = mountJourney(journey, app);
}

function setHead({ title, description }) {
  document.title = title;
  if (description) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }
}

// Intercept same-origin link clicks so navigation stays client-side.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname === location.pathname) return;
  history.pushState({}, '', url.pathname);
  route();
});

window.addEventListener('popstate', route);
route();
