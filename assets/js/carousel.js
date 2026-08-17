/* ==========================================================================
   carousel.js — the selected-works rail.

   The rail is a plain scroll-snap container, so swiping and dragging already
   work with no JS at all. This only adds the two arrow buttons and keeps them
   disabled at the ends. Exits quietly on pages with no [data-carousel].
   ========================================================================== */

export function initCarousels() {
  document.querySelectorAll('[data-carousel]').forEach(setup);
}

function setup(rail) {
  const track = rail.querySelector('[data-carousel-track]');
  if (!track) return;

  // The buttons live outside the scroller (up in the section head), so look
  // for them on the closest common ancestor rather than inside the rail.
  const scope = rail.closest('section') || document;
  const prev = scope.querySelector('[data-carousel-prev]');
  const next = scope.querySelector('[data-carousel-next]');

  /* One "page" is one card plus the gap between cards, so a click always
     lands the next card flush against the left edge. */
  const step = () => {
    const card = track.firstElementChild;
    if (!card) return rail.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const scrollBy = (dir) => rail.scrollBy({ left: dir * step(), behavior: 'smooth' });

  prev?.addEventListener('click', () => scrollBy(-1));
  next?.addEventListener('click', () => scrollBy(1));

  /* Grey out whichever arrow can't do anything. The 1px slack absorbs the
     sub-pixel rounding you get at fractional zoom levels. */
  const syncButtons = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    if (prev) prev.disabled = rail.scrollLeft <= 1;
    if (next) next.disabled = rail.scrollLeft >= max - 1;
  };

  syncButtons();
  rail.addEventListener('scroll', syncButtons, { passive: true });
  window.addEventListener('resize', syncButtons);

  // Left/right arrow keys drive the rail once it has focus.
  rail.tabIndex = 0;
  rail.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollBy(1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); scrollBy(-1); }
  });
}
