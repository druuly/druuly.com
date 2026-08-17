/* ==========================================================================
   nav.js — header behaviour.
   Two jobs: a border on the header once you scroll, and the mobile menu.
   ========================================================================== */

export function initNav() {
  const header = document.querySelector('.site-header');
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');

  /* --- header border on scroll ------------------------------------------ */
  if (header) {
    const setScrolled = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    setScrolled(); // run once in case the page loads part-scrolled
    // passive: this listener never calls preventDefault, so let the browser
    // keep scrolling at full speed.
    window.addEventListener('scroll', setScrolled, { passive: true });
  }

  /* --- mobile menu ------------------------------------------------------- */
  if (!nav || !toggle) return;

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    // Stop the page behind the menu from scrolling.
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-open'));
  });

  // Tapping a link should close the menu before navigating.
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  // Escape closes it too.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false);
  });

  // If the window grows past the mobile breakpoint, reset everything.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720 && nav.classList.contains('is-open')) setOpen(false);
  });
}

/* Marks the nav link matching the current page so CSS can style it.
   Compares file names, so it works from / and from /posts/ alike. */
export function markCurrentPage() {
  const here = window.location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav__link').forEach((link) => {
    const target = link.getAttribute('href').split('/').pop();
    if (target === here) link.setAttribute('aria-current', 'page');
  });
}
