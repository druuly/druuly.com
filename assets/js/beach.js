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

/* Ordered (Bayer) dithering: flip between two palette colours on a fixed
   pixel lattice instead of blending, so it reads as texture, not blur. */
float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

/* One wave's run-up cycle: a quick rush up the sand, then a long drain.
   reach = the water edge right now. peak/fade = the foam it left behind. */
void waveCycle(float t, float period, float offs,
               out float reach, out float peak, out float fade) {
  float ph   = fract(t / period + offs);
  float rush = smoothstep(0.0, 0.13, ph);
  float back = 1.0 - smoothstep(0.18, 1.0, ph);
  reach = pow(clamp(rush * back, 0.0, 1.0), 0.75);

  float pph = min(ph, 0.155);
  peak = pow(clamp(smoothstep(0.0, 0.13, pph) *
                   (1.0 - smoothstep(0.18, 1.0, pph)), 0.0, 1.0), 0.75);
  fade = 1.0 - smoothstep(0.16, 0.80, ph);
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
            + 0.014 * vnoise(vec2(u * 2.2, t * 0.06));

  float swell = 0.011 * sin(t * 0.55 + u * 3.1);
  float base  = SHORE + wob + swell;

  float r1, p1, f1, r2, p2, f2, r3, p3, f3;
  waveCycle(t, 11.0, 0.00, r1, p1, f1);
  waveCycle(t,  7.3, 0.41, r2, p2, f2);
  waveCycle(t,  4.7, 0.73, r3, p3, f3);

  const float A1 = 0.150, A2 = 0.096, A3 = 0.058;

  float j1 = 0.016 * sin(u *  7.9 + 1.3);
  float j2 = 0.013 * sin(u * 13.1 - 0.6);
  float j3 = 0.010 * sin(u * 17.7 + 2.4);

  float e1 = base + A1 * r1 + j1 * r1;
  float e2 = base + A2 * r2 + j2 * r2;
  float e3 = base + A3 * r3 + j3 * r3;
  float wEdge = max(max(e1, e2), e3);

  wEdge += (vnoise(vec2(u * 34.0, t * 0.9)) - 0.5) * 0.010;

  float depth = wEdge - s;

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
  float lace = vnoise(vec2(u * 26.0, s * 90.0 - t * 0.4));
  if (trail > 0.05 && s > wEdge &&
      lace + trail * 0.62 > 0.96 + (bayer4(fc) - 0.5) * 0.30) {
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

    float ripple = sin(s * 54.0 - t * 1.45
                       + vnoise(vec2(u * 2.6, t * 0.14)) * 3.4);
    if (depth > 0.10 && ripple > 0.80 + (bayer4(fc) - 0.5) * 0.5) {
      col = mix(col, C_SHINE, 0.45);
    }

    float g = hash12(floor(fc) + vec2(floor(t * 6.0) * 17.31,
                                      floor(t * 6.0) *  9.73));
    if (depth > 0.13 && g > uGlitter) col = C_FOAM;

    float rushAmt = max(max(r1, r2), r3);
    float foamW   = 0.012 + 0.030 * rushAmt;
    float fEdge   = depth / foamW;
    if (fEdge < 1.0) {
      float n = vnoise(vec2(u * 30.0, t * 1.1));
      if (1.0 - fEdge > 0.16 + n * 0.42 + (bayer4(fc) - 0.5) * 0.34) col = C_FOAM;
    }

    if (fEdge > 0.9 && fEdge < 2.2) {
      float n2 = vnoise(vec2(u * 22.0 + 9.0, t * 0.8));
      if (n2 > 0.70 + (bayer4(fc) - 0.5) * 0.4) col = mix(col, C_FOAM, 0.7);
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
