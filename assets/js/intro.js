/* ==========================================================================
   intro.js — the opening move: the orange interpunct starts right in the
   viewer's face and pulls back to its place in the hero wordmark. The word
   itself ("dru" / "uly") fades in as the dot lands.

   Runs once, only on a page with the mega wordmark, and only when motion is
   welcome — otherwise the hero is simply there.
   ========================================================================== */

const DURATION = 620;          // ms — quick enough to feel like a snap back
const SIDES_IN = 400;          // ms — when the letters start showing up
const COVERAGE = 0.55;         // dot's starting size as a share of the screen

export function initIntro() {
  const wordmark = document.querySelector('.wordmark--mega');
  if (!wordmark) return;

  const dot = wordmark.querySelector('.wordmark__dot');
  if (!dot || typeof dot.animate !== 'function') return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  root.classList.add('is-intro');

  // Measure after the display face has loaded — before that the dot sits in
  // a fallback metric and the landing spot would be off.
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();
  ready.then(() => requestAnimationFrame(() => play(root, dot)));
}

function play(root, dot) {
  const box = dot.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Where it starts: dead centre of the screen, blown up.
  const dx = vw / 2 - (box.left + box.width / 2);
  const dy = vh / 2 - (box.top + box.height / 2);
  const scale = Math.max(2.5, (COVERAGE * Math.min(vw, vh)) / box.height);

  const done = () => root.classList.remove('is-intro');

  const animation = dot.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.9 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ],
    { duration: DURATION, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'none' }
  );

  // The letters come in just before the dot settles, so the word arrives as
  // one thing rather than in two beats.
  setTimeout(done, SIDES_IN);
  animation.finished.then(done).catch(done);
}
