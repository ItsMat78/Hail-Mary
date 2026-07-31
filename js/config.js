/* VAST ARRAY — every number worth touching, in one place.
   Edit a value, save, reload. Nothing here needs a build step.

   The `glsl` and `glslInt` blocks are compiled into the shaders as #defines at
   startup, so those take a reload. Everything else is read live by the
   animation loop, so it takes effect on the next frame.

   Colours that belong to the page rather than the sky (section palettes,
   type, borders) live elsewhere: per-section colours are data-c1/c2/c3 and
   data-accent attributes on each <section> in index.html, and the base tokens
   are custom properties at the top of css/style.css. */

window.VA_CONFIG = {

  /* ------------------------------------------------------------ the star */
  /* The sun under the cursor takes its colour from these four, blended by
     where the pointer is, so a sweep across the page runs it through all of
     them. This is also how real stars work: colour is temperature. */
  light: {
    topLeft:     '#4C7BFF',   // colour when the pointer is at the top left
    topRight:    '#35E0B0',   // colour when the pointer is at the top right
    bottomLeft:  '#FF3B4E',   // colour when the pointer is at the bottom left
    bottomRight: '#FF5BC8'    // colour when the pointer is at the bottom right
  },

  /* -------------------------------------------------------------- the sky */
  /* Compiled into the shaders as float #defines. Reload to apply. */
  glsl: {
    /* Nebula. CUT is the single most useful dial in this file: it is the noise
       value below which there is no cloud at all. */
    NEB_CUT:       0.44,   // raise for more black and tighter wisps, lower to fill the frame
    NEB_GAIN:      1.45,   // contrast applied above the cut; higher = harder edges
    NEB_POW:       2.30,   // higher = wispier edges and a softer falloff into black
    NEB_BRIGHT:    2.30,   // overall cloud brightness
    NEB_SCALE:     3.30,   // higher = smaller, busier cloud structures

    /* The hot cores inside the cloud. These are what the bloom pass picks up,
       so they set how much the sky glows rather than just how bright it is. */
    CORE_CUT:      0.66,   // noise value above which a core forms; raise for rarer, hotter cores
    CORE_BRIGHT:   2.90,   // how fiercely those cores burn

    STAR_BRIGHT:   1.55,   // the background starfield
    BOKEH_BRIGHT:  0.30,   // the out-of-focus hexagons on the nearest layer

    /* The motes falling down-right through the beam. */
    DUST_SPARSITY: 0.80,   // 0..1, higher means fewer of them
    DUST_SPEED:    2.00,   // how fast they fall
    DUST_BRIGHT:   1.30,   // how brightly they catch the light

    /* The dark planetary limb across the lower left. */
    RIDGE_H:       0.360,  // its height, as a fraction of the viewport
    RIDGE_DROP:    0.46,   // how far it sinks out of frame at mid-scroll
    RIM_BRIGHT:    1.70,   // the hot amber edge along its crest

    /* The sun itself: a photosphere with convection granulation, limb
       darkening, a chromosphere at the edge, a corona, and lens spikes. */
    SUN_RADIUS:    0.003,  // its size, as a fraction of viewport height
    SUN_BRIGHT:    0.55,   // the photosphere; push much past this and the disc clips flat
    SUN_GRAIN:     0.70,   // convection mottling across its face, 0 = smooth disc
    SUN_CORONA:    0.16,   // the halo around it
    SUN_SPIKES:    0.12,   // the six-point diffraction spikes a lens gives a point source

    /* Volumetric light. The headings block this, which is where the shafts
       and the shadows behind the type come from. */
    RAY_FALL:      0.35,   // brightness of the broad glow
    RAY_CORE:      1.20,   // brightness of the tight core near the sun
    RAY_REACH:     25.0,   // higher keeps light local, lower lets it flood wider
    RAY_DECAY:     0.962,  // 0..1 per-step falloff along a shaft; lower = shorter shafts

    /* Lens artefacts, added in the composite pass. */
    GHOST_AMT:     0.26,   // the ring ghosts opposite the sun through frame centre
    STREAK_AMT:    1.50,   // the horizontal anamorphic streak
    STREAK_MOTION: 1.25    // how strongly movement alone draws that streak; 0 = only over bright areas
  },

  /* Compiled as integer #defines. Kept apart from the block above because a
     GLSL loop bound has to be a constant int, and 32.000000 will not compile. */
  glslInt: {
    RAY_STEPS: 32          // samples along each shaft; fewer is cheaper but slightly banded
  },

  /* --------------------------------------------------------- the stirring */
  /* Pointer movement pushes and rotates the whole cloud field. The offset is
     integrated and kept, so the smoke stays where you leave it; only the
     velocity decays, which is what makes it coast to a stop instead of
     springing back to where it started. */
  stir: {
    pushGain:   0.60,      // how far a full-width sweep displaces the clouds
    swirlGain:  1.30,      // how much that same sweep rotates them
    decay:      0.030,     // fraction of velocity left after one second; lower = shorter coast
    pushLimit:  2.50,      // cap on total displacement, which keeps noise precision sane
    swirlLimit: 1.50       // cap on total rotation, in radians
  },

  /* ------------------------------------------------------------- easing */
  /* Exponential rates in units of 1/second. Larger = snappier. These are
     frame-rate independent, so they feel the same at 60Hz and 144Hz. */
  ease: {
    light:        6.5,     // how quickly the sun catches up to the pointer
    scroll:       8.0,     // how quickly scroll progress follows the real scroll
    palette:      3.2,     // how quickly section colours crossfade
    exposureDown: 7.5,     // an iris stops down fast...
    exposureUp:   1.5      // ...and opens back up slowly. The asymmetry is the point.
  },

  /* ------------------------------------------------------------- camera */
  camera: {
    bloom:          0.95,   // how much of the blurred bright pass is added back
    aberrationBase: 0.0035, // colour fringing at frame centre
    aberrationEdge: 0.0060, // extra fringing out toward the corners
    aberrationVel:  0.022,  // extra fringing while the pointer is moving
    flareBase:      0.50,   // baseline strength of streak and ghosts
    flareVel:       0.45,   // extra flare while the pointer is moving
    motionEase:     7.0,    // how fast the movement streak builds and fades away
    vignetteBase:   0.54,   // corner darkening at the top of the page
    vignetteScroll: 0.14,   // extra corner darkening by the bottom of the page
    grainBase:      0.00,  // sensor noise; it is weighted toward the shadows
    fringePx:       3.0     // colour fringing on the type itself, in pixels
  },

  /* ------------------------------------------------------------ quality */
  /* If it runs badly, lower these in order: renderScale, then maxDpr, then
     glslInt.RAY_STEPS. The page also steps itself down and logs when it does. */
  quality: {
    renderScale:   0.9,   // sky buffer size relative to the screen
    maxDpr:        1.5,    // ceiling on that buffer's pixel ratio. The nebula is soft, so
                           // rendering above ~1x CSS pixels buys nothing on a hidpi screen
    displayDpr:    1.5,    // ceiling on the final composite's pixel ratio
    warmupSeconds: 2.5,    // how long to ignore frame times after load. Startup is always
                           // janky — fonts, first shader compile, texture uploads — and
                           // judging the GPU on that demotes a perfectly capable machine
    slowFrameMs:   30      // mean frame time above which quality steps down
  }
};
