/* ==========================================================================
   main.js — the single entry point. Every page loads only this file:
   <script type="module" src="/assets/js/main.js"></script>

   Each module below checks for its own markup and exits quietly if the
   current page doesn't use it, so there's nothing to wire up per page.
   ========================================================================== */

import { initNav, markCurrentPage } from './nav.js';
import { initReveal } from './reveal.js';
import { initAutoLoops, initHoverPlay, initMediaFade } from './media.js';
import { initFilters } from './filter.js';
import { initCarousels } from './carousel.js';
import { initWordmarkColor } from './wordmark-color.js';
import { initIntro } from './intro.js';
import { initBeach } from './beach.js';

function boot() {
  markCurrentPage();
  initNav();
  initReveal();
  initAutoLoops();
  initHoverPlay();
  initMediaFade();
  initFilters();
  initCarousels();
  initWordmarkColor();
  initIntro();
  initBeach();
}

// Modules are deferred by default, but guard anyway in case that changes.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* Live clock in the footer — a small "the site is on" signal.
   Skipped entirely if no element carries data-clock. */
const clock = document.querySelector('[data-clock]');
if (clock) {
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };
  tick();
  setInterval(tick, 30000); // every 30s is plenty for minute precision
}
