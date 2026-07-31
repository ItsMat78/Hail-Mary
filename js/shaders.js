/* VAST ARRAY — GLSL sources.
   WebGL1 / GLSL ES 1.00 so this runs from file:// on essentially anything.
   Three programs: scene -> blur (x2) -> composite. */

window.VA_SHADERS = (function () {
  'use strict';

  /* The tunables from config.js become #defines, so the numbers live in one
     readable file instead of being buried in GLSL string literals. */
  function defines() {
    var cfg = window.VA_CONFIG || {};
    var out = [];
    var k;
    /* Floats: GLSL will not accept a bare integer where a float is expected. */
    var g = cfg.glsl || {};
    for (k in g) {
      if (!Object.prototype.hasOwnProperty.call(g, k)) { continue; }
      out.push('#define ' + k + ' ' + (typeof g[k] === 'number' ? g[k].toFixed(6) : g[k]));
    }
    /* Integers, kept apart rather than guessed at from the value: a loop
       bound has to be a constant integer, and 32.000000 will not compile. */
    var gi = cfg.glslInt || {};
    for (k in gi) {
      if (!Object.prototype.hasOwnProperty.call(gi, k)) { continue; }
      out.push('#define ' + k + ' ' + (gi[k] | 0));
    }
    return out.join('\n') + '\n';
  }

  var D = defines();

  /* Fullscreen triangle. WebGL1 has no gl_VertexID, so positions come from a buffer. */
  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------------- scene */
  /* Nebula, starfield, bokeh, dust, and the lit ridge. Everything here is
     "in front of the lens" — no camera effects yet, those come in composite. */
  var SCENE = [
    'precision highp float;',
    'varying vec2 vUv;',

    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uLight;',    // pointer, 0..1, y up
    'uniform float uScroll;',   // 0..1 page progress
    'uniform vec3  uC1;',       // crimson mass  (left)
    'uniform vec3  uC2;',       // amber mass    (low / rim light)
    'uniform vec3  uC3;',       // teal mass     (right)
    'uniform vec3  uLightCol;', // colour of the moving light
    'uniform vec2  uFlow;',     // smoothed pointer velocity, stirs the clouds
    'uniform float uSwirl;',    // signed vorticity from that velocity
    'uniform float uLowQ;',     // 1.0 = fewer fbm octaves
    'uniform float uDrift;',    // 0.0 = reduced motion, freeze all time terms

    'const vec3 ICE = vec3(0.81, 0.90, 1.0);',

    /* Hoskins hash — the naive sin/fract one banded into visible blocks once
       the fbm pushed the coordinates up. */
    'float hash21(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',

    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',

    /* Scaled to the same peak as fbm4, so dropping to low quality changes how
       detailed the cloud is without also changing how much of it there is. */
    'float fbm2(vec2 p) {',
    '  return (0.5 * vnoise(p) + 0.25 * vnoise(p * 2.02)) * 1.25;',
    '}',

    'float fbm3(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }',
    '  return v;',
    '}',

    'float fbm4(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}',

    'float fbmQ(vec2 p) {',
    '  if (uLowQ > 0.5) { return fbm2(p); }',
    '  return fbm4(p);',
    '}',

    /* Domain-warped fbm. One warp, not two — the second pass cost as much as
       everything else on screen and barely changed the shape. `core` comes
       back as the hot inner part, which is what the bloom pass picks up. */
    'float nebula(vec2 p, float t, out float core) {',
    '  vec2 q = vec2(fbm3(p), fbm3(p + vec2(5.2, 1.3)));',
    '  vec2 r = vec2(fbm3(p + 2.2 * q + vec2(1.7, 9.2) + t * 0.050),',
    '                fbm3(p + 2.2 * q + vec2(8.3, 2.8) - t * 0.041));',
    '  float f = fbmQ(p + 2.6 * r);',
    '  core = pow(max(f - CORE_CUT, 0.0) * 3.1, 2.6);',
    '  return f;',
    '}',

    /* One depth layer of stars: sparse cells, jittered, with a slow twinkle. */
    'float starLayer(vec2 uv, float density, float size, float seed, float t) {',
    '  vec2 gv = uv * density;',
    '  vec2 id = floor(gv);',
    '  vec2 f  = fract(gv) - 0.5;',
    '  float h = hash21(id + seed);',
    '  if (h < 0.87) { return 0.0; }',
    '  vec2 off = (vec2(hash21(id + seed + 11.0), hash21(id + seed + 23.0)) - 0.5) * 0.66;',
    '  float bright = fract(h * 77.7);',
    '  float d = length(f - off);',
    '  float tw = 0.62 + 0.38 * sin(t * (0.7 + bright * 2.6) + h * 120.0);',
    '  return smoothstep(size * (0.35 + bright), 0.0, d) * bright * tw;',
    '}',

    /* Defocused highlights take the shape of the aperture, so: hexagons,
       hollow, with a bright rim. */
    'float hexSDF(vec2 p, float r) {',
    '  p = abs(p);',
    '  return max(p.x * 0.866025 + p.y * 0.5, p.y) - r;',
    '}',

    'float bokeh(vec2 uv, float t) {',
    '  float acc = 0.0;',
    '  for (int i = 0; i < 4; i++) {',
    '    float fi = float(i);',
    '    vec2 c = vec2(hash21(vec2(fi, 4.1)), hash21(vec2(fi, 8.7)));',
    '    c = c * vec2(1.7, 1.0) - vec2(0.85, 0.5);',
    '    c += 0.02 * vec2(sin(t * 0.11 + fi), cos(t * 0.09 + fi));',
    '    float r = 0.012 + hash21(vec2(fi, 2.3)) * 0.017;',
    '    float h = hexSDF(uv - c, r);',
    '    float disc = smoothstep(0.010, -0.006, h) * 0.13;',
    '    float rim  = smoothstep(0.012, 0.0, abs(h)) * 0.16;',
    '    acc += (disc + rim) * (0.35 + hash21(vec2(fi, 6.9)) * 0.65);',
    '  }',
    '  return acc;',
    '}',

    /* Dust motes falling down-right through the beam, as on the poster. */
    'float dust(vec2 uv, float t) {',
    '  float a = -0.36;',
    '  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));',
    '  vec2 p = R * uv;',
    '  p.x *= 34.0;',
    '  float id = floor(p.x);',
    '  float fx = fract(p.x) - 0.5;',
    '  float h = hash21(vec2(id, 3.7));',
    '  if (h < DUST_SPARSITY) { return 0.0; }',
    /* +t, not -t. Negating it ran the motes upward. */
    '  float y = fract(p.y * 2.1 + t * (0.05 + h * 0.10) * DUST_SPEED + h * 17.0);',
    '  float len = 0.03 + h * 0.06;',
    '  float streak = smoothstep(len, 0.0, y) * smoothstep(0.0, 0.004, y);',
    '  float line = smoothstep(0.022, 0.0, abs(fx));',
    '  return streak * line * (0.25 + h * 0.75);',
    '}',

    /* The dark planetary limb: tall on the left, falling away to the right. */
    /* A dark mass in the lower left that falls away to nothing by mid-frame,
       which is where the poster puts its planetary limb. */
    'float ridgeHeight(float x) {',
    '  return -0.004',
    '       + RIDGE_H * smoothstep(0.46, -0.14, x)',
    '       + 0.022 * sin(x * 3.1 + 0.6)',
    '       + 0.013 * sin(x * 7.3 - 1.2)',
    '       + 0.007 * sin(x * 17.9 + 2.4)',
    '       + 0.004 * sin(x * 31.0 - 0.8);',
    '}',

    'void main() {',
    '  vec2 uv = vUv;',
    '  float aspect = uRes.x / max(uRes.y, 1.0);',
    '  float t = uTime * uDrift;',

    /* Parallax: each depth moves a different amount with the pointer and scroll. */
    '  vec2 pan = (uLight - 0.5);',
    '  vec2 sp  = (uv - 0.5) * vec2(aspect, 1.0);',

    '  vec3 col = vec3(0.0);',

    /* --- stir ----------------------------------------------------------- */
    /* uFlow and uSwirl arrive already integrated: they are where the medium
       has been pushed and rotated to, not how fast it is moving. So the
       clouds hold their new position once the pointer stops instead of
       sliding back to where they started. */
    '  float ca = cos(uSwirl), sa = sin(uSwirl);',
    '  vec2 fsp = mat2(ca, -sa, sa, ca) * sp - uFlow;',

    /* --- nebula: one warped layer over a cheap wash -------------------- */
    '  float coreNear = 0.0;',
    '  vec2 pNear = fsp * NEB_SCALE + pan * 0.13 + vec2(0.0, uScroll * 0.95);',
    '  float dNear = nebula(pNear - vec2(6.0, 3.0), t, coreNear);',

    '  float dFar = fbm3(fsp * 1.05 + pan * 0.05 + vec2(7.3, uScroll * 0.40));',

    /* Where the poster puts its colour: crimson left, teal right, amber low.
       The pointer slides that whole split, so moving right warms the sky to
       teal and moving left pulls the crimson across. */
    '  float lx = uv.x + (uLight.x - 0.5) * 0.42;',
    '  float ly = uv.y + (uLight.y - 0.5) * 0.30;',
    '  float wCrim  = smoothstep(0.82, 0.02, lx);',
    '  float wTeal  = smoothstep(0.18, 0.98, lx);',
    '  float wAmber = smoothstep(0.62, -0.05, ly);',

    '  vec3 tint = uC1 * wCrim + uC3 * wTeal + uC2 * wAmber * 0.55;',
    '  tint /= max(wCrim + wTeal + wAmber * 0.55, 0.35);',

    /* The poster is mostly black. Clouds are the exception, not the field,
       so cut hard into the noise and let the tail be what shows. */
    '  float density = dNear * 0.72 + dFar * 0.40;',
    '  density = pow(max(density - NEB_CUT, 0.0) * NEB_GAIN, NEB_POW);',
    '  density *= 0.35 + 0.65 * smoothstep(-0.05, 0.55, uv.y);',
    '  col += tint * density * NEB_BRIGHT;',

    /* Hot cores read as white before they read as colour, the way a sensor
       clips, and they are what the bloom pass picks up. */
    '  col += mix(tint, vec3(1.0), 0.5) * coreNear * CORE_BRIGHT;',

    /* --- stars, three depths ------------------------------------------ */
    '  vec2 s1 = sp * 1.0 + pan * 0.010 + vec2(0.0, uScroll * 0.10);',
    '  vec2 s2 = sp * 1.0 + pan * 0.028 + vec2(0.0, uScroll * 0.24);',
    '  vec2 s3 = sp * 1.0 + pan * 0.055 + vec2(0.0, uScroll * 0.44);',
    '  float st = starLayer(s1, 34.0, 0.030, 1.0, t)',
    '           + starLayer(s2, 20.0, 0.042, 7.0, t) * 0.9',
    '           + starLayer(s3, 11.0, 0.060, 3.0, t) * 0.8;',
    '  col += ICE * st * STAR_BRIGHT;',

    /* Nearest layer is out of focus. */
    '  col += ICE * bokeh(fsp + pan * 0.09, t) * BOKEH_BRIGHT;',

    /* --- the sun -------------------------------------------------------- */
    /* The light source is a star, drawn here rather than left abstract: a
       granulated photosphere, a hot limb, a corona, and the diffraction
       spikes a lens gives any point source. It is drawn before the ridge, so
       it can set behind the horizon, and the DOM headings sit above the
       canvas, so it passes behind the type as well. */
    '  vec2 sd = (uv - uLight) * vec2(aspect, 1.0);',
    '  float sr = length(sd);',
    '  float beam = exp(-sr * 2.9);',
    '  float sunAng = atan(sd.y, sd.x);',

    /* Convection cells, drifting slowly across the face. */
    '  float gran = fbm3(sd * (9.0 / SUN_RADIUS) + vec2(t * 0.08, -t * 0.05));',

    /* A real limb is not a clean circle — this is what makes it read as a
       body with an atmosphere rather than a drawn dot. */
    '  float edgeN = fbm3(vec2(sunAng * 1.9, t * 0.16));',
    '  float R = SUN_RADIUS * (1.0 + 0.09 * (edgeN - 0.5));',

    /* Limb darkening: you see deeper, hotter gas at the centre of the disc
       and cooler gas obliquely at the edge. */
    '  float q = min(sr / R, 1.0);',
    '  float mu = sqrt(max(1.0 - q * q, 0.0));',
    '  float disc = smoothstep(R, R * 0.955, sr);',
    '  vec3 hot = mix(uLightCol, vec3(1.0), 0.72);',
    '  vec3 surface = hot * (1.0 - SUN_GRAIN * 0.5 + SUN_GRAIN * gran) * (0.35 + 0.85 * mu);',
    '  col = mix(col, surface * SUN_BRIGHT, disc);',

    /* Chromosphere: the thin bright line right at the edge. */
    '  col += mix(uLightCol, vec3(1.0), 0.25) * exp(-abs(sr - R) / (R * 0.11)) * 0.5;',

    '  float outside = max(sr - R, 0.0);',
    '  float corona = exp(-outside / (R * 3.0)) * (1.0 - disc * 0.8);',
    '  float spikes = pow(abs(cos(sunAng * 3.0 + t * 0.04)), 24.0)',
    '              * exp(-outside / (R * 18.0)) * (1.0 - disc);',
    '  col += uLightCol * (corona * SUN_CORONA + spikes * SUN_SPIKES);',

    /* Motes only catch the light when they are in it. */
    '  float mote = dust(sp * 1.0 + pan * 0.05, t);',
    '  col += mix(ICE, uLightCol, 0.45) * mote * (0.02 + beam * DUST_BRIGHT);',

    /* --- ridge --------------------------------------------------------- */
    /* The horizon sinks out of frame as you climb away from it and rises
       again at the end, so the scroll reads as the camera tilting up rather
       than the same foreground tagging along through every section. */
    '  float drop = sin(uScroll * 3.14159265) * RIDGE_DROP;',
    '  float h0 = ridgeHeight(uv.x) - drop;',
    '  float h1 = ridgeHeight(uv.x + 0.006) - drop;',
    '  vec2 tang = normalize(vec2(0.006, h1 - h0));',
    '  vec2 nrm  = vec2(-tang.y, tang.x);',
    '  float inside = smoothstep(0.0016, -0.0016, uv.y - h0);',

    /* The rim brightens where the surface faces the pointer, so moving the
       cursor sweeps the hot edge along the crest. Falloff does more of that
       work than the angle does — without it the whole crest lights evenly and
       the pointer appears to do nothing at all. */
    '  vec2 lv = (uLight - vec2(uv.x, h0)) * vec2(aspect, 1.0);',
    '  vec2 toLight = normalize(lv + vec2(1e-4));',
    '  float ndl = max(dot(nrm, toLight), 0.0);',
    '  float atten = 1.0 / (1.0 + dot(lv, lv) * 5.5);',
    '  float edge = exp(-max(h0 - uv.y, 0.0) * 260.0);',
    '  float rim = inside * edge * pow(ndl, 2.2) * (0.16 + atten * 2.8);',

    '  vec3 rock = vec3(0.008, 0.011, 0.022) + uC2 * 0.022 * ndl * (0.3 + atten);',
    '  col = mix(col, rock, inside);',
    '  col += uC2 * rim * RIM_BRIGHT;',
    '  col += vec3(1.0) * pow(rim, 2.6) * 0.5;',

    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '}'
  ].join('\n');

  /* ----------------------------------------------------------------- blur */
  /* Separable Gaussian. The first (horizontal) pass doubles as the bright
     pass so bloom only grows from what is actually hot. */
  var BLUR = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2  uDir;',       // texel-sized step, one axis
    'uniform float uThreshold;', // < 0 disables the bright pass

    'vec3 tap(vec2 uv) {',
    '  vec3 c = texture2D(uTex, uv).rgb;',
    '  if (uThreshold >= 0.0) {',
    '    float l = dot(c, vec3(0.299, 0.587, 0.114));',
    '    c *= smoothstep(uThreshold, uThreshold + 0.28, l);',
    '  }',
    '  return c;',
    '}',

    'void main() {',
    '  vec3 sum = tap(vUv) * 0.2270270270;',
    '  sum += tap(vUv + uDir * 1.3846153846) * 0.3162162162;',
    '  sum += tap(vUv - uDir * 1.3846153846) * 0.3162162162;',
    '  sum += tap(vUv + uDir * 3.2307692308) * 0.0702702703;',
    '  sum += tap(vUv - uDir * 3.2307692308) * 0.0702702703;',
    '  gl_FragColor = vec4(sum, 1.0);',
    '}'
  ].join('\n');

  /* ----------------------------------------------------------------- mask */
  /* Stamps one heading from the atlas into the viewport-space occluder mask.
     Every heading is rasterised once into a single atlas texture; each frame
     the visible ones get blitted to wherever they currently sit on screen.
     That keeps scrolling free — no re-rasterising, no re-uploading — and lets
     the ray pass sample the mask with plain uv instead of testing rectangles. */
  var QUAD_VERT = [
    'attribute vec2 aPos;',      // unit quad, 0..1
    'uniform vec4 uDst;',        // destination x, y, w, h in clip space
    'uniform vec4 uSrc;',        // source x, y, w, h in atlas uv
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uSrc.xy + aPos * uSrc.zw;',
    '  gl_Position = vec4(uDst.xy + aPos * uDst.zw, 0.0, 1.0);',
    '}'
  ].join('\n');

  var QUAD_FRAG = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'void main() { gl_FragColor = texture2D(uTex, vUv); }'
  ].join('\n');

  /* ----------------------------------------------------------------- rays */
  /* Volumetric light from the pointer, with the wordmark as a wall.
     Each fragment walks back toward the light through an occluder mask; every
     step that lands on a letter stops contributing. So light fills the space
     it can reach and stops dead behind the type, and the letters throw shafts
     that swing around as the light moves. */
  var RAYS = [
    'precision highp float;',
    'varying vec2 vUv;',

    'uniform sampler2D uMask;',   // viewport-space occluder coverage
    'uniform vec2  uLight;',
    'uniform vec3  uLightCol;',
    'uniform vec2  uRes;',
    'uniform float uRayAmt;',

    /* The mask is already in viewport space, so this is a straight lookup. */
    'float occluded(vec2 p) { return texture2D(uMask, p).a; }',

    'void main() {',
    '  vec2 uv = vUv;',
    '  float aspect = uRes.x / max(uRes.y, 1.0);',

    '  vec2 delta = (uv - uLight) * (1.0 / float(RAY_STEPS)) * 1.02;',
    '  vec2 coord = uv;',
    '  float illum = 1.0;',
    '  float acc = 0.0;',
    '  for (int i = 0; i < RAY_STEPS; i++) {',
    '    coord -= delta;',
    '    acc += (1.0 - occluded(coord)) * illum;',
    '    illum *= RAY_DECAY;',
    '  }',
    '  acc /= float(RAY_STEPS);',

    /* Inverse-square falloff, and a hotter core right at the source. The
       accumulation above is near-uniform wherever nothing blocks it, so this
       is what keeps the shafts local instead of washing the whole frame. */
    '  float d = length((uv - uLight) * vec2(aspect, 1.0));',
    '  float fall = 1.0 / (1.0 + d * d * RAY_REACH);',
    '  float core = exp(-d * 8.0);',

    '  vec3 col = uLightCol * acc * (fall * RAY_FALL + core * RAY_CORE) * uRayAmt;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------ composite */
  /* This is the lens and the sensor: aberration, bloom, anamorphic streak,
     ghosts, vignette, tone curve, grain. Order matters and matches a camera. */
  var COMPOSITE = [
    'precision highp float;',
    'varying vec2 vUv;',

    'uniform sampler2D uScene;',
    'uniform sampler2D uBloom;',
    'uniform sampler2D uRays;',
    'uniform vec3  uLightCol;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uLight;',
    'uniform float uExposure;',
    'uniform float uAberration;',
    'uniform float uGrain;',
    'uniform float uVignette;',
    'uniform float uFlare;',
    'uniform float uMotion;',   // pointer speed, 0 at rest
    'uniform float uBloomAmt;',

    'const vec3 ICE = vec3(0.81, 0.90, 1.0);',

    'float gnoise(vec2 p) {',
    '  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',

    /* Real glass separates the channels more the further you are from the
       axis, so the offset scales with distance squared. */
    'vec3 sampleCA(sampler2D tex, vec2 uv, float amt) {',
    '  vec2 d = uv - 0.5;',
    '  vec2 off = d * dot(d, d) * amt;',
    '  return vec3(',
    '    texture2D(tex, uv + off).r,',
    '    texture2D(tex, uv).g,',
    '    texture2D(tex, uv - off).b);',
    '}',

    'vec3 aces(vec3 x) {',
    '  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',
    '}',

    'void main() {',
    '  vec2 uv = vUv;',
    '  float aspect = uRes.x / max(uRes.y, 1.0);',

    '  vec3 col   = sampleCA(uScene, uv, uAberration);',
    '  vec3 bloom = sampleCA(uBloom, uv, uAberration * 1.8);',
    '  col += bloom * uBloomAmt;',
    '  col += texture2D(uRays, uv).rgb;',

    /* How much light is actually at the pointer. No bright subject, no flare —
       which is why the streak and ghosts come and go as you move. */
    '  vec3 atLight = texture2D(uBloom, uLight).rgb;',
    '  float energy = clamp(dot(atLight, vec3(0.299, 0.587, 0.114)) * 2.4, 0.0, 1.4);',
    '  float flare = uFlare * energy;',
    /* The streak also answers to movement, so it sweeps out whenever the
       pointer travels and settles away once it stops — not only when there
       happens to be something bright underneath it. Ghosts stay tied to the
       actual light, since a lens only throws those from a real source. */
    '  float streakAmt = uFlare * (energy + uMotion * STREAK_MOTION);',

    /* Anamorphic streak: tight bright core inside a wide soft one. */
    '  float dy = abs(uv.y - uLight.y);',
    '  float dx = abs(uv.x - uLight.x);',
    '  float core = exp(-dy * 780.0) * exp(-dx * 1.7);',
    '  float wide = exp(-dy * 130.0) * exp(-dx * 2.6);',
    '  vec3 streakCol = mix(ICE, uLightCol, 0.55);',
    '  col += streakCol * (core * STREAK_AMT + wide * 0.34) * streakAmt;',

    /* Ghosts sit opposite the light through the optical centre, and they are
       rings, not discs — the hollow is the aperture. */
    '  for (int i = 0; i < 4; i++) {',
    '    float fi = float(i) + 1.0;',
    '    vec2 gp = 0.5 + (0.5 - uLight) * (fi * 0.62);',
    '    float r = 0.022 + fi * 0.030;',
    '    float d = length((uv - gp) * vec2(aspect, 1.0));',
    '    float ring = smoothstep(r, r * 0.72, d) * smoothstep(r * 0.42, r * 0.78, d);',
    '    vec3 tintA = mix(uLightCol, vec3(0.77, 0.17, 0.30), fract(fi * 0.37));',
    '    vec3 tintB = mix(vec3(1.00, 0.62, 0.32), ICE, fract(fi * 0.61));',
    '    col += ring * mix(tintA, tintB, fract(fi * 0.5)) * flare * GHOST_AMT;',
    '  }',

    /* The optical axis drifts a little toward the light. */
    '  vec2 vc = mix(vec2(0.5), uLight, 0.16);',
    '  float v = length((uv - vc) * vec2(aspect, 1.0)) * 1.02;',
    '  col *= 1.0 - uVignette * clamp(pow(v, 2.1), 0.0, 1.0);',

    '  col = aces(col * uExposure);',
    '  col = pow(col, vec3(1.0 / 2.2));',

    /* Sensor noise lives in the shadows, so weight it that way. */
    '  float g = gnoise(uv * uRes * 0.55 + fract(uTime * 0.71) * 137.0) - 0.5;',
    '  float luma = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col += g * uGrain * mix(1.0, 0.22, luma);',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  return {
    VERT: VERT,
    QUAD_VERT: QUAD_VERT,
    QUAD_FRAG: QUAD_FRAG,
    SCENE: D + SCENE,
    BLUR: BLUR,
    RAYS: D + RAYS,
    COMPOSITE: D + COMPOSITE
  };
})();
