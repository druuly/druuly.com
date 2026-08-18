/* ==========================================================================
   beach.js — a pixel-shader tide washing behind the intro panel. WebGL
   fragment shader, no dependencies, one fixed palette (seaglass: the site's
   slate as open water, gold shells, orange embers).

   Ported from a standalone demo (assets/components/digital-beach.html) that
   also carried a palette switcher and its own page chrome — neither of
   which belongs here, so only the shader itself made the trip.

   Runs once, only on a page with #beach-canvas, and only when motion is
   welcome — otherwise the canvas is left untouched by JS and its CSS
   gradient fallback (see components.css) just sits there.
   ========================================================================== */

const SEAGLASS = {
  deep:    '#33455C',
  mid:     '#5B7E9E',   // the site's --blue, as the sea
  shallow: '#8FAFB2',
  shine:   '#BCCFC9',
  foam:    '#FBF8F1',

  sandA:   '#E4D9BE',
  sandB:   '#EFE8D6',
  sandC:   '#F5F1E8',

  pebble:  '#A8A093',
  shell:   '#C4972A',
  accent:  '#D9663A',   // the wordmark's orange dot

  pageBg:  '#f5f2ec',   // matches --paper, so the wash blends into the page
  wash:    0.18,
  levels:  26,
  glitter: 0.9988,
};

// Size of one "shader pixel" in CSS pixels — bigger reads chunkier.
const PIXEL_SIZE = 4;
const MAX_INTERNAL_WIDTH = 520;
const MIN_INTERNAL_WIDTH = 170;
const SPEED = 1.0;

const VERT = `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;

uniform vec3  C_DEEP, C_MID, C_SHALLOW, C_SHINE, C_FOAM;
uniform vec3  C_SAND_A, C_SAND_B, C_SAND_C;
uniform vec3  C_PEBBLE, C_SHELL, C_ACCENT;
uniform vec3  uWashCol;
uniform float uWash;
uniform float uLevels;
uniform float uGlitter;

/* Where the resting waterline sits. 0 = bottom-left corner, 1 = top-right. */
const float SHORE = 0.41;

/* Direction the waves travel: out of the bottom-left corner, up and right. */
const vec2  SHORE_DIR = vec2(0.545, 0.838);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/* Three octaves, roughly normalised to 0..1. Foam wants this rather than a
   single vnoise: one octave gives evenly-sized speckle, three give clumps
   with smaller bubbles inside them. */
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v / 0.875;
}

/* Ordered (Bayer) dithering: flip between two palette colours on a fixed
   pixel lattice instead of blending, so it reads as texture, not blur. */
float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

/* Softened max. A hard max() between two wave edges is C1-discontinuous:
   the instant one wave overtakes another the edge velocity jumps, which
   reads as a kink at the front of the surge. */
float smax(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}

const float TAU   = 6.2831853;
const float ASYM  = 0.80;   /* how much faster the run-up is than the drain */
const float UNDER = 0.26;   /* how far the backwash pulls past the shoreline */

/* Phase warp. Monotone on 0..1 with w(0)=0, w(1)=1 and w'=1 at both ends,
   but w' > 1 early and < 1 late, so the run-up takes ~32% of the cycle and
   the backwash the remaining ~68% without either one ever stalling. */
float warpPhase(float ph) {
  return ph + ASYM * (1.0 - cos(TAU * ph)) / TAU;
}

/* One wave's swash cycle: a run-up, then a backwash that drags the edge
   past the resting line before the next wave gathers.

   Built as a single warped cosine rather than a rise curve plus a separate
   undershoot lobe. Two curves added together turn back on each other: the
   edge receded, held, drifted back up, then receded again. This has exactly
   one crest and one trough, and the trough sits on the cycle wrap, so the
   turnaround into the next wave is the same smooth motion.

   reach = the water edge right now. peak/fade = the foam it left behind. */
void waveCycle(float t, float period, float offs,
               out float reach, out float peak, out float fade) {
  /* A slow, non-periodic drift on the phase. Fixed periods eventually
     relock with each other and the whole pattern visibly repeats; this
     keeps them from ever lining up the same way twice. */
  float drift = 0.055 * (vnoise(vec2(t * 0.017, offs * 37.0)) - 0.5);
  float ph    = fract(t / period + offs + drift);

  float swash = 0.5 - 0.5 * cos(TAU * warpPhase(ph));

  /* Lifted so the crest still reaches 1.0 and the trough sits below zero. */
  reach = swash * (1.0 + UNDER) - UNDER;

  /* High-water mark: the swash value frozen at the crest, then fading. */
  float pph = min(ph, 0.315);
  peak = 0.5 - 0.5 * cos(TAU * warpPhase(pph));
  fade = 1.0 - smoothstep(0.36, 0.98, ph);
}

void main() {
  vec2  fc     = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;

  vec2 P = fc / uRes.y;

  vec2  dir  = normalize(SHORE_DIR);
  vec2  perp = vec2(-dir.y, dir.x);

  float sMax = dir.x * aspect + dir.y;
  float s    = dot(P, dir) / sMax;
  float u    = dot(P, perp);

  float t = uTime;

  float wob = 0.020 * sin(u * 5.3 + 0.7)
            + 0.011 * sin(u * 11.7 - 1.9)
            + 0.014 * vnoise(vec2(u * 2.2, t * 0.04));

  float swell = 0.011 * sin(t * 0.34 + u * 3.1);

  /* A long, slow breath under everything, so the resting line itself is
     never actually at rest between waves. */
  float tide  = 0.013 * (vnoise(vec2(u * 0.9, t * 0.030)) - 0.5) * 2.0;
  float base  = SHORE + wob + swell + tide;

  /* Long, and mutually awkward. 11.0 / 7.3 was very nearly 3:2, so the big
     and mid waves relocked and the whole pattern repeated every ~22s. */
  float r1, p1, f1, r2, p2, f2, r3, p3, f3;
  waveCycle(t, 27.7, 0.00, r1, p1, f1);
  waveCycle(t, 17.5, 0.37, r2, p2, f2);
  waveCycle(t, 10.7, 0.71, r3, p3, f3);

  const float A1 = 0.150, A2 = 0.096, A3 = 0.058;

  float j1 = 0.016 * sin(u *  7.9 + 1.3);
  float j2 = 0.013 * sin(u * 13.1 - 0.6);
  float j3 = 0.010 * sin(u * 17.7 + 2.4);

  float e1 = base + A1 * r1 + j1 * r1;
  float e2 = base + A2 * r2 + j2 * r2;
  float e3 = base + A3 * r3 + j3 * r3;
  float wEdge = smax(smax(e1, e2, 0.030), e3, 0.030);

  wEdge += (vnoise(vec2(u * 34.0, t * 0.55)) - 0.5) * 0.010;

  float depth = wEdge - s;

  /* Shore-aligned frame with matched scales on both axes. s is normalised
     across the diagonal, u is not, so sampling noise as vec2(u, s) is
     anisotropic - which is exactly what turned foam into streaks. */
  vec2 fp = vec2(u, s * sMax);

  /* sand */
  float up = max(s - wEdge, 0.0);

  float lvl = clamp(up * 2.9, 0.0, 1.0);
  lvl += vnoise(P * 7.0) * 0.16 - 0.08;
  lvl += (bayer8(fc) - 0.5) * 0.14;

  vec3 col = (lvl < 0.30) ? C_SAND_A : (lvl < 0.62) ? C_SAND_B : C_SAND_C;

  float grain = hash12(fc + 11.0);
  if (grain > 0.90)      col *= 1.035;
  else if (grain < 0.10) col *= 0.965;

  vec2  cell = floor(P * 24.0);
  float ch   = hash12(cell * 1.73 + 5.0);
  if (ch > 0.950) {
    vec2  cp = fract(P * 24.0);
    vec2  co = vec2(hash12(cell + 3.1), hash12(cell + 7.7));
    float dd = length(cp - co);
    float rad = (ch > 0.984) ? 0.18 : 0.13;
    if (dd < rad) {
      col = (ch > 0.9955) ? C_ACCENT
          : (ch > 0.984)  ? C_SHELL
                          : C_PEBBLE;
    }
  }

  float trail = max(max(step(s, base + A1 * p1) * f1,
                        step(s, base + A2 * p2) * f2),
                        step(s, base + A3 * p3) * f3);
  float lace  = fbm(fp * 30.0 - vec2(0.0, t * 0.15));
  float lace2 = fbm(fp * 74.0 + vec2(t * 0.06, 0.0));
  if (trail > 0.05 && s > wEdge &&
      lace * 0.70 + lace2 * 0.30 + trail * 0.40 > 0.74 + (bayer4(fc) - 0.5) * 0.22) {
    col = mix(col, C_FOAM, 0.85);
  }

  /* water */
  if (depth > 0.0) {
    float wd = clamp(depth / 0.36, 0.0, 1.0);
    wd += (bayer4(fc) - 0.47) * 0.10;

    col = (wd > 0.70) ? C_DEEP
        : (wd > 0.40) ? C_MID
        : (wd > 0.15) ? C_SHALLOW
                      : C_SHINE;

    float ripple = sin(s * 54.0 - t * 0.95
                       + vnoise(vec2(u * 2.6, t * 0.10)) * 3.4);
    if (depth > 0.10 && ripple > 0.80 + (bayer4(fc) - 0.5) * 0.5) {
      col = mix(col, C_SHINE, 0.45);
    }

    float g = hash12(floor(fc) + vec2(floor(t * 4.0) * 17.31,
                                      floor(t * 4.0) *  9.73));
    if (depth > 0.13 && g > uGlitter) col = C_FOAM;

    float rushAmt = clamp(max(max(r1, r2), r3), 0.0, 1.0);
    float foamW   = 0.014 + 0.030 * rushAmt;
    float fEdge   = depth / foamW;

    /* The breaking edge. Clumps (low octave) with bubbles inside them
       (high octave), both sampled isotropically so the mask is blobs
       rather than combs running across the band. */
    if (fEdge < 1.0) {
      float n = fbm(fp * 34.0 - vec2(t * 0.09, t * 0.34));
      float b = fbm(fp * 88.0 + vec2(t * 0.18, -t * 0.58));
      float thresh = 0.20 + (n - 0.5) * 0.78 + (b - 0.5) * 0.34
                   + (bayer4(fc) - 0.5) * 0.24;
      if (1.0 - fEdge > thresh) col = C_FOAM;
    }

    /* Loose foam floating just behind the break. */
    if (fEdge > 0.85 && fEdge < 2.4) {
      float n2 = fbm(fp * 24.0 + vec2(9.0, -t * 0.18));
      float b2 = fbm(fp * 62.0 - vec2(t * 0.11, t * 0.30));
      if (n2 * 0.68 + b2 * 0.32 > 0.60 + (bayer4(fc) - 0.5) * 0.24) {
        col = mix(col, C_FOAM, 0.7);
      }
    }
  }

  /* Fade toward the page background so foreground text keeps its contrast,
     then quantise so the result still lives on a small hard palette. */
  col = mix(col, uWashCol, uWash);
  col = floor(col * uLevels + bayer8(fc + 3.0)) / uLevels;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('beach shader:', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

export function initBeach() {
  const canvas = document.getElementById('beach-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    antialias: false, depth: false, stencil: false, powerPreference: 'low-power',
  }) || canvas.getContext('experimental-webgl');

  // No WebGL: leave the CSS gradient fallback (components.css) in place.
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('beach shader link:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uniform = {};
  ['uRes', 'uTime', 'C_DEEP', 'C_MID', 'C_SHALLOW', 'C_SHINE', 'C_FOAM',
   'C_SAND_A', 'C_SAND_B', 'C_SAND_C', 'C_PEBBLE', 'C_SHELL', 'C_ACCENT',
   'uWashCol', 'uWash', 'uLevels', 'uGlitter',
  ].forEach((name) => { uniform[name] = gl.getUniformLocation(program, name); });

  gl.uniform3fv(uniform.C_DEEP,    hexToRgb(SEAGLASS.deep));
  gl.uniform3fv(uniform.C_MID,     hexToRgb(SEAGLASS.mid));
  gl.uniform3fv(uniform.C_SHALLOW, hexToRgb(SEAGLASS.shallow));
  gl.uniform3fv(uniform.C_SHINE,   hexToRgb(SEAGLASS.shine));
  gl.uniform3fv(uniform.C_FOAM,    hexToRgb(SEAGLASS.foam));
  gl.uniform3fv(uniform.C_SAND_A,  hexToRgb(SEAGLASS.sandA));
  gl.uniform3fv(uniform.C_SAND_B,  hexToRgb(SEAGLASS.sandB));
  gl.uniform3fv(uniform.C_SAND_C,  hexToRgb(SEAGLASS.sandC));
  gl.uniform3fv(uniform.C_PEBBLE,  hexToRgb(SEAGLASS.pebble));
  gl.uniform3fv(uniform.C_SHELL,   hexToRgb(SEAGLASS.shell));
  gl.uniform3fv(uniform.C_ACCENT,  hexToRgb(SEAGLASS.accent));
  gl.uniform3fv(uniform.uWashCol,  hexToRgb(SEAGLASS.pageBg));
  gl.uniform1f(uniform.uWash,    SEAGLASS.wash);
  gl.uniform1f(uniform.uLevels,  SEAGLASS.levels);
  gl.uniform1f(uniform.uGlitter, SEAGLASS.glitter);

  function resize() {
    const cssW = canvas.clientWidth  || canvas.parentElement.clientWidth;
    const cssH = canvas.clientHeight || canvas.parentElement.clientHeight;

    let w = Math.round(cssW / PIXEL_SIZE);
    w = Math.min(MAX_INTERNAL_WIDTH, Math.max(MIN_INTERNAL_WIDTH, w));
    const h = Math.max(64, Math.round(w * cssH / cssW));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uniform.uRes, w, h);
    }
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let clock = 0, last = performance.now(), running = true, raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1); // clamp after tab switches
    last = now;
    if (!reduced) clock += dt * SPEED;
    resize();
    gl.uniform1f(uniform.uTime, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (reduced) cancelAnimationFrame(raf); // one still frame only
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (running) { cancelAnimationFrame(raf); running = false; }
    } else if (!running) {
      running = true; last = performance.now(); raf = requestAnimationFrame(frame);
    }
  });
  window.addEventListener('resize', resize, { passive: true });

  resize();
  raf = requestAnimationFrame(frame);
}
