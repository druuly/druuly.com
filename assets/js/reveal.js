/* ==========================================================================
   reveal.js — fade elements in as they scroll into view.
   Mark up with data-reveal. Optional data-reveal-delay="120" (milliseconds)
   staggers siblings.
   ========================================================================== */

export function initReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  // Respect the OS setting: show everything at once, animate nothing.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const delay = Number(entry.target.dataset.revealDelay || 0);
        setTimeout(() => entry.target.classList.add('is-visible'), delay);

        // Reveal once, then stop watching — this is not a scroll-scrubbed site.
        observer.unobserve(entry.target);
      });
    },
    {
      // Fire a little before the element reaches the bottom edge, so the
      // animation is already underway when it's properly in view.
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.08,
    }
  );

  items.forEach((el) => observer.observe(el));
}
