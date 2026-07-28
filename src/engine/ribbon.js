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

  journey.beats.forEach((beat, i) => {
    const tick = document.createElement('button');
    tick.className = 'ribbon-tick';
    tick.style.left = `${beat.u * 100}%`;
    tick.title = beat.heading;
    tick.setAttribute('aria-label', `Jump to ${beat.heading}`);
    // Seek just PAST the beat, not exactly onto it. The active beat is the last
    // one at or behind u, so landing precisely on the boundary (or a rounded
    // pixel before it) selects the PREVIOUS beat — clicking "Farming" showed
    // "Out of Africa". A fraction of the gap to the next beat lands cleanly
    // inside the one that was clicked.
    const next = journey.beats[i + 1]?.u ?? 1;
    const target = Math.min(1, beat.u + (next - beat.u) * 0.2);
    // A tick is a jump to a NAMED place, so it keeps the smooth travel — the
    // journey between two beats is worth seeing. Dragging is the opposite
    // gesture and gets the opposite treatment, below.
    tick.addEventListener('click', () => onSeek(target, { smooth: true }));
    ticksEl.appendChild(tick);
  });

  // --- scrubbing -----------------------------------------------------------
  // Press anywhere on the track and the journey goes there; keep holding and it
  // follows the pointer. The ribbon's shape promises a scrubber, and a scrubber
  // that only accepts discrete clicks is a promise half kept.
  //
  // Every seek here is `smooth: false`. Easing is wrong for a drag twice over:
  // the frame lags behind the finger, and it keeps travelling after the finger
  // stops — so where you let go is not where you end up.
  const track = el.querySelector('.ribbon-track');
  let dragging = false;

  const uAtPointer = (e) => {
    const r = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };

  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // Ticks are buttons living inside the track; let them keep their own click.
    if (e.target.classList.contains('ribbon-tick')) return;
    dragging = true;
    el.classList.add('is-dragging');
    // Capture, so the drag survives the pointer leaving the 2px-tall track —
    // which it does immediately, because the thing being dragged is at the very
    // bottom edge of the window.
    track.setPointerCapture(e.pointerId);
    e.preventDefault(); // no text selection, no native image-drag
    onSeek(uAtPointer(e), { smooth: false });
  });

  track.addEventListener('pointermove', (e) => {
    if (dragging) onSeek(uAtPointer(e), { smooth: false });
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

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
