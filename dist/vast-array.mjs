/*! vast-array v0.1.0 */

// src/defaults.js
var defaults_default = {
  /* ------------------------------------------------------------ the star */
  /* The sun under the cursor takes its colour from these four, blended by
     where the pointer is, so a sweep across the page runs it through all of
     them. This is also how real stars work: colour is temperature. */
  light: {
    topLeft: "#4C7BFF",
    // colour when the pointer is at the top left
    topRight: "#35E0B0",
    // colour when the pointer is at the top right
    bottomLeft: "#FF3B4E",
    // colour when the pointer is at the bottom left
    bottomRight: "#FF5BC8"
    // colour when the pointer is at the bottom right
  },
  /* -------------------------------------------------------------- the sky */
  /* Compiled into the shaders as float #defines. */
  glsl: {
    /* Nebula. CUT is the single most useful dial in this file: it is the noise
       value below which there is no cloud at all. */
    NEB_CUT: 0.44,
    // raise for more black and tighter wisps, lower to fill the frame
    NEB_GAIN: 1.45,
    // contrast applied above the cut; higher = harder edges
    NEB_POW: 2.3,
    // higher = wispier edges and a softer falloff into black
    NEB_BRIGHT: 2.3,
    // overall cloud brightness
    NEB_SCALE: 3.3,
    // higher = smaller, busier cloud structures
    /* The hot cores inside the cloud. These are what the bloom pass picks up,
       so they set how much the sky glows rather than just how bright it is. */
    CORE_CUT: 0.66,
    // noise value above which a core forms; raise for rarer, hotter cores
    CORE_BRIGHT: 2.9,
    // how fiercely those cores burn
    STAR_BRIGHT: 1.55,
    // the background starfield
    BOKEH_BRIGHT: 0.3,
    // the out-of-focus hexagons on the nearest layer
    /* The motes falling down-right through the beam. */
    DUST_SPARSITY: 0.8,
    // 0..1, higher means fewer of them
    DUST_SPEED: 2,
    // how fast they fall
    DUST_BRIGHT: 1.3,
    // how brightly they catch the light
    /* The dark planetary limb across the lower left. */
    RIDGE_H: 0.36,
    // its height, as a fraction of the viewport
    RIDGE_DROP: 0.46,
    // how far it sinks out of frame at mid-scroll
    RIM_BRIGHT: 1.7,
    // the hot amber edge along its crest
    /* The sun itself: a photosphere with convection granulation, limb
       darkening, a chromosphere at the edge, a corona, and lens spikes. */
    SUN_RADIUS: 3e-3,
    // its size, as a fraction of viewport height
    SUN_BRIGHT: 0.55,
    // the photosphere; push much past this and the disc clips flat
    SUN_GRAIN: 0.7,
    // convection mottling across its face, 0 = smooth disc
    SUN_CORONA: 0.16,
    // the halo around it
    SUN_SPIKES: 0.12,
    // the six-point diffraction spikes a lens gives a point source
    /* Volumetric light. The headings block this, which is where the shafts
       and the shadows behind the type come from. */
    RAY_FALL: 0.35,
    // brightness of the broad glow
    RAY_CORE: 1.2,
    // brightness of the tight core near the sun
    RAY_REACH: 25,
    // higher keeps light local, lower lets it flood wider
    RAY_DECAY: 0.962,
    // 0..1 per-step falloff along a shaft; lower = shorter shafts
    /* Lens artefacts, added in the composite pass. */
    GHOST_AMT: 0.26,
    // the ring ghosts opposite the sun through frame centre
    STREAK_AMT: 1.5,
    // the horizontal anamorphic streak
    STREAK_MOTION: 1.25
    // how strongly movement alone draws that streak; 0 = only over bright areas
  },
  /* Compiled as integer #defines. Kept apart from the block above because a
     GLSL loop bound has to be a constant int, and 32.000000 will not compile. */
  glslInt: {
    RAY_STEPS: 32
    // samples along each shaft; fewer is cheaper but slightly banded
  },
  /* --------------------------------------------------------- the stirring */
  /* Pointer movement pushes and rotates the whole cloud field. The offset is
     integrated and kept, so the smoke stays where you leave it; only the
     velocity decays, which is what makes it coast to a stop instead of
     springing back to where it started. */
  stir: {
    pushGain: 0.6,
    // how far a full-width sweep displaces the clouds
    swirlGain: 1.3,
    // how much that same sweep rotates them
    decay: 0.03,
    // fraction of velocity left after one second; lower = shorter coast
    pushLimit: 2.5,
    // cap on total displacement, which keeps noise precision sane
    swirlLimit: 1.5
    // cap on total rotation, in radians
  },
  /* ------------------------------------------------------------- easing */
  /* Exponential rates in units of 1/second. Larger = snappier. These are
     frame-rate independent, so they feel the same at 60Hz and 144Hz. */
  ease: {
    light: 6.5,
    // how quickly the sun catches up to the pointer
    scroll: 8,
    // how quickly scroll progress follows the real scroll
    palette: 3.2,
    // how quickly section colours crossfade
    exposureDown: 7.5,
    // an iris stops down fast...
    exposureUp: 1.5
    // ...and opens back up slowly. The asymmetry is the point.
  },
  /* ------------------------------------------------------------- camera */
  camera: {
    bloom: 0.95,
    // how much of the blurred bright pass is added back
    aberrationBase: 35e-4,
    // colour fringing at frame centre
    aberrationEdge: 6e-3,
    // extra fringing out toward the corners
    aberrationVel: 0.022,
    // extra fringing while the pointer is moving
    flareBase: 0.5,
    // baseline strength of streak and ghosts
    flareVel: 0.45,
    // extra flare while the pointer is moving
    motionEase: 7,
    // how fast the movement streak builds and fades away
    vignetteBase: 0.54,
    // corner darkening at the top of the page
    vignetteScroll: 0.14,
    // extra corner darkening by the bottom of the page
    grainBase: 0,
    // sensor noise; it is weighted toward the shadows
    fringePx: 3
    // colour fringing on the type itself, in pixels
  },
  /* ------------------------------------------------------------ quality */
  /* If it runs badly, lower these in order: renderScale, then maxDpr, then
     glslInt.RAY_STEPS. The page also steps itself down and logs when it does. */
  quality: {
    renderScale: 0.9,
    // sky buffer size relative to the screen
    maxDpr: 1.5,
    // ceiling on that buffer's pixel ratio. The nebula is soft, so
    // rendering above ~1x CSS pixels buys nothing on a hidpi screen
    displayDpr: 1.5,
    // ceiling on the final composite's pixel ratio
    warmupSeconds: 2.5,
    // how long to ignore frame times after load. Startup is always
    // janky — fonts, first shader compile, texture uploads — and
    // judging the GPU on that demotes a perfectly capable machine
    slowFrameMs: 30
    // mean frame time above which quality steps down
  }
};

// src/shaders.js
function defines(cfg) {
  var out = [];
  var k;
  var g = cfg.glsl || {};
  for (k in g) {
    if (!Object.prototype.hasOwnProperty.call(g, k)) {
      continue;
    }
    out.push("#define " + k + " " + (typeof g[k] === "number" ? g[k].toFixed(6) : g[k]));
  }
  var gi = cfg.glslInt || {};
  for (k in gi) {
    if (!Object.prototype.hasOwnProperty.call(gi, k)) {
      continue;
    }
    out.push("#define " + k + " " + (gi[k] | 0));
  }
  return out.join("\n") + "\n";
}
var VERT = [
  "attribute vec2 aPos;",
  "varying vec2 vUv;",
  "void main() {",
  "  vUv = aPos * 0.5 + 0.5;",
  "  gl_Position = vec4(aPos, 0.0, 1.0);",
  "}"
].join("\n");
var SCENE = [
  "precision highp float;",
  "varying vec2 vUv;",
  "uniform vec2  uRes;",
  "uniform float uTime;",
  "uniform vec2  uLight;",
  // pointer, 0..1, y up
  "uniform float uScroll;",
  // 0..1 page progress
  "uniform vec3  uC1;",
  // crimson mass  (left)
  "uniform vec3  uC2;",
  // amber mass    (low / rim light)
  "uniform vec3  uC3;",
  // teal mass     (right)
  "uniform vec3  uLightCol;",
  // colour of the moving light
  "uniform vec2  uFlow;",
  // smoothed pointer velocity, stirs the clouds
  "uniform float uSwirl;",
  // signed vorticity from that velocity
  "uniform float uLowQ;",
  // 1.0 = fewer fbm octaves
  "uniform float uDrift;",
  // 0.0 = reduced motion, freeze all time terms
  "const vec3 ICE = vec3(0.81, 0.90, 1.0);",
  /* Hoskins hash — the naive sin/fract one banded into visible blocks once
     the fbm pushed the coordinates up. */
  "float hash21(vec2 p) {",
  "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
  "  p3 += dot(p3, p3.yzx + 33.33);",
  "  return fract((p3.x + p3.y) * p3.z);",
  "}",
  "float vnoise(vec2 p) {",
  "  vec2 i = floor(p);",
  "  vec2 f = fract(p);",
  "  vec2 u = f * f * (3.0 - 2.0 * f);",
  "  float a = hash21(i);",
  "  float b = hash21(i + vec2(1.0, 0.0));",
  "  float c = hash21(i + vec2(0.0, 1.0));",
  "  float d = hash21(i + vec2(1.0, 1.0));",
  "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
  "}",
  /* Scaled to the same peak as fbm4, so dropping to low quality changes how
     detailed the cloud is without also changing how much of it there is. */
  "float fbm2(vec2 p) {",
  "  return (0.5 * vnoise(p) + 0.25 * vnoise(p * 2.02)) * 1.25;",
  "}",
  "float fbm3(vec2 p) {",
  "  float v = 0.0, a = 0.5;",
  "  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }",
  "  return v;",
  "}",
  "float fbm4(vec2 p) {",
  "  float v = 0.0, a = 0.5;",
  "  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }",
  "  return v;",
  "}",
  "float fbmQ(vec2 p) {",
  "  if (uLowQ > 0.5) { return fbm2(p); }",
  "  return fbm4(p);",
  "}",
  /* Domain-warped fbm. One warp, not two — the second pass cost as much as
     everything else on screen and barely changed the shape. `core` comes
     back as the hot inner part, which is what the bloom pass picks up. */
  "float nebula(vec2 p, float t, out float core) {",
  "  vec2 q = vec2(fbm3(p), fbm3(p + vec2(5.2, 1.3)));",
  "  vec2 r = vec2(fbm3(p + 2.2 * q + vec2(1.7, 9.2) + t * 0.050),",
  "                fbm3(p + 2.2 * q + vec2(8.3, 2.8) - t * 0.041));",
  "  float f = fbmQ(p + 2.6 * r);",
  "  core = pow(max(f - CORE_CUT, 0.0) * 3.1, 2.6);",
  "  return f;",
  "}",
  /* One depth layer of stars: sparse cells, jittered, with a slow twinkle. */
  "float starLayer(vec2 uv, float density, float size, float seed, float t) {",
  "  vec2 gv = uv * density;",
  "  vec2 id = floor(gv);",
  "  vec2 f  = fract(gv) - 0.5;",
  "  float h = hash21(id + seed);",
  "  if (h < 0.87) { return 0.0; }",
  "  vec2 off = (vec2(hash21(id + seed + 11.0), hash21(id + seed + 23.0)) - 0.5) * 0.66;",
  "  float bright = fract(h * 77.7);",
  "  float d = length(f - off);",
  "  float tw = 0.62 + 0.38 * sin(t * (0.7 + bright * 2.6) + h * 120.0);",
  "  return smoothstep(size * (0.35 + bright), 0.0, d) * bright * tw;",
  "}",
  /* Defocused highlights take the shape of the aperture, so: hexagons,
     hollow, with a bright rim. */
  "float hexSDF(vec2 p, float r) {",
  "  p = abs(p);",
  "  return max(p.x * 0.866025 + p.y * 0.5, p.y) - r;",
  "}",
  "float bokeh(vec2 uv, float t) {",
  "  float acc = 0.0;",
  "  for (int i = 0; i < 4; i++) {",
  "    float fi = float(i);",
  "    vec2 c = vec2(hash21(vec2(fi, 4.1)), hash21(vec2(fi, 8.7)));",
  "    c = c * vec2(1.7, 1.0) - vec2(0.85, 0.5);",
  "    c += 0.02 * vec2(sin(t * 0.11 + fi), cos(t * 0.09 + fi));",
  "    float r = 0.012 + hash21(vec2(fi, 2.3)) * 0.017;",
  "    float h = hexSDF(uv - c, r);",
  "    float disc = smoothstep(0.010, -0.006, h) * 0.13;",
  "    float rim  = smoothstep(0.012, 0.0, abs(h)) * 0.16;",
  "    acc += (disc + rim) * (0.35 + hash21(vec2(fi, 6.9)) * 0.65);",
  "  }",
  "  return acc;",
  "}",
  /* Dust motes falling down-right through the beam, as on the poster. */
  "float dust(vec2 uv, float t) {",
  "  float a = -0.36;",
  "  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));",
  "  vec2 p = R * uv;",
  "  p.x *= 34.0;",
  "  float id = floor(p.x);",
  "  float fx = fract(p.x) - 0.5;",
  "  float h = hash21(vec2(id, 3.7));",
  "  if (h < DUST_SPARSITY) { return 0.0; }",
  /* +t, not -t. Negating it ran the motes upward. */
  "  float y = fract(p.y * 2.1 + t * (0.05 + h * 0.10) * DUST_SPEED + h * 17.0);",
  "  float len = 0.03 + h * 0.06;",
  "  float streak = smoothstep(len, 0.0, y) * smoothstep(0.0, 0.004, y);",
  "  float line = smoothstep(0.022, 0.0, abs(fx));",
  "  return streak * line * (0.25 + h * 0.75);",
  "}",
  /* The dark planetary limb: tall on the left, falling away to the right. */
  /* A dark mass in the lower left that falls away to nothing by mid-frame,
     which is where the poster puts its planetary limb. */
  "float ridgeHeight(float x) {",
  "  return -0.004",
  "       + RIDGE_H * smoothstep(0.46, -0.14, x)",
  "       + 0.022 * sin(x * 3.1 + 0.6)",
  "       + 0.013 * sin(x * 7.3 - 1.2)",
  "       + 0.007 * sin(x * 17.9 + 2.4)",
  "       + 0.004 * sin(x * 31.0 - 0.8);",
  "}",
  "void main() {",
  "  vec2 uv = vUv;",
  "  float aspect = uRes.x / max(uRes.y, 1.0);",
  "  float t = uTime * uDrift;",
  /* Parallax: each depth moves a different amount with the pointer and scroll. */
  "  vec2 pan = (uLight - 0.5);",
  "  vec2 sp  = (uv - 0.5) * vec2(aspect, 1.0);",
  "  vec3 col = vec3(0.0);",
  /* --- stir ----------------------------------------------------------- */
  /* uFlow and uSwirl arrive already integrated: they are where the medium
     has been pushed and rotated to, not how fast it is moving. So the
     clouds hold their new position once the pointer stops instead of
     sliding back to where they started. */
  "  float ca = cos(uSwirl), sa = sin(uSwirl);",
  "  vec2 fsp = mat2(ca, -sa, sa, ca) * sp - uFlow;",
  /* --- nebula: one warped layer over a cheap wash -------------------- */
  "  float coreNear = 0.0;",
  "  vec2 pNear = fsp * NEB_SCALE + pan * 0.13 + vec2(0.0, uScroll * 0.95);",
  "  float dNear = nebula(pNear - vec2(6.0, 3.0), t, coreNear);",
  "  float dFar = fbm3(fsp * 1.05 + pan * 0.05 + vec2(7.3, uScroll * 0.40));",
  /* Where the poster puts its colour: crimson left, teal right, amber low.
     The pointer slides that whole split, so moving right warms the sky to
     teal and moving left pulls the crimson across. */
  "  float lx = uv.x + (uLight.x - 0.5) * 0.42;",
  "  float ly = uv.y + (uLight.y - 0.5) * 0.30;",
  "  float wCrim  = smoothstep(0.82, 0.02, lx);",
  "  float wTeal  = smoothstep(0.18, 0.98, lx);",
  "  float wAmber = smoothstep(0.62, -0.05, ly);",
  "  vec3 tint = uC1 * wCrim + uC3 * wTeal + uC2 * wAmber * 0.55;",
  "  tint /= max(wCrim + wTeal + wAmber * 0.55, 0.35);",
  /* The poster is mostly black. Clouds are the exception, not the field,
     so cut hard into the noise and let the tail be what shows. */
  "  float density = dNear * 0.72 + dFar * 0.40;",
  "  density = pow(max(density - NEB_CUT, 0.0) * NEB_GAIN, NEB_POW);",
  "  density *= 0.35 + 0.65 * smoothstep(-0.05, 0.55, uv.y);",
  "  col += tint * density * NEB_BRIGHT;",
  /* Hot cores read as white before they read as colour, the way a sensor
     clips, and they are what the bloom pass picks up. */
  "  col += mix(tint, vec3(1.0), 0.5) * coreNear * CORE_BRIGHT;",
  /* --- stars, three depths ------------------------------------------ */
  "  vec2 s1 = sp * 1.0 + pan * 0.010 + vec2(0.0, uScroll * 0.10);",
  "  vec2 s2 = sp * 1.0 + pan * 0.028 + vec2(0.0, uScroll * 0.24);",
  "  vec2 s3 = sp * 1.0 + pan * 0.055 + vec2(0.0, uScroll * 0.44);",
  "  float st = starLayer(s1, 34.0, 0.030, 1.0, t)",
  "           + starLayer(s2, 20.0, 0.042, 7.0, t) * 0.9",
  "           + starLayer(s3, 11.0, 0.060, 3.0, t) * 0.8;",
  "  col += ICE * st * STAR_BRIGHT;",
  /* Nearest layer is out of focus. */
  "  col += ICE * bokeh(fsp + pan * 0.09, t) * BOKEH_BRIGHT;",
  /* --- the sun -------------------------------------------------------- */
  /* The light source is a star, drawn here rather than left abstract: a
     granulated photosphere, a hot limb, a corona, and the diffraction
     spikes a lens gives any point source. It is drawn before the ridge, so
     it can set behind the horizon, and the DOM headings sit above the
     canvas, so it passes behind the type as well. */
  "  vec2 sd = (uv - uLight) * vec2(aspect, 1.0);",
  "  float sr = length(sd);",
  "  float beam = exp(-sr * 2.9);",
  "  float sunAng = atan(sd.y, sd.x);",
  /* Convection cells, drifting slowly across the face. */
  "  float gran = fbm3(sd * (9.0 / SUN_RADIUS) + vec2(t * 0.08, -t * 0.05));",
  /* A real limb is not a clean circle — this is what makes it read as a
     body with an atmosphere rather than a drawn dot. */
  "  float edgeN = fbm3(vec2(sunAng * 1.9, t * 0.16));",
  "  float R = SUN_RADIUS * (1.0 + 0.09 * (edgeN - 0.5));",
  /* Limb darkening: you see deeper, hotter gas at the centre of the disc
     and cooler gas obliquely at the edge. */
  "  float q = min(sr / R, 1.0);",
  "  float mu = sqrt(max(1.0 - q * q, 0.0));",
  "  float disc = smoothstep(R, R * 0.955, sr);",
  "  vec3 hot = mix(uLightCol, vec3(1.0), 0.72);",
  "  vec3 surface = hot * (1.0 - SUN_GRAIN * 0.5 + SUN_GRAIN * gran) * (0.35 + 0.85 * mu);",
  "  col = mix(col, surface * SUN_BRIGHT, disc);",
  /* Chromosphere: the thin bright line right at the edge. */
  "  col += mix(uLightCol, vec3(1.0), 0.25) * exp(-abs(sr - R) / (R * 0.11)) * 0.5;",
  "  float outside = max(sr - R, 0.0);",
  "  float corona = exp(-outside / (R * 3.0)) * (1.0 - disc * 0.8);",
  "  float spikes = pow(abs(cos(sunAng * 3.0 + t * 0.04)), 24.0)",
  "              * exp(-outside / (R * 18.0)) * (1.0 - disc);",
  "  col += uLightCol * (corona * SUN_CORONA + spikes * SUN_SPIKES);",
  /* Motes only catch the light when they are in it. */
  "  float mote = dust(sp * 1.0 + pan * 0.05, t);",
  "  col += mix(ICE, uLightCol, 0.45) * mote * (0.02 + beam * DUST_BRIGHT);",
  /* --- ridge --------------------------------------------------------- */
  /* The horizon sinks out of frame as you climb away from it and rises
     again at the end, so the scroll reads as the camera tilting up rather
     than the same foreground tagging along through every section. */
  "  float drop = sin(uScroll * 3.14159265) * RIDGE_DROP;",
  "  float h0 = ridgeHeight(uv.x) - drop;",
  "  float h1 = ridgeHeight(uv.x + 0.006) - drop;",
  "  vec2 tang = normalize(vec2(0.006, h1 - h0));",
  "  vec2 nrm  = vec2(-tang.y, tang.x);",
  "  float inside = smoothstep(0.0016, -0.0016, uv.y - h0);",
  /* The rim brightens where the surface faces the pointer, so moving the
     cursor sweeps the hot edge along the crest. Falloff does more of that
     work than the angle does — without it the whole crest lights evenly and
     the pointer appears to do nothing at all. */
  "  vec2 lv = (uLight - vec2(uv.x, h0)) * vec2(aspect, 1.0);",
  "  vec2 toLight = normalize(lv + vec2(1e-4));",
  "  float ndl = max(dot(nrm, toLight), 0.0);",
  "  float atten = 1.0 / (1.0 + dot(lv, lv) * 5.5);",
  "  float edge = exp(-max(h0 - uv.y, 0.0) * 260.0);",
  "  float rim = inside * edge * pow(ndl, 2.2) * (0.16 + atten * 2.8);",
  "  vec3 rock = vec3(0.008, 0.011, 0.022) + uC2 * 0.022 * ndl * (0.3 + atten);",
  "  col = mix(col, rock, inside);",
  "  col += uC2 * rim * RIM_BRIGHT;",
  "  col += vec3(1.0) * pow(rim, 2.6) * 0.5;",
  "  gl_FragColor = vec4(max(col, 0.0), 1.0);",
  "}"
].join("\n");
var BLUR = [
  "precision mediump float;",
  "varying vec2 vUv;",
  "uniform sampler2D uTex;",
  "uniform vec2  uDir;",
  // texel-sized step, one axis
  "uniform float uThreshold;",
  // < 0 disables the bright pass
  "vec3 tap(vec2 uv) {",
  "  vec3 c = texture2D(uTex, uv).rgb;",
  "  if (uThreshold >= 0.0) {",
  "    float l = dot(c, vec3(0.299, 0.587, 0.114));",
  "    c *= smoothstep(uThreshold, uThreshold + 0.28, l);",
  "  }",
  "  return c;",
  "}",
  "void main() {",
  "  vec3 sum = tap(vUv) * 0.2270270270;",
  "  sum += tap(vUv + uDir * 1.3846153846) * 0.3162162162;",
  "  sum += tap(vUv - uDir * 1.3846153846) * 0.3162162162;",
  "  sum += tap(vUv + uDir * 3.2307692308) * 0.0702702703;",
  "  sum += tap(vUv - uDir * 3.2307692308) * 0.0702702703;",
  "  gl_FragColor = vec4(sum, 1.0);",
  "}"
].join("\n");
var QUAD_VERT = [
  "attribute vec2 aPos;",
  // unit quad, 0..1
  "uniform vec4 uDst;",
  // destination x, y, w, h in clip space
  "uniform vec4 uSrc;",
  // source x, y, w, h in atlas uv
  "varying vec2 vUv;",
  "void main() {",
  "  vUv = uSrc.xy + aPos * uSrc.zw;",
  "  gl_Position = vec4(uDst.xy + aPos * uDst.zw, 0.0, 1.0);",
  "}"
].join("\n");
var QUAD_FRAG = [
  "precision mediump float;",
  "varying vec2 vUv;",
  "uniform sampler2D uTex;",
  "void main() { gl_FragColor = texture2D(uTex, vUv); }"
].join("\n");
var RAYS = [
  "precision highp float;",
  "varying vec2 vUv;",
  "uniform sampler2D uMask;",
  // viewport-space occluder coverage
  "uniform vec2  uLight;",
  "uniform vec3  uLightCol;",
  "uniform vec2  uRes;",
  "uniform float uRayAmt;",
  /* The mask is already in viewport space, so this is a straight lookup. */
  "float occluded(vec2 p) { return texture2D(uMask, p).a; }",
  "void main() {",
  "  vec2 uv = vUv;",
  "  float aspect = uRes.x / max(uRes.y, 1.0);",
  "  vec2 delta = (uv - uLight) * (1.0 / float(RAY_STEPS)) * 1.02;",
  "  vec2 coord = uv;",
  "  float illum = 1.0;",
  "  float acc = 0.0;",
  "  for (int i = 0; i < RAY_STEPS; i++) {",
  "    coord -= delta;",
  "    acc += (1.0 - occluded(coord)) * illum;",
  "    illum *= RAY_DECAY;",
  "  }",
  "  acc /= float(RAY_STEPS);",
  /* Inverse-square falloff, and a hotter core right at the source. The
     accumulation above is near-uniform wherever nothing blocks it, so this
     is what keeps the shafts local instead of washing the whole frame. */
  "  float d = length((uv - uLight) * vec2(aspect, 1.0));",
  "  float fall = 1.0 / (1.0 + d * d * RAY_REACH);",
  "  float core = exp(-d * 8.0);",
  "  vec3 col = uLightCol * acc * (fall * RAY_FALL + core * RAY_CORE) * uRayAmt;",
  "  gl_FragColor = vec4(col, 1.0);",
  "}"
].join("\n");
var COMPOSITE = [
  "precision highp float;",
  "varying vec2 vUv;",
  "uniform sampler2D uScene;",
  "uniform sampler2D uBloom;",
  "uniform sampler2D uRays;",
  "uniform vec3  uLightCol;",
  "uniform vec2  uRes;",
  "uniform float uTime;",
  "uniform vec2  uLight;",
  "uniform float uExposure;",
  "uniform float uAberration;",
  "uniform float uGrain;",
  "uniform float uVignette;",
  "uniform float uFlare;",
  "uniform float uMotion;",
  // pointer speed, 0 at rest
  "uniform float uBloomAmt;",
  "const vec3 ICE = vec3(0.81, 0.90, 1.0);",
  "float gnoise(vec2 p) {",
  "  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);",
  "}",
  /* Real glass separates the channels more the further you are from the
     axis, so the offset scales with distance squared. */
  "vec3 sampleCA(sampler2D tex, vec2 uv, float amt) {",
  "  vec2 d = uv - 0.5;",
  "  vec2 off = d * dot(d, d) * amt;",
  "  return vec3(",
  "    texture2D(tex, uv + off).r,",
  "    texture2D(tex, uv).g,",
  "    texture2D(tex, uv - off).b);",
  "}",
  "vec3 aces(vec3 x) {",
  "  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);",
  "}",
  "void main() {",
  "  vec2 uv = vUv;",
  "  float aspect = uRes.x / max(uRes.y, 1.0);",
  "  vec3 col   = sampleCA(uScene, uv, uAberration);",
  "  vec3 bloom = sampleCA(uBloom, uv, uAberration * 1.8);",
  "  col += bloom * uBloomAmt;",
  "  col += texture2D(uRays, uv).rgb;",
  /* How much light is actually at the pointer. No bright subject, no flare —
     which is why the streak and ghosts come and go as you move. */
  "  vec3 atLight = texture2D(uBloom, uLight).rgb;",
  "  float energy = clamp(dot(atLight, vec3(0.299, 0.587, 0.114)) * 2.4, 0.0, 1.4);",
  "  float flare = uFlare * energy;",
  /* The streak also answers to movement, so it sweeps out whenever the
     pointer travels and settles away once it stops — not only when there
     happens to be something bright underneath it. Ghosts stay tied to the
     actual light, since a lens only throws those from a real source. */
  "  float streakAmt = uFlare * (energy + uMotion * STREAK_MOTION);",
  /* Anamorphic streak: tight bright core inside a wide soft one. */
  "  float dy = abs(uv.y - uLight.y);",
  "  float dx = abs(uv.x - uLight.x);",
  "  float core = exp(-dy * 780.0) * exp(-dx * 1.7);",
  "  float wide = exp(-dy * 130.0) * exp(-dx * 2.6);",
  "  vec3 streakCol = mix(ICE, uLightCol, 0.55);",
  "  col += streakCol * (core * STREAK_AMT + wide * 0.34) * streakAmt;",
  /* Ghosts sit opposite the light through the optical centre, and they are
     rings, not discs — the hollow is the aperture. */
  "  for (int i = 0; i < 4; i++) {",
  "    float fi = float(i) + 1.0;",
  "    vec2 gp = 0.5 + (0.5 - uLight) * (fi * 0.62);",
  "    float r = 0.022 + fi * 0.030;",
  "    float d = length((uv - gp) * vec2(aspect, 1.0));",
  "    float ring = smoothstep(r, r * 0.72, d) * smoothstep(r * 0.42, r * 0.78, d);",
  "    vec3 tintA = mix(uLightCol, vec3(0.77, 0.17, 0.30), fract(fi * 0.37));",
  "    vec3 tintB = mix(vec3(1.00, 0.62, 0.32), ICE, fract(fi * 0.61));",
  "    col += ring * mix(tintA, tintB, fract(fi * 0.5)) * flare * GHOST_AMT;",
  "  }",
  /* The optical axis drifts a little toward the light. */
  "  vec2 vc = mix(vec2(0.5), uLight, 0.16);",
  "  float v = length((uv - vc) * vec2(aspect, 1.0)) * 1.02;",
  "  col *= 1.0 - uVignette * clamp(pow(v, 2.1), 0.0, 1.0);",
  "  col = aces(col * uExposure);",
  "  col = pow(col, vec3(1.0 / 2.2));",
  /* Sensor noise lives in the shadows, so weight it that way. */
  "  float g = gnoise(uv * uRes * 0.55 + fract(uTime * 0.71) * 137.0) - 0.5;",
  "  float luma = dot(col, vec3(0.299, 0.587, 0.114));",
  "  col += g * uGrain * mix(1.0, 0.22, luma);",
  "  gl_FragColor = vec4(col, 1.0);",
  "}"
].join("\n");
function build(cfg) {
  var D = defines(cfg || {});
  return {
    VERT,
    QUAD_VERT,
    QUAD_FRAG,
    SCENE: D + SCENE,
    BLUR,
    RAYS: D + RAYS,
    COMPOSITE: D + COMPOSITE
  };
}

// src/sky.js
function compile(gl, type, src, label) {
  var sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[sky] " + label + " failed to compile:\n" + gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function program(gl, S, fragSrc, label) {
  var vs = compile(gl, gl.VERTEX_SHADER, S.VERT, label + ":vert");
  var fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc, label + ":frag");
  if (!vs || !fs) {
    return null;
  }
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("[sky] " + label + " failed to link:\n" + gl.getProgramInfoLog(p));
    return null;
  }
  p.u = {};
  var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (var i = 0; i < n; i++) {
    var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
    p.u[name] = gl.getUniformLocation(p, name);
  }
  return p;
}
function quadProgram(gl, S) {
  var vs = compile(gl, gl.VERTEX_SHADER, S.QUAD_VERT, "quad:vert");
  var fs = compile(gl, gl.FRAGMENT_SHADER, S.QUAD_FRAG, "quad:frag");
  if (!vs || !fs) {
    return null;
  }
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("[sky] quad failed to link:\n" + gl.getProgramInfoLog(p));
    return null;
  }
  p.u = {
    uDst: gl.getUniformLocation(p, "uDst"),
    uSrc: gl.getUniformLocation(p, "uSrc"),
    uTex: gl.getUniformLocation(p, "uTex")
  };
  return p;
}
function makeTarget(gl, w, h) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  var fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}
function create(canvas, cfg) {
  var opts = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false
  };
  var gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
  if (!gl) {
    return null;
  }
  var S = build(cfg);
  var progQuad = quadProgram(gl, S);
  var progScene = program(gl, S, S.SCENE, "scene");
  var progBlur = program(gl, S, S.BLUR, "blur");
  var progRays = program(gl, S, S.RAYS, "rays");
  var progComp = program(gl, S, S.COMPOSITE, "composite");
  if (!progQuad || !progScene || !progBlur || !progRays || !progComp) {
    return null;
  }
  var triBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  var boundBuf = null;
  function useGeom(buf) {
    if (boundBuf === buf) {
      return;
    }
    boundBuf = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  var scene = null, blurA = null, blurB = null, rays = null, mask = null;
  var atlasTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0])
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  function setAtlas(canvasEl) {
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasEl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  var scale = Math.min(window.devicePixelRatio || 1, cfg.quality.maxDpr) * cfg.quality.renderScale;
  var steps = 0;
  var lowQ = 0;
  var vw = 0, vh = 0;
  var dbg = gl.getExtension("WEBGL_debug_renderer_info");
  var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  var software = /swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(renderer);
  if (software) {
    scale = 0.3;
    lowQ = 1;
    steps = 1;
    console.warn("[sky] software renderer (" + renderer + ") — starting at reduced quality.");
  }
  function allocate() {
    [scene, blurA, blurB, rays, mask].forEach(function(t) {
      if (t) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
    });
    var w = Math.max(2, Math.floor(vw * scale));
    var h = Math.max(2, Math.floor(vh * scale));
    var bw = Math.max(2, Math.floor(w * 0.25));
    var bh = Math.max(2, Math.floor(h * 0.25));
    scene = makeTarget(gl, w, h);
    blurA = makeTarget(gl, bw, bh);
    blurB = makeTarget(gl, bw, bh);
    var rw = Math.max(2, Math.floor(w * 0.5));
    var rh = Math.max(2, Math.floor(h * 0.5));
    rays = makeTarget(gl, rw, rh);
    mask = makeTarget(gl, rw, rh);
  }
  function resize(cssW, cssH) {
    vw = Math.max(1, cssW);
    vh = Math.max(1, cssH);
    var dpr = Math.min(window.devicePixelRatio || 1, software ? 1 : cfg.quality.displayDpr);
    canvas.width = Math.max(1, Math.floor(vw * dpr));
    canvas.height = Math.max(1, Math.floor(vh * dpr));
    allocate();
  }
  function pass(target, prog) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    if (target) {
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.useProgram(prog);
    useGeom(triBuf);
  }
  function render(s) {
    var u;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    pass(scene, progScene);
    u = progScene.u;
    gl.uniform2f(u.uRes, scene.w, scene.h);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform2f(u.uLight, s.lightX, s.lightY);
    gl.uniform1f(u.uScroll, s.scroll);
    gl.uniform3fv(u.uC1, s.c1);
    gl.uniform3fv(u.uC2, s.c2);
    gl.uniform3fv(u.uC3, s.c3);
    gl.uniform3fv(u.uLightCol, s.lightCol);
    gl.uniform2f(u.uFlow, s.flowX, s.flowY);
    gl.uniform1f(u.uSwirl, s.swirl);
    gl.uniform1f(u.uLowQ, lowQ);
    gl.uniform1f(u.uDrift, s.drift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(blurA, progBlur);
    u = progBlur.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 1.6 / blurA.w, 0);
    gl.uniform1f(u.uThreshold, 0.52);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(blurB, progBlur);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 0, 1.6 / blurB.h);
    gl.uniform1f(u.uThreshold, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(blurA, progBlur);
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 3.4 / blurA.w, 0);
    gl.uniform1f(u.uThreshold, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(blurB, progBlur);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 0, 3.4 / blurB.h);
    gl.uniform1f(u.uThreshold, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, mask.fbo);
    gl.viewport(0, 0, mask.w, mask.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (s.occluders.length) {
      gl.useProgram(progQuad);
      useGeom(quadBuf);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.uniform1i(progQuad.u.uTex, 0);
      for (var oi = 0; oi < s.occluders.length; oi++) {
        var o = s.occluders[oi];
        gl.uniform4f(progQuad.u.uDst, o.dst[0], o.dst[1], o.dst[2], o.dst[3]);
        gl.uniform4f(progQuad.u.uSrc, o.src[0], o.src[1], o.src[2], o.src[3]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.BLEND);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    pass(rays, progRays);
    u = progRays.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mask.tex);
    gl.uniform1i(u.uMask, 0);
    gl.uniform2f(u.uLight, s.lightX, s.lightY);
    gl.uniform3fv(u.uLightCol, s.lightCol);
    gl.uniform2f(u.uRes, rays.w, rays.h);
    gl.uniform1f(u.uRayAmt, s.rayAmt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pass(null, progComp);
    u = progComp.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.uniform1i(u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, rays.tex);
    gl.uniform1i(u.uRays, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform3fv(u.uLightCol, s.lightCol);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform2f(u.uLight, s.lightX, s.lightY);
    gl.uniform1f(u.uExposure, s.exposure);
    gl.uniform1f(u.uAberration, s.aberration);
    gl.uniform1f(u.uGrain, s.grain);
    gl.uniform1f(u.uVignette, s.vignette);
    gl.uniform1f(u.uFlare, s.flare);
    gl.uniform1f(u.uMotion, s.motion);
    gl.uniform1f(u.uBloomAmt, s.bloom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function degrade() {
    if (steps >= 3) {
      return false;
    }
    steps++;
    lowQ = 1;
    console.warn("[sky] frames are slow — stepping quality down (" + steps + "/3).");
    scale = Math.max(0.18, scale * 0.68);
    allocate();
    return true;
  }
  function dispose() {
    [scene, blurA, blurB, rays, mask].forEach(function(t) {
      if (t) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
    });
    scene = blurA = blurB = rays = mask = null;
    gl.deleteTexture(atlasTex);
    gl.deleteBuffer(triBuf);
    gl.deleteBuffer(quadBuf);
    [progQuad, progScene, progBlur, progRays, progComp].forEach(function(p) {
      if (p) {
        gl.deleteProgram(p);
      }
    });
    var lose = gl.getExtension("WEBGL_lose_context");
    if (lose) {
      lose.loseContext();
    }
  }
  return {
    gl,
    resize,
    render,
    degrade,
    setAtlas,
    dispose,
    renderer,
    isSoftware: software
  };
}

// src/mount.js
var CLS = {
  canvas: "va-sky",
  ready: "va-ready",
  hasSun: "va-has-sun",
  noWebgl: "va-no-webgl",
  visible: "va-visible",
  settled: "va-settled"
};
var SELECTORS = {
  /* What blocks the light. Anything matching this gets rasterised into the
     occluder atlas, so keep it to display type — a whole article of body copy
     would be a large texture for a shadow nobody can read. */
  heading: ".va-heading",
  /* What carries a palette: data-c1/c2/c3, data-accent, data-exposure. */
  section: "[data-c1]",
  /* What fades in on scroll. The engine only toggles the class. */
  reveal: ".va-reveal",
  /* Text that is present for screen readers only, and must not stamp a
     shadow out in the corner where it is parked. */
  srOnly: ".sr-only",
  /* Optional. An element whose intro animation changes its own box, so the
     atlas has to be rebuilt once it settles. */
  hero: null
};
var CSS_VARS = ["--c1", "--c2", "--c3", "--accent", "--fringe"];
var rootUsers = /* @__PURE__ */ new WeakMap();
function claimRoot(el) {
  rootUsers.set(el, (rootUsers.get(el) || 0) + 1);
}
function releaseRoot(el) {
  var n = (rootUsers.get(el) || 1) - 1;
  if (n > 0) {
    rootUsers.set(el, n);
    return false;
  }
  rootUsers.delete(el);
  return true;
}
function isPlain(v) {
  return !!v && typeof v === "object" && !Array.isArray(v) && v.nodeType === void 0;
}
function assignDeep(target, src) {
  if (!isPlain(src)) {
    return target;
  }
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) {
      continue;
    }
    if (isPlain(src[k])) {
      if (!isPlain(target[k])) {
        target[k] = {};
      }
      assignDeep(target[k], src[k]);
    } else {
      target[k] = src[k];
    }
  }
  return target;
}
function cloneDeep(src) {
  var out = {};
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) {
      continue;
    }
    out[k] = isPlain(src[k]) ? cloneDeep(src[k]) : src[k];
  }
  return out;
}
function hexToRgb(hex) {
  var h = String(hex).trim().replace("#", "");
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}
function toLinear(c) {
  return c.map(function(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
}
function mix3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}
function cssRgb(c) {
  return Math.round(c[0] * 255) + " " + Math.round(c[1] * 255) + " " + Math.round(c[2] * 255);
}
function smoothstep(e0, e1, x) {
  var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function easeTo(cur, target, k, dt) {
  return cur + (target - cur) * (1 - Math.exp(-k * dt));
}
function clamp(v, lim) {
  return v < -lim ? -lim : v > lim ? lim : v;
}
function mount(options) {
  var opts = options || {};
  var cfg = assignDeep(cloneDeep(defaults_default), opts.config);
  var sel = assignDeep(assignDeep({}, SELECTORS), opts.selectors);
  var root = opts.root || document.documentElement;
  claimRoot(root);
  var madeCanvas = false;
  var canvas = null;
  if (opts.canvas && opts.canvas.nodeType === 1) {
    canvas = opts.canvas;
  } else if (typeof opts.canvas === "string") {
    canvas = document.querySelector(opts.canvas);
  } else {
    canvas = document.querySelector("." + CLS.canvas) || document.querySelector("#sky");
  }
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    madeCanvas = true;
  }
  canvas.classList.add(CLS.canvas);
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var listeners = [];
  function on(target, type, fn, o) {
    target.addEventListener(type, fn, o);
    listeners.push([target, type, fn, o]);
  }
  var scroller = opts.scroller || window;
  var scrollEl = scroller === window || scroller === document || scroller === document.documentElement ? null : scroller;
  function scrollTop() {
    return scrollEl ? scrollEl.scrollTop : window.pageYOffset;
  }
  function viewH() {
    return scrollEl ? scrollEl.clientHeight : window.innerHeight;
  }
  function maxScroll() {
    return scrollEl ? Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight) : Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  function chainTop(el) {
    var y = 0, n = el;
    while (n) {
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return y;
  }
  function offsetBox(el) {
    var x = 0, y = 0, n = el;
    while (n) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  }
  var originY = 0;
  var contentTop = 0;
  var canvasRect = { left: 0, top: 0, width: 1, height: 1 };
  var canvasFixed = false;
  function measureCanvas() {
    var r = canvas.getBoundingClientRect();
    canvasRect.left = r.left;
    canvasRect.top = r.top;
    canvasRect.width = Math.max(1, r.width);
    canvasRect.height = Math.max(1, r.height);
  }
  function liveGeom() {
    if (!canvasFixed) {
      measureCanvas();
    }
    contentTop = scrollEl ? scrollEl.getBoundingClientRect().top - scrollEl.scrollTop : -window.pageYOffset;
  }
  var stops = [];
  function readSections() {
    var els = [].slice.call(document.querySelectorAll(sel.section));
    stops = els.map(function(el) {
      var c1 = hexToRgb(el.dataset.c1);
      var c2 = hexToRgb(el.dataset.c2);
      var c3 = hexToRgb(el.dataset.c3);
      return {
        el,
        /* sRGB for CSS, linear for the shader — the same colours, twice. */
        c1,
        c2,
        c3,
        l1: toLinear(c1),
        l2: toLinear(c2),
        l3: toLinear(c3),
        accent: hexToRgb(el.dataset.accent || el.dataset.c1),
        exposure: parseFloat(el.dataset.exposure || "1"),
        top: 0,
        h: 1
      };
    });
  }
  function measure() {
    canvasFixed = getComputedStyle(canvas).position === "fixed";
    measureCanvas();
    originY = scrollEl ? chainTop(scrollEl) : 0;
    for (var i = 0; i < stops.length; i++) {
      var b = offsetBox(stops[i].el);
      stops[i].top = b.top - originY;
      stops[i].h = Math.max(1, b.height);
    }
  }
  function paletteAt(y) {
    if (!stops.length) {
      return null;
    }
    var probe = y + viewH() * 0.5;
    var i = 0;
    for (; i < stops.length - 1; i++) {
      if (probe < stops[i].top + stops[i].h) {
        break;
      }
    }
    var a = stops[i];
    var b = stops[Math.min(i + 1, stops.length - 1)];
    var p = (probe - a.top) / a.h;
    var t = smoothstep(0.5, 1, p);
    return {
      c1: mix3(a.c1, b.c1, t),
      c2: mix3(a.c2, b.c2, t),
      c3: mix3(a.c3, b.c3, t),
      l1: mix3(a.l1, b.l1, t),
      l2: mix3(a.l2, b.l2, t),
      l3: mix3(a.l3, b.l3, t),
      accent: mix3(a.accent, b.accent, t),
      exposure: a.exposure + (b.exposure - a.exposure) * t
    };
  }
  var atlasCanvas = null;
  var occluders = [];
  var atlasW = 1, atlasH = 1;
  var ATLAS_PAD = 14;
  function headings() {
    return [].slice.call(document.querySelectorAll(sel.heading));
  }
  function visibleText(el) {
    var out = [];
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n;
    while (n = walk.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) {
        continue;
      }
      var p = n.parentElement, hidden = false;
      while (p && p !== el) {
        if (sel.srOnly && p.matches && p.matches(sel.srOnly)) {
          hidden = true;
          break;
        }
        p = p.parentElement;
      }
      if (!hidden) {
        out.push(n);
      }
    }
    return out;
  }
  function drawHeading(ctx, el, ox, oy) {
    var cs = getComputedStyle(el);
    ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    var er = el.getBoundingClientRect();
    var nodes = visibleText(el);
    var range = document.createRange();
    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k];
      var text = node.nodeValue;
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (ch === " " || ch === "\n" || ch === "	") {
          continue;
        }
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        var r = range.getBoundingClientRect();
        if (r.width < 0.5 || r.height < 0.5) {
          continue;
        }
        var m = ctx.measureText(ch);
        var asc = m.fontBoundingBoxAscent;
        var desc = m.fontBoundingBoxDescent;
        if (!asc) {
          asc = r.height * 0.78;
          desc = r.height * 0.22;
        }
        var baseline = r.top - er.top + oy + asc + (r.height - (asc + desc)) / 2;
        ctx.fillText(ch, r.left - er.left + ox, baseline);
      }
    }
  }
  function buildAtlas() {
    if (!sky) {
      return;
    }
    var els = headings();
    if (!els.length) {
      occluders = [];
      return;
    }
    var boxes = els.map(offsetBox);
    var W = 0, H = 0;
    for (var i = 0; i < boxes.length; i++) {
      W = Math.max(W, Math.ceil(boxes[i].width) + ATLAS_PAD * 2);
      H += Math.ceil(boxes[i].height) + ATLAS_PAD * 2;
    }
    if (W < 2 || H < 2) {
      return;
    }
    if (!atlasCanvas) {
      atlasCanvas = document.createElement("canvas");
    }
    atlasCanvas.width = W;
    atlasCanvas.height = H;
    var ctx = atlasCanvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    occluders = [];
    var y = 0;
    for (var j = 0; j < els.length; j++) {
      var r = boxes[j];
      var bh = Math.ceil(r.height) + ATLAS_PAD * 2;
      var bw = Math.ceil(r.width) + ATLAS_PAD * 2;
      drawHeading(ctx, els[j], ATLAS_PAD, y + ATLAS_PAD);
      occluders.push({
        /* Where it sits in the atlas, and where it sits in scroll space. */
        ax: 0,
        ay: y,
        aw: bw,
        ah: bh,
        left: r.left - ATLAS_PAD,
        top: r.top - originY - ATLAS_PAD,
        w: bw,
        h: bh,
        src: [0, 0, 0, 0],
        dst: [0, 0, 0, 0]
      });
      y += bh;
    }
    atlasW = W;
    atlasH = H;
    sky.setAtlas(atlasCanvas);
  }
  function updateOccluders() {
    var live = [];
    var vw = canvasRect.width, vh = canvasRect.height;
    for (var i = 0; i < occluders.length; i++) {
      var o = occluders[i];
      var top = contentTop + o.top - canvasRect.top;
      if (top > vh || top + o.h < 0) {
        continue;
      }
      var left = o.left - canvasRect.left;
      o.dst[0] = left / vw * 2 - 1;
      o.dst[1] = 1 - (top + o.h) / vh * 2;
      o.dst[2] = o.w / vw * 2;
      o.dst[3] = o.h / vh * 2;
      o.src[0] = o.ax / atlasW;
      o.src[1] = 1 - (o.ay + o.ah) / atlasH;
      o.src[2] = o.aw / atlasW;
      o.src[3] = o.ah / atlasH;
      live.push(o);
    }
    st.occluders = live;
  }
  var LIGHT_TL, LIGHT_TR, LIGHT_BL, LIGHT_BR;
  function deriveLight() {
    LIGHT_TL = toLinear(hexToRgb(cfg.light.topLeft));
    LIGHT_TR = toLinear(hexToRgb(cfg.light.topRight));
    LIGHT_BL = toLinear(hexToRgb(cfg.light.bottomLeft));
    LIGHT_BR = toLinear(hexToRgb(cfg.light.bottomRight));
  }
  deriveLight();
  var st = {
    time: 0,
    lightX: 0.5,
    lightY: 0.62,
    lightCol: [1, 1, 1],
    scroll: 0,
    c1: [0, 0, 0],
    c2: [0, 0, 0],
    c3: [0, 0, 0],
    exposure: 1,
    aberration: 0.35,
    grain: 0.055,
    vignette: 0.58,
    flare: 0.6,
    motion: 0,
    bloom: cfg.camera.bloom,
    rayAmt: 1,
    flowX: 0,
    flowY: 0,
    swirl: 0,
    occluders: [],
    drift: reduced ? 0 : 1
  };
  var targetX = 0.5, targetY = 0.62;
  var lastPx = 0.5, lastPy = 0.62;
  var vel = 0, velTarget = 0;
  var pal = null;
  var wroteFringe = -999;
  var wroteCss = null;
  function writeCss(p) {
    if (wroteCss) {
      var d = 0;
      for (var i = 0; i < 3; i++) {
        d = Math.max(
          d,
          Math.abs(p.accent[i] - wroteCss.accent[i]),
          Math.abs(p.c1[i] - wroteCss.c1[i]),
          Math.abs(p.c2[i] - wroteCss.c2[i]),
          Math.abs(p.c3[i] - wroteCss.c3[i])
        );
      }
      if (d < 6e-3) {
        return;
      }
    }
    wroteCss = p;
    root.style.setProperty("--accent", cssRgb(p.accent));
    root.style.setProperty("--c1", cssRgb(p.c1));
    root.style.setProperty("--c2", cssRgb(p.c2));
    root.style.setProperty("--c3", cssRgb(p.c3));
  }
  var stirVX = 0, stirVY = 0, stirVA = 0;
  var stirX = 0, stirY = 0, stirA = 0;
  if (hasHover && !reduced) {
    on(window, "pointermove", function(e) {
      var nx = (e.clientX - canvasRect.left) / canvasRect.width;
      var ny = (e.clientY - canvasRect.top) / canvasRect.height;
      var dx = nx - lastPx;
      var dy = ny - lastPy;
      velTarget = Math.min(1, Math.hypot(dx, dy) * 26);
      stirVX += dx * cfg.stir.pushGain;
      stirVY -= dy * cfg.stir.pushGain;
      stirVA += dx * cfg.stir.swirlGain;
      lastPx = nx;
      lastPy = ny;
      targetX = nx;
      targetY = 1 - ny;
    }, { passive: true });
  }
  var resizeTimer = 0;
  on(window, "resize", function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (destroyed) {
        return;
      }
      measure();
      if (sky) {
        sky.resize(canvasRect.width, canvasRect.height);
      }
      buildAtlas();
      if (reduced || !sky) {
        requestAnimationFrame(function() {
          frame(0);
        });
      }
    }, 120);
  }, { passive: true });
  var atlasQueued = false;
  function scheduleAtlas() {
    if (atlasQueued || destroyed) {
      return;
    }
    atlasQueued = true;
    requestAnimationFrame(function() {
      atlasQueued = false;
      if (!destroyed) {
        buildAtlas();
      }
    });
  }
  function remeasure() {
    if (destroyed) {
      return;
    }
    readSections();
    measure();
    scheduleAtlas();
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure);
  }
  on(window, "load", remeasure);
  var settleTimer = 0;
  var heroEl = sel.hero ? document.querySelector(sel.hero) : null;
  if (heroEl) {
    var settled = false;
    var settle = function() {
      if (settled) {
        return;
      }
      settled = true;
      heroEl.classList.add(CLS.settled);
      remeasure();
    };
    on(heroEl, "animationend", settle);
    settleTimer = setTimeout(settle, 3e3);
  }
  var io = null;
  var revealables = [].slice.call(document.querySelectorAll(sel.reveal));
  if (reduced || !("IntersectionObserver" in window)) {
    revealables.forEach(function(el) {
      el.classList.add(CLS.visible);
    });
  } else {
    io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add(CLS.visible);
          io.unobserve(entry.target);
        }
      });
    }, { root: scrollEl || null, rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    revealables.forEach(function(el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.classList.add(CLS.visible);
      } else {
        io.observe(el);
      }
    });
  }
  var sky = null;
  var destroyed = false;
  var running = true;
  var rafId = 0;
  function startSky() {
    sky = create(canvas, cfg);
    if (!sky) {
      root.classList.add(CLS.noWebgl);
      console.warn("[sky] WebGL unavailable — falling back to the CSS backdrop.");
      return;
    }
    root.classList.remove(CLS.noWebgl);
    sky.resize(canvasRect.width, canvasRect.height);
  }
  readSections();
  measure();
  liveGeom();
  startSky();
  on(canvas, "webglcontextlost", function(e) {
    e.preventDefault();
    running = false;
    root.classList.add(CLS.noWebgl);
    root.classList.remove(CLS.hasSun);
  });
  pal = paletteAt(scrollTop());
  if (pal) {
    st.c1 = pal.l1.slice();
    st.c2 = pal.l2.slice();
    st.c3 = pal.l3.slice();
    st.exposure = pal.exposure;
  }
  root.classList.add(CLS.ready);
  if (sky && hasHover && !reduced) {
    root.classList.add(CLS.hasSun);
  }
  buildAtlas();
  var last = 0;
  var samples = [];
  var watching = true;
  function frame(now) {
    if (destroyed) {
      return;
    }
    var raw = last ? (now - last) / 1e3 : 0.016;
    var dt = Math.max(0, Math.min(raw, 0.05));
    last = now;
    if (!reduced) {
      st.time += dt;
    }
    liveGeom();
    var y = scrollTop();
    if (!hasHover && !reduced) {
      targetX = 0.5 + 0.3 * Math.sin(st.time * 0.11);
      targetY = 0.62 + 0.18 * Math.cos(st.time * 0.083);
    }
    var sp = Math.min(1, Math.max(0, y / maxScroll()));
    st.scroll = easeTo(st.scroll, sp, cfg.ease.scroll, dt);
    st.lightX = easeTo(st.lightX, targetX, cfg.ease.light, dt);
    st.lightY = easeTo(st.lightY, targetY, cfg.ease.light, dt);
    velTarget *= Math.pow(0.02, dt);
    vel = easeTo(vel, velTarget, 12, dt);
    st.motion = easeTo(st.motion, Math.min(1, velTarget * 1.6), cfg.camera.motionEase, dt);
    stirX = clamp(stirX + stirVX * dt, cfg.stir.pushLimit);
    stirY = clamp(stirY + stirVY * dt, cfg.stir.pushLimit);
    stirA = clamp(stirA + stirVA * dt, cfg.stir.swirlLimit);
    var bleed = Math.pow(cfg.stir.decay, dt);
    stirVX *= bleed;
    stirVY *= bleed;
    stirVA *= bleed;
    st.flowX = stirX;
    st.flowY = stirY;
    st.swirl = stirA;
    var top = mix3(LIGHT_TL, LIGHT_TR, st.lightX);
    var bot = mix3(LIGHT_BL, LIGHT_BR, st.lightX);
    st.lightCol = mix3(bot, top, st.lightY);
    st.rayAmt = 1 - 0.5 * smoothstep(0, 0.22, st.scroll);
    updateOccluders();
    var p = paletteAt(y);
    if (p) {
      var kc = 1 - Math.exp(-cfg.ease.palette * dt);
      st.c1 = mix3(st.c1, p.l1, kc);
      st.c2 = mix3(st.c2, p.l2, kc);
      st.c3 = mix3(st.c3, p.l3, kc);
      var k = p.exposure < st.exposure ? cfg.ease.exposureDown : cfg.ease.exposureUp;
      st.exposure = easeTo(st.exposure, p.exposure, k, dt);
      writeCss(p);
    }
    var offAxis = Math.hypot(st.lightX - 0.5, st.lightY - 0.5) * 2;
    st.aberration = cfg.camera.aberrationBase + offAxis * cfg.camera.aberrationEdge + vel * cfg.camera.aberrationVel;
    st.flare = cfg.camera.flareBase + vel * cfg.camera.flareVel;
    st.vignette = cfg.camera.vignetteBase + st.scroll * cfg.camera.vignetteScroll;
    st.grain = cfg.camera.grainBase + (1 - Math.min(1, st.exposure)) * 0.05;
    st.bloom = cfg.camera.bloom;
    var fringe = (st.lightX - 0.5) * (cfg.camera.fringePx + vel * 5) * (0.4 + offAxis * 0.8);
    if (Math.abs(fringe - wroteFringe) > 0.12) {
      wroteFringe = fringe;
      root.style.setProperty("--fringe", fringe.toFixed(2));
    }
    if (sky) {
      sky.render(st);
      if (watching && st.time > cfg.quality.warmupSeconds && raw < 0.2) {
        samples.push(raw);
        if (samples.length >= 32) {
          var sum = 0;
          for (var i = 4; i < samples.length; i++) {
            sum += samples[i];
          }
          var mean = sum / (samples.length - 4);
          samples.length = 0;
          if (mean > cfg.quality.slowFrameMs / 1e3) {
            if (!sky.degrade()) {
              watching = false;
              sky.dispose();
              sky = null;
              root.classList.add(CLS.noWebgl);
              root.classList.remove(CLS.hasSun);
              console.warn("[sky] GPU cannot sustain the shader — using the CSS backdrop.");
            }
          } else if (mean < 0.02) {
            watching = false;
          }
        }
      }
    }
    if (running && !reduced) {
      rafId = requestAnimationFrame(frame);
    }
  }
  if (reduced) {
    rafId = requestAnimationFrame(frame);
    var queued = false;
    on(scroller, "scroll", function() {
      if (queued) {
        return;
      }
      queued = true;
      rafId = requestAnimationFrame(function(t) {
        queued = false;
        frame(t);
      });
    }, { passive: true });
  } else {
    rafId = requestAnimationFrame(frame);
  }
  function setConfig(partial) {
    if (destroyed) {
      return cfg;
    }
    var rebuild = !!(partial && (partial.glsl || partial.glslInt || partial.quality));
    assignDeep(cfg, partial);
    deriveLight();
    if (rebuild && sky) {
      sky.dispose();
      sky = null;
      startSky();
      if (sky) {
        buildAtlas();
      }
    }
    return cfg;
  }
  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    clearTimeout(resizeTimer);
    clearTimeout(settleTimer);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
    }
    listeners.length = 0;
    if (io) {
      io.disconnect();
      io = null;
    }
    if (sky) {
      sky.dispose();
      sky = null;
    }
    if (releaseRoot(root)) {
      root.classList.remove(CLS.ready, CLS.hasSun, CLS.noWebgl);
      for (var v = 0; v < CSS_VARS.length; v++) {
        root.style.removeProperty(CSS_VARS[v]);
      }
    }
    if (madeCanvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    } else {
      canvas.classList.remove(CLS.canvas);
    }
    atlasCanvas = null;
    occluders = [];
    stops = [];
  }
  return {
    config: cfg,
    canvas,
    remeasure,
    setConfig,
    destroy,
    /* Null whenever there is no WebGL — at startup, after a context loss, or
       after the quality ladder gave up. */
    get sky() {
      return sky;
    }
  };
}

// src/index.js
var self = typeof document !== "undefined" ? document.currentScript : null;
if (self && self.hasAttribute("data-auto")) {
  boot = function() {
    mount({ canvas: self.getAttribute("data-canvas") || void 0 });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
var boot;
export {
  defaults_default as defaults,
  mount
};
