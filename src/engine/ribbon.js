// The left→right timeline HUD.
//
// A journey READS as horizontal travel, but the page still scrolls vertically.
// Horizontal scroll-jacking breaks trackpads, keyboard navigation, mobile, and
// the scrollbar-as-progress-indicator — and buys nothing, because the sense of
// travelling left-to-right comes from this ribbon plus the camera, not from the
// input axis. Vertical scroll in, horizontal journey out.
//
// The ribbon is also the navigation: every beat is a tick you can jump to.

export function createRibbon({ container, journey, onSeek }) {
  const el = document.createElement('div');
  el.className = 'ribbon';
  el.innerHTML = `
    <div class="ribbon-track">
      <div class="ribbon-fill"></div>
      <div class="ribbon-ticks"></div>
      <div class="ribbon-head"></div>
    </div>
    <div class="ribbon-readout">
      <span class="ribbon-value"></span>
      <span class="ribbon-axis">${journey.axis.label || ''}</span>
    </div>
  `;
  container.appendChild(el);

  const fill = el.querySelector('.ribbon-fill');
  const head = el.querySelector('.ribbon-head');
  const value = el.querySelector('.ribbon-value');
  const ticksEl = el.querySelector('.ribbon-ticks');

  journey.beats.forEach((beat) => {
    const tick = document.createElement('button');
    tick.className = 'ribbon-tick';
    tick.style.left = `${beat.u * 100}%`;
    tick.title = beat.heading;
    tick.setAttribute('aria-label', `Jump to ${beat.heading}`);
    tick.addEventListener('click', () => onSeek(beat.u));
    ticksEl.appendChild(tick);
  });

  // Clicking anywhere on the track seeks there — the ribbon behaves like a
  // scrubber, which is what its shape promises.
  el.querySelector('.ribbon-track').addEventListener('click', (e) => {
    if (e.target.classList.contains('ribbon-tick')) return;
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  });

  let lastActive = -1;

  return {
    update(u, activeIndex) {
      const pct = `${u * 100}%`;
      fill.style.width = pct;
      head.style.left = pct;
      value.textContent = journey.axis.format(u);
      if (activeIndex !== lastActive) {
        ticksEl.querySelectorAll('.ribbon-tick').forEach((t, i) => {
          t.classList.toggle('is-active', i === activeIndex);
          t.classList.toggle('is-past', i < activeIndex);
        });
        lastActive = activeIndex;
      }
    },
    dispose() {
      el.remove();
    },
  };
}
