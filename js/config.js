/* VAST ARRAY — every number worth touching, in one place.
   Edit a value, save, reload. Nothing here needs a build step.

   The `glsl` block is compiled into the shaders as #defines at startup, so
   those take a reload. Everything else is read live by the animation loop.

   Colours that belong to the page rather than the sky (section palettes,
   type, borders) live elsewhere: per-section colours are data-c1/c2/c3 and
   data-accent attributes on each <section> in index.html, and the base tokens
   are custom properties at the top of css/style.css. */

window.VA_CONFIG = {

  /* The moving light's own colour, blended across the viewport by pointer
     position, so a sweep runs it through all four. */
  light: {
    topLeft:     '#4C7BFF',   // blue
    topRight:    '#35E0B0',   // green
    bottomLeft:  '#FF3B4E',   // red
    bottomRight: '#FF5BC8'    // pink
  },

  /* ------------------------------------------------------------ the sky */
  /* Compiled into the shaders. Reload to apply. */
  glsl: {
    /* Nebula. CUT is the single most useful dial: it is the noise value
       below which there is no cloud at all, so raising it gives you more
       black and tighter wisps, lowering it fills the frame with smoke. */
    NEB_CUT:      0.44,
    NEB_GAIN:     2.45,   // contrast above the cut
    NEB_POW:      2.30,   // higher = wispier edges, softer falloff
    NEB_BRIGHT:   2.30,
    NEB_SCALE:    2.30,   // higher = smaller, busier cloud structures

    /* The hot centres. These are what the bloom pass picks up. */
    CORE_CUT:     0.66,
    CORE_BRIGHT:  2.90,

    STAR_BRIGHT:  1.55,
    BOKEH_BRIGHT: 0.30,   // the out-of-focus hexagons

    /* Falling motes. SPARSITY is 0..1 — higher means fewer of them. */
    DUST_SPARSITY: 0.80,
    DUST_SPEED:    1.00,
    DUST_BRIGHT:   1.30,

    RIDGE_H:      0.360,  // height of the dark mass at the lower left
    RIDGE_DROP:   0.46,   // how far it sinks out of frame mid-scroll
    RIM_BRIGHT:   1.70,   // the hot amber edge along its crest
    BEAM_BRIGHT:  0.30,   // small hot core at the pointer

    /* Volumetric light. The wordmark blocks this, so REACH controls how far
       the shafts throw and FALL/CORE control how bright they are. */
    RAY_FALL:     1.05,
    RAY_CORE:     1.35,
    RAY_REACH:   15.00,   // higher = light stays local, lower = floods wider
    RAY_DECAY:    0.962,  // per-step falloff along a shaft, 0..1

    /* Lens artefacts in the composite pass. */
    GHOST_AMT:    0.42,
    STREAK_AMT:   1.50,
    STREAK_MOTION: 1.25   // how strongly moving the pointer alone draws the streak
  },

  /* Integer defines, kept separate because GLSL loop bounds must be ints. */
  glslInt: {
    RAY_STEPS: 32   // samples along each shaft. Fewer = cheaper, slightly banded.
  },

  /* --------------------------------------------------------- the stirring */
  /* Pointer movement pushes and rotates the whole cloud field. The offset is
     integrated and kept, so the smoke stays where you leave it; only the
     velocity decays, which is what makes it coast to a stop instead of
     springing back. */
  stir: {
    pushGain:   0.60,   // how hard a sweep displaces the clouds
    swirlGain:  1.30,   // how much a sweep rotates them
    decay:      0.030,  // velocity left after one second — lower = shorter coast
    pushLimit:  2.50,   // total travel cap, keeps noise precision sane
    swirlLimit: 1.50    // total rotation cap, in radians
  },

  /* ------------------------------------------------------------- easing */
  /* Larger = snappier. These are exponential rates, in units of 1/second. */
  ease: {
    light:       6.5,
    scroll:      8.0,
    palette:     3.2,
    exposureDown: 7.5,  // an iris stops down fast...
    exposureUp:   1.5   // ...and opens back up slowly
  },

  /* ------------------------------------------------------------- camera */
  camera: {
    bloom:          0.95,
    aberrationBase: 0.0035,
    aberrationEdge: 0.0060,  // extra fringing out toward the corners
    aberrationVel:  0.022,   // extra while the pointer is moving
    flareBase:      0.50,
    flareVel:       0.75,
    motionEase:     7.0,     // how fast the movement streak builds and fades
    vignetteBase:   0.54,
    vignetteScroll: 0.14,
    grainBase:      0.050,
    fringePx:       3.0      // colour fringing on the type, in pixels
  },

  /* ------------------------------------------------------------ quality */
  quality: {
    renderScale: 0.72,  // sky buffer vs screen. Lower if your GPU struggles.
    /* Scene buffer ceiling. The nebula is soft, so rendering it above about
       1x CSS pixels buys nothing and costs a lot on a hidpi screen. */
    maxDpr:      1.5,
    displayDpr:  1.5,   // composite resolution cap
    /* Startup is always janky — fonts, first compile, texture uploads. Do not
       judge the GPU until it has settled, or a capable machine gets demoted. */
    warmupSeconds: 2.5,
    slowFrameMs:  30
  }
};
