# VAST ARRAY

A one-page astronomy site in the visual language of the *Project Hail Mary* poster.
Open `index.html` — no server, no build step, no dependencies.

```
index.html               the page: hero, four plates, horizon footer
css/font.css             Hail Mary Sans, embedded as a data URI
css/style.css            type, layout, and the glow/fringing on the type
js/config.js             ← every number worth changing lives here
js/shaders.js            GLSL: scene / blur / mask / rays / composite
js/sky.js                WebGL renderer — 5 programs, 5 framebuffers
js/main.js               pointer + scroll state, easing, palette, reveals
Hail_Mary_Sans_v2.otf    font source; css/font.css is generated from it
```

## Changing how it looks

There are three places, depending on what you want to change.

### 1. The sky and the motion — `js/config.js`

Everything about the nebula, the light, the dust, the ridge and the camera.
Edit a value, save, reload. Each entry has a comment saying what it does.

The dials worth knowing first:

| Want to change | Set |
|---|---|
| More black / less smoke | `glsl.NEB_CUT` up (try `0.50`) |
| Bigger, softer cloud shapes | `glsl.NEB_SCALE` down (try `1.6`) |
| Brighter nebula | `glsl.NEB_BRIGHT` |
| The light's four colours | `light.topLeft` / `topRight` / `bottomLeft` / `bottomRight` |
| Size of the sun | `glsl.SUN_RADIUS` (fraction of viewport height) |
| Sun brightness / halo / spikes | `glsl.SUN_BRIGHT`, `SUN_CORONA`, `SUN_SPIKES` |
| Mottling on the sun's face | `glsl.SUN_GRAIN` (0 = smooth disc) |
| Light shafts reach further | `glsl.RAY_REACH` down (try `10`) |
| Stronger / weaker shafts | `glsl.RAY_FALL`, `glsl.RAY_CORE` |
| Streak on mouse movement | `glsl.STREAK_MOTION` (0 = only over bright areas) |
| How fast that streak fades | `camera.motionEase` |
| More or fewer falling motes | `glsl.DUST_SPARSITY` (higher = fewer) |
| Size of the dark ridge | `glsl.RIDGE_H` |
| How hard the mouse stirs the smoke | `stir.pushGain`, `stir.swirlGain` |
| How long the stir coasts | `stir.decay` (lower = stops sooner) |
| Grain, vignette, bloom, fringing | the `camera` block |
| Snappier or lazier reactions | the `ease` block (bigger = snappier) |

Anything under `glsl` is compiled into the shaders as a `#define` at startup,
so it needs a reload. The rest is read live by the animation loop.

If it runs badly, lower `quality.renderScale` (0.72 → 0.5), then `quality.maxDpr`,
then `glslInt.RAY_STEPS` (32 → 24). It logs to the console when it steps itself down.

### 2. Section colours — `index.html`

Each `<section>` carries its own palette, which the page crossfades between as
you scroll:

```html
<section class="plate"
         data-c1="#E03A5E"      <!-- the left-hand cloud mass  -->
         data-c2="#FF7A4D"      <!-- the low / rim-light mass   -->
         data-c3="#8E3BD6"      <!-- the right-hand cloud mass  -->
         data-accent="#FF6A86"  <!-- rules, borders, headings   -->
         data-exposure="0.92">  <!-- 1 = normal, <1 stops down  -->
```

`data-exposure` is the auto-iris. Values below 1 darken the whole frame when
that section is in view, and the recovery is deliberately slower than the
stop-down, which is what makes it read as a camera.

### 3. Type, spacing, layout — `css/style.css`

Base tokens are the custom properties at the top of `:root`.

The display face is **Hail Mary Sans**, whose capital **A** is already drawn as
a hollow triangle — the headings are plain text, with no SVG substitution. It
is embedded in `css/font.css` as a data URI rather than linked, because Chrome
refuses a font fetched from a `file://` page. If you replace the `.otf`,
regenerate that file.

Note the face advances about **1.4em per character**, which is very wide. Every
display size in the stylesheet is fitted to that; if you swap the font, expect
to refit the `clamp()` values on `.wordmark`, `.head`, `.eyebrow`,
`.card__figure` and `.foot__mark`.

## How the pieces work

**The cursor is a star.** Not a filter over the page — an actual light source
drawn into the scene, with a granulated photosphere, limb darkening, a
chromosphere at the edge, a corona, and the diffraction spikes a lens gives any
point source. Its colour is its temperature, which is how stellar colour really
works. It sets the colour split in the nebula, the hot spot on the ridge, the
anamorphic streak, the lens ghosts, and the amount of chromatic fringing —
which grows off-axis and with speed, like real glass.

It is drawn before the horizon, so it can set behind the ridge, and the
headings sit above the canvas, so it passes behind the type. The native cursor
is hidden while it is on screen — but only then: with no WebGL, no fine
pointer, or reduced motion there is nothing standing in for it, and taking the
arrow away would just leave the page feeling broken.

**Headings are opaque.** Every heading — the wordmark and all four plate
headings — is rasterised once into a single atlas texture. Each frame the
renderer stamps whichever ones are on screen into a viewport-space mask, and
the ray pass marches each pixel back toward the light through that mask. Light
fills what it can reach and stops behind the letters, and the hollow **A**
lets light through its middle because the glyph really is hollow.

Rasterising once and blitting per frame is what keeps this free while
scrolling — nothing is redrawn or re-uploaded as the page moves. The atlas is
rebuilt only on resize, on font load, and when the hero's intro animation ends
(it scales the type, so its box is wrong until then). Character positions come
from `Range` rectangles, so letter-spacing, wrapping and centring are taken
from the layout the browser already did rather than re-derived.

**The stir is integrated, not eased.** Pointer movement pushes a velocity; the
loop integrates that into a displacement that is kept. Only the velocity
decays, so the clouds coast to a stop and stay put rather than springing back.

**Scrolling is a camera move.** The sky is fixed and the plates plate over it,
the palette crossfades, the iris adjusts, and the horizon sinks out of frame as
you climb and returns at the end.

## Fallbacks

No WebGL → a CSS gradient sky with the same scroll-driven palette.
`prefers-reduced-motion` → one static frame, no drift, no reveal animations.
If frames stay slow after a warm-up period, quality steps down up to three
times, then falls back to the CSS sky.
