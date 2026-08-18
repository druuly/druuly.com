/* ==========================================================================
   liquid-glass.js — a vanilla port of liquid-glass-react (MIT), which this
   site vendors under assets/components/. Same effect, no React: an SVG filter
   pushes the backdrop outwards at the edges of the card (per channel, so the
   rim splits into colour), the middle stays clean, and two masked gradient
   rings sit on top for the bevel.

   Markup is plain HTML — anything carrying data-liquid-glass is upgraded in
   place, its children moved into the sharp content layer:

     <div class="glass-card" data-liquid-glass
          data-displacement-scale="74" data-blur-amount="0.1">…</div>

   Options come from data attributes (all optional):
     data-displacement-scale  how far the edge bends            (70)
     data-blur-amount         backdrop blur, in React's units   (0.0625)
     data-saturation          backdrop saturation, %            (140)
     data-aberration          width of the colour fringe        (2)
     data-elasticity          how much it leans toward the cursor (0.15)
     data-corner-radius       px; matches the CSS radius        (999)
     data-mode                standard | polar | prominent | shader
     data-glass-container     selector for the mouse area; defaults to the
                              closest section, so the card reacts to the
                              cursor anywhere in that panel
   ========================================================================== */

import {
  displacementMap,
  polarDisplacementMap,
  prominentDisplacementMap,
} from './liquid-glass-maps.js';

const ACTIVATION_ZONE = 200; // px from the card's edge where the lean begins
const STIFFNESS = 0.14;      // pull toward the cursor, per frame
const DAMPING = 0.78;        // how much speed survives a frame; < 1 always rests

const DEFAULTS = {
  displacementScale: 70,
  blurAmount: 0.0625,
  saturation: 140,
  aberration: 2,
  elasticity: 0.15,
  cornerRadius: 999,
  mode: 'standard',
};

let uid = 0;

export function initLiquidGlass(root = document) {
  const hosts = root.querySelectorAll('[data-liquid-glass]');
  if (!hosts.length) return;

  const cards = [...hosts].map(createLiquidGlass).filter(Boolean);
  if (!cards.length) return;

  // One pointer listener for every card on the page; each decides for itself
  // whether the cursor is close enough to matter.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let frame = 0;
    window.addEventListener('pointermove', (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        for (const card of cards) card.pointer(e.clientX, e.clientY);
      });
    }, { passive: true });
  }
}

/* Upgrade one element. Returns a handle the page-level pointer loop drives. */
export function createLiquidGlass(host) {
  if (host.dataset.liquidGlassReady) return null;
  host.dataset.liquidGlassReady = 'true';

  const opts = readOptions(host);
  const filterId = `liquid-glass-${++uid}`;
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

  // The card's own children become the sharp layer; everything else is chrome.
  const content = document.createElement('div');
  content.className = 'lg__content';
  while (host.firstChild) content.appendChild(host.firstChild);

  const filter = buildFilter(filterId, opts);

  const warp = document.createElement('span');
  warp.className = 'lg__warp';
  // Firefox ignores filter on a backdrop layer — it gets the blur only.
  if (!isFirefox) warp.style.filter = `url(#${filterId})`;
  warp.style.backdropFilter =
    `blur(${4 + opts.blurAmount * 32}px) saturate(${opts.saturation}%)`;
  warp.style.webkitBackdropFilter = warp.style.backdropFilter;

  const shape = document.createElement('div');
  shape.className = 'lg__shape';
  shape.style.borderRadius = `${opts.cornerRadius}px`;
  shape.append(warp, content);

  const borders = ['lg__border--screen', 'lg__border--overlay'].map((mod) => {
    const span = document.createElement('span');
    span.className = `lg__border ${mod}`;
    span.style.borderRadius = `${opts.cornerRadius}px`;
    return span;
  });

  host.classList.add('lg');
  host.append(filter.svg, shape, ...borders);

  // The lean is measured from where the card *sits*, not where it currently
  // leans — reading the live box would feed the transform back into its own
  // input and the card would wobble instead of settling.
  const state = { width: 0, height: 0, shiftX: 0, shiftY: 0 };

  const measure = () => {
    const rect = host.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    filter.resize(rect.width, rect.height);
  };

  measure();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(measure).observe(host);
  } else {
    window.addEventListener('resize', measure);
  }

  /* The lean, in two halves.

     pointer() only sets targets; a spring drives the card toward them frame by
     frame. The source uses a CSS transition, which starts and stops at the same
     rate every time and reads as stiff — a spring carries momentum, so the pane
     trails the cursor and settles late, which is the part that feels liquid.

     The source leans with a transform (translate + a directional stretch). We
     can't: a transform on an ancestor of the backdrop layer makes Chrome
     resample the backdrop from the wrong space and the glass blanks out
     mid-hover. So the pane moves on relative offsets, and the stretch is
     replaced by pulling the corner radii toward the cursor — border-radius is
     free of all that, and the pane looks like it's being drawn out. */
  const target = { x: 0, y: 0, ux: 0, uy: 0, lean: 0 };
  const spring = { x: 0, y: 0, vx: 0, vy: 0, lean: 0, vlean: 0 };
  let frame = 0;

  const pointer = (mouseX, mouseY) => {
    if (!state.width || !state.height) return;

    const rect = host.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 - state.shiftX;
    const centerY = rect.top + rect.height / 2 - state.shiftY;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    const edgeX = Math.max(0, Math.abs(deltaX) - state.width / 2);
    const edgeY = Math.max(0, Math.abs(deltaY) - state.height / 2);
    const edgeDistance = Math.hypot(edgeX, edgeY);
    const fade = edgeDistance > ACTIVATION_ZONE
      ? 0
      : 1 - edgeDistance / ACTIVATION_ZONE;

    target.lean = fade;
    target.x = deltaX * opts.elasticity * 0.1 * fade;
    target.y = deltaY * opts.elasticity * 0.1 * fade;
    // Which way the pull is coming from, -1..1 on each axis.
    target.ux = clamp(deltaX / (state.width / 2 + ACTIVATION_ZONE), -1, 1);
    target.uy = clamp(deltaY / (state.height / 2 + ACTIVATION_ZONE), -1, 1);

    // Offsets are in percent of the mouse container, matching the original.
    const box = opts.container ? opts.container.getBoundingClientRect() : rect;
    const offsetX = ((mouseX - (box.left + box.width / 2)) / box.width) * 100;
    const offsetY = ((mouseY - (box.top + box.height / 2)) / box.height) * 100;
    paintRims(offsetX, offsetY);

    if (!frame) frame = requestAnimationFrame(step);
  };

  function paintRims(offsetX, offsetY) {
    for (const [i, border] of borders.entries()) {
      const base = i === 0 ? 0.12 : 0.32;   // screen ring is the fainter one
      const peak = i === 0 ? 0.4 : 0.6;
      border.style.backgroundImage = `linear-gradient(
        ${135 + offsetX * 1.2}deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, ${base + Math.abs(offsetX) * 0.008}) ${Math.max(10, 33 + offsetY * 0.3)}%,
        rgba(255, 255, 255, ${peak + Math.abs(offsetX) * 0.012}) ${Math.min(90, 66 + offsetY * 0.4)}%,
        rgba(255, 255, 255, 0) 100%
      )`;
    }
  }

  /* One step of the spring. STIFFNESS sets how hard it's pulled to the target,
     DAMPING how much of the previous frame's speed survives — under 1 it always
     comes to rest, but late enough to look like weight rather than a tween. */
  function step() {
    frame = 0;

    spring.vx = (spring.vx + (target.x - spring.x) * STIFFNESS) * DAMPING;
    spring.vy = (spring.vy + (target.y - spring.y) * STIFFNESS) * DAMPING;
    spring.x += spring.vx;
    spring.y += spring.vy;

    spring.vlean = (spring.vlean + (target.lean - spring.lean) * STIFFNESS) * DAMPING;
    spring.lean += spring.vlean;

    state.shiftX = spring.x;
    state.shiftY = spring.y;
    host.style.left = `${spring.x.toFixed(2)}px`;
    host.style.top = `${spring.y.toFixed(2)}px`;

    // Corners nearest the cursor swell, the far ones tighten — the pane reads
    // as being pulled rather than moved.
    const r = opts.cornerRadius;
    const pull = 0.5 * spring.lean;
    const corner = (cx, cy) =>
      Math.max(2, r * (1 + pull * (cx * target.ux + cy * target.uy) * 0.5)).toFixed(1);
    const radius = `${corner(-1, -1)}px ${corner(1, -1)}px ${corner(1, 1)}px ${corner(-1, 1)}px`;
    shape.style.borderRadius = radius;
    for (const border of borders) border.style.borderRadius = radius;

    // Keep stepping until everything has actually come to rest.
    const moving = Math.abs(spring.vx) + Math.abs(spring.vy) + Math.abs(spring.vlean) > 0.01
      || Math.abs(target.x - spring.x) + Math.abs(target.y - spring.y) > 0.01
      || Math.abs(target.lean - spring.lean) > 0.002;
    if (moving) frame = requestAnimationFrame(step);
  }

  // Paint the rims once so the card looks right before the cursor arrives.
  paintRims(0, 0);

  return { host, pointer };
}

/* --- options -------------------------------------------------------------- */

function readOptions(host) {
  const d = host.dataset;
  const num = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    displacementScale: num(d.displacementScale, DEFAULTS.displacementScale),
    blurAmount: num(d.blurAmount, DEFAULTS.blurAmount),
    saturation: num(d.saturation, DEFAULTS.saturation),
    aberration: num(d.aberration, DEFAULTS.aberration),
    elasticity: num(d.elasticity, DEFAULTS.elasticity),
    cornerRadius: num(d.cornerRadius, DEFAULTS.cornerRadius),
    mode: d.mode || DEFAULTS.mode,
    container: d.glassContainer
      ? document.querySelector(d.glassContainer)
      : host.closest('section'),
  };
}

/* --- the filter ----------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs || {})) {
    node.setAttribute(key, String(value));
  }
  return node;
}

/* Edge-only displacement: the map is read three times at slightly different
   scales (one per channel), screened back together, then kept only where the
   map says "edge". The middle of the card is the untouched original. */
function buildFilter(id, opts) {
  const { displacementScale: scale, aberration, mode } = opts;
  const sign = mode === 'shader' ? 1 : -1;

  const root = svg('svg', { 'aria-hidden': 'true', class: 'lg__filter' });
  const defs = svg('defs');
  const filter = svg('filter', {
    id,
    x: '-35%', y: '-35%', width: '170%', height: '170%',
    // Hyphenated in the DOM — the React source spells it camelCase because JSX
    // rewrites it. Without sRGB the channels are mixed in linear space and the
    // fringe washes out.
    'color-interpolation-filters': 'sRGB',
  });

  const image = svg('feImage', {
    x: 0, y: 0, width: '100%', height: '100%',
    result: 'DISPLACEMENT_MAP',
    preserveAspectRatio: 'xMidYMid slice',
  });
  setHref(image, mapFor(mode));

  const grey = '0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0 0 0 1 0';
  const edgeIntensity = svg('feColorMatrix', {
    in: 'DISPLACEMENT_MAP', type: 'matrix', values: grey, result: 'EDGE_INTENSITY',
  });

  const edgeMask = svg('feComponentTransfer', {
    in: 'EDGE_INTENSITY', result: 'EDGE_MASK',
  });
  edgeMask.appendChild(svg('feFuncA', {
    type: 'discrete', tableValues: `0 ${aberration * 0.05} 1`,
  }));

  const channels = [
    ['RED', sign, '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0'],
    ['GREEN', sign - aberration * 0.05, '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0'],
    ['BLUE', sign - aberration * 0.1, '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0'],
  ].flatMap(([name, factor, matrix]) => [
    svg('feDisplacementMap', {
      in: 'SourceGraphic', in2: 'DISPLACEMENT_MAP',
      scale: scale * factor,
      xChannelSelector: 'R', yChannelSelector: 'B',
      result: `${name}_DISPLACED`,
    }),
    svg('feColorMatrix', {
      in: `${name}_DISPLACED`, type: 'matrix', values: matrix,
      result: `${name}_CHANNEL`,
    }),
  ]);

  const invertedMask = svg('feComponentTransfer', {
    in: 'EDGE_MASK', result: 'INVERTED_MASK',
  });
  invertedMask.appendChild(svg('feFuncA', { type: 'table', tableValues: '1 0' }));

  filter.append(
    image,
    edgeIntensity,
    edgeMask,
    svg('feOffset', { in: 'SourceGraphic', dx: 0, dy: 0, result: 'CENTER_ORIGINAL' }),
    ...channels,
    svg('feBlend', { in: 'GREEN_CHANNEL', in2: 'BLUE_CHANNEL', mode: 'screen', result: 'GB_COMBINED' }),
    svg('feBlend', { in: 'RED_CHANNEL', in2: 'GB_COMBINED', mode: 'screen', result: 'RGB_COMBINED' }),
    svg('feGaussianBlur', {
      in: 'RGB_COMBINED',
      stdDeviation: Math.max(0.1, 0.5 - aberration * 0.1),
      result: 'ABERRATED_BLURRED',
    }),
    svg('feComposite', { in: 'ABERRATED_BLURRED', in2: 'EDGE_MASK', operator: 'in', result: 'EDGE_ABERRATION' }),
    invertedMask,
    svg('feComposite', { in: 'CENTER_ORIGINAL', in2: 'INVERTED_MASK', operator: 'in', result: 'CENTER_CLEAN' }),
    svg('feComposite', { in: 'EDGE_ABERRATION', in2: 'CENTER_CLEAN', operator: 'over' })
  );

  defs.appendChild(filter);
  root.appendChild(defs);

  // In shader mode the map is drawn to fit the card, so it's regenerated on
  // resize; the prebaked maps just stretch and need no work here.
  let lastKey = '';
  const resize = (width, height) => {
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    if (mode !== 'shader' || width < 1 || height < 1) return;

    const key = `${Math.round(width)}x${Math.round(height)}`;
    if (key === lastKey) return;
    lastKey = key;
    setHref(image, shaderMap(Math.round(width), Math.round(height)));
  };

  return { svg: root, resize };
}

/* SVG2 dropped the xlink namespace, but Safari still reads it — set both. */
function setHref(node, value) {
  node.setAttribute('href', value);
  node.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', value);
}

function mapFor(mode) {
  if (mode === 'polar') return polarDisplacementMap;
  if (mode === 'prominent') return prominentDisplacementMap;
  return displacementMap; // 'shader' starts here until its own map is drawn
}

/* --- shader mode ---------------------------------------------------------- */

/* A rounded-rect signed distance field, evaluated per pixel and written out as
   a displacement map. Adapted from shuding/liquid-glass via the React package. */
function shaderMap(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return displacementMap;

  const raw = new Float32Array(width * height * 2);
  let maxScale = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ix = x / width - 0.5;
      const iy = y / height - 0.5;
      const distance = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
      const push = smoothStep(0, 1, smoothStep(0.8, 0, distance - 0.15));

      const i = (y * width + x) * 2;
      raw[i] = (ix * push + 0.5) * width - x;
      raw[i + 1] = (iy * push + 0.5) * height - y;
      maxScale = Math.max(maxScale, Math.abs(raw[i]), Math.abs(raw[i + 1]));
    }
  }

  maxScale = Math.max(maxScale, 1);

  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 2;
      // Fade the outermost pixels out, or the map's own border shows up as a
      // hard seam in the displaced result.
      const edge = Math.min(1, Math.min(x, y, width - x - 1, height - y - 1) / 2);
      const r = (raw[i] * edge) / maxScale + 0.5;
      const g = (raw[i + 1] * edge) / maxScale + 0.5;

      const p = (y * width + x) * 4;
      image.data[p] = clamp255(r * 255);
      image.data[p + 1] = clamp255(g * 255);
      image.data[p + 2] = clamp255(g * 255); // the filter reads y from blue
      image.data[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function clamp255(value) {
  return Math.max(0, Math.min(255, value));
}

function smoothStep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function roundedRectSDF(x, y, width, height, radius) {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0)
    + Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
    - radius;
}
