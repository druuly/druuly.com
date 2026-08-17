/* ==========================================================================
   filter.js — the tag filter on the work page.
   Buttons carry data-filter="tag"; cards carry data-tags="tag tag tag".
   data-filter="all" shows everything.
   ========================================================================== */

export function initFilters() {
  const buttons = document.querySelectorAll('[data-filter]');
  const items = document.querySelectorAll('[data-tags]');
  if (!buttons.length || !items.length) return;

  const apply = (active) => {
    items.forEach((item) => {
      const tags = (item.dataset.tags || '').split(/\s+/);
      const match = active === 'all' || tags.includes(active);
      item.classList.toggle('is-filtered-out', !match);
    });

    // aria-pressed doubles as the styling hook for the active button.
    buttons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === active));
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => apply(btn.dataset.filter));
  });

  apply('all');
}
