// Index of journeys. Intentionally plain for now — the grid earns design work
// once there is more than one card in it.
import { hrefFor } from './routes.js';

export function mountHome(container, metas) {
  container.innerHTML = `
    <div class="home">
      <header class="home-hero">
        <p class="hero-kicker">journeys</p>
        <h1>Scroll through time, distance and scale.</h1>
        <p class="hero-summary">
          One continuous world, one scroll. From the first microsecond of the
          universe to this morning; from your feet to the edge of everything
          we can see.
        </p>
      </header>
      <ul class="journey-grid">
        ${metas.length === 0 ? '<li class="empty">No journeys yet.</li>' : metas.map(card).join('')}
      </ul>
    </div>
  `;
  return { destroy() { container.innerHTML = ''; } };
}

const card = (m) => `
  <li class="journey-card" style="--accent:${m.accent ?? '#7cc4ff'}">
    <a href="${hrefFor(m.id)}">
      <h2>${m.title}</h2>
      <p>${m.summary ?? ''}</p>
      <span class="card-axis">${m.axisLabel ?? ''}</span>
    </a>
  </li>
`;
