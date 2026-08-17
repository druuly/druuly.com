/* ==========================================================================
   media.js — keeps looping video cheap.
   Videos only play while they're on screen, and cards marked
   data-hover-play stay paused until the pointer is over them.
   ========================================================================== */

/* Play/pause background loops based on visibility.
   Any <video data-autoloop> is managed here — don't add the autoplay
   attribute in the HTML, this handles it. */
export function initAutoLoops() {
  const videos = document.querySelectorAll('video[data-autoloop]');
  if (!videos.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  videos.forEach((v) => {
    // muted + playsinline are what allow autoplay on mobile browsers.
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
  });

  // Reduced motion: leave every loop on its first frame.
  if (reduced || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) {
          // play() rejects if the browser blocks it — ignore, not fatal.
          target.play().catch(() => {});
        } else {
          target.pause();
        }
      });
    },
    { threshold: 0.2 }
  );

  videos.forEach((v) => observer.observe(v));
}

/* Cards that only animate under the cursor. Cheaper, and it makes the grid
   feel responsive rather than busy. */
export function initHoverPlay() {
  document.querySelectorAll('[data-hover-play]').forEach((card) => {
    const video = card.querySelector('video');
    if (!video) return;

    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    card.addEventListener('mouseenter', () => video.play().catch(() => {}));
    card.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0; // always restart from the top
    });

    // Touch devices have no hover, so let focus do the same thing.
    card.addEventListener('focusin', () => video.play().catch(() => {}));
    card.addEventListener('focusout', () => video.pause());
  });
}

/* Fades media in once it has actually decoded, so nothing pops in half-drawn.
   Pair with <img data-fade> or <video data-fade>. */
export function initMediaFade() {
  document.querySelectorAll('[data-fade]').forEach((el) => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 700ms var(--ease, ease)';

    const show = () => { el.style.opacity = '1'; };

    // complete / readyState cover the case where it loaded from cache
    // before this script ran.
    if (el.complete || el.readyState >= 2) show();
    else el.addEventListener(el.tagName === 'VIDEO' ? 'loadeddata' : 'load', show, { once: true });
  });
}
