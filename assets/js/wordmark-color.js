/* Cycles each .wordmark through the site's vivid type colors, one swap per
   second — both sides of the word ("dru" and "uly") change together. */

const VIVIDS = [
  '--blue-vivid', '--pink-vivid', '--mint-vivid', '--lilac-vivid',
  '--butter-vivid', '--peach-vivid', '--teal-vivid',
];

export function initWordmarkColor() {
  const wordmarks = document.querySelectorAll('.wordmark');
  if (!wordmarks.length) return;

  wordmarks.forEach((wordmark) => {
    const sides = wordmark.querySelectorAll('[data-wordmark-side]');
    if (!sides.length) return;

    let last = -1;
    const swap = () => {
      let next = Math.floor(Math.random() * VIVIDS.length);
      if (next === last) next = (next + 1) % VIVIDS.length;
      last = next;
      sides.forEach((side) => {
        side.style.color = `var(${VIVIDS[next]})`;
      });
    };
    swap();
    setInterval(swap, 1000);
  });
}
