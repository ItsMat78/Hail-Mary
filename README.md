# VAST ARRAY

A WebGL sky that takes its light from the cursor, and headings that cast real
shadows into it. In the visual language of the *Project Hail Mary* poster.

Open `index.html` — no server, no build step, no dependencies.

## Two ways in

**Drop-in.** One script, one stylesheet, no JS of your own:

```html
<link rel="stylesheet" href="css/vast-array.css">
<script src="dist/vast-array.js" data-auto></script>
```

`data-auto` mounts on `DOMContentLoaded`, finds a canvas or makes one, and
uses the default selectors below. Add `data-canvas="#id"` to aim it somewhere
specific.

**Everything else.** Call `mount()` and keep the handle:

```js
import { mount } from 'vast-array';          // or window.VastArray.mount

const sky = mount({
  canvas: '#sky',
  selectors: { heading: '.wordmark, .head', section: '.plate' },
  config: { glsl: { NEB_CUT: 0.50 } }
});
```

## The contract

Six things connect the engine to your markup. Four are selectors you can
change; two are written by the engine and consumed by your CSS.

| Option | Default | What it means |
|---|---|---|
| `selectors.heading` | `.va-heading` | What blocks the light. Keep it to display type — a whole article would be a large texture for a shadow nobody can read. |
| `selectors.section` | `[data-c1]` | What carries a palette. Read in document order. |
| `selectors.reveal` | `.va-reveal` | What fades in on scroll. The engine only toggles the class; the styling is yours. |
| `selectors.srOnly` | `.sr-only` | Screen-reader-only text, skipped so it does not stamp a shadow off in the corner where it is parked. |
| `selectors.hero` | `null` | Optional. An element whose intro animation changes its own box, so the atlas is rebuilt once it settles. |

Each section carries its own palette, which the page crossfades between as you
scroll:

```html
<section data-c1="#E03A5E"      <!-- the left-hand cloud mass  -->
         data-c2="#FF7A4D"      <!-- the low / rim-light mass   -->
         data-c3="#8E3BD6"      <!-- the right-hand cloud mass  -->
         data-accent="#FF6A86"  <!-- rules, borders, headings   -->
         data-exposure="0.92">  <!-- 1 = normal, <1 stops down  -->
```

`data-exposure` is the auto-iris. Values below 1 darken the whole frame when
that section is in view, and the recovery is deliberately slower than the
stop-down, which is what makes it read as a camera.

**Written to `root`** (default `<html>`) for your CSS to use:

`--c1` `--c2` `--c3` `--accent` as space-separated sRGB channels, so
`rgb(var(--accent) / 0.4)`; `--fringe` as a signed pixel offset for chromatic
fringing on type. Classes: `va-ready`, `va-has-sun`, `va-no-webgl` on the root,
`va-visible` on each reveal, `va-settled` on the hero once its intro ends.

Scope any `opacity: 0` reveal styling to `.va-ready`, or a page whose script
failed is a page of invisible text.

## mount(options)

| Option | Default | |
|---|---|---|
| `canvas` | first `.va-sky`, then `#sky`, else one is created | element or selector |
| `config` | see below | deep-merged over the defaults; name only what you change |
| `selectors` | table above | |
| `scroller` | `window` | an element instead, if your content scrolls in a container |
| `root` | `<html>` | where classes and custom properties are written |

Returns:

| | |
|---|---|
| `remeasure()` | re-read section boxes and rebuild the occluder atlas |
| `setConfig(partial)` | merge new numbers in. `glsl`, `glslInt` and `quality` rebuild the renderer; everything else lands on the next frame |
| `destroy()` | remove every listener, release the GL context, put the DOM back |
| `config` | the live merged config |
| `sky` | the renderer, or `null` when there is no WebGL |

**`remeasure()` is the one you will need.** The atlas is rasterised once and
rebuilt only on resize, on font load, and when the hero settles. Anything else
that moves a heading — a route change, an accordion, a lazily loaded image
above the fold — has to say so, or the light keeps stopping where the text used
to be.

## Changing how it looks

### The sky and the motion — `src/defaults.js`

Every number, annotated, in one file. Pass a subset as `config` to override.
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

Anything under `glsl` is compiled into the shaders as a `#define`, so changing
it through `setConfig` rebuilds the programs. The rest is read live.

If it runs badly, lower `quality.renderScale` (0.9 → 0.5), then
`quality.maxDpr`, then `glslInt.RAY_STEPS` (32 → 24). It logs to the console
when it steps itself down.

### Type and layout

`css/vast-array.css` is the engine stylesheet and has to ship alongside the
script. `css/demo.css` is this page and does not.

## Putting it on an existing site

### Getting the code in

**Copy two files.** No npm, works anywhere:

```
dist/vast-array.min.js  →  your-repo/static/vendor/
css/vast-array.css      →  your-repo/static/vendor/
```

**Install from git.** `private: true` blocks `npm publish`, not this:

```bash
npm i github:ItsMat78/Hail-Mary#packaging
```

`dist/` is committed, so there is no build step on the consumer's side. Pin a
tag rather than a branch once there is one to pin.

**Local path**, while both sides are still moving:

```bash
npm i ../HailMary     # symlinks; edits show up without reinstalling
```

Only `dist/`, `css/vast-array.css`, `src/` and this README are packed. The
demo page, `demo.css` and the font stay behind.

### Wiring it up

**1. The stylesheet, and transparent backgrounds.** This is the step that
actually breaks people:

```html
<link rel="stylesheet" href="/vendor/vast-array.css">
```

```css
/* the canvas sits at z-index -3; anything opaque above it hides the sky */
body, #app, .layout { background: transparent; }
```

If your site has a background colour it has to move onto a specific element
rather than `body`. Set `--va-void` to whatever that base colour was — it is
what the no-WebGL fallback paints.

**2. A canvas** — or let it make one:

```html
<canvas id="sky" aria-hidden="true"></canvas>
<script src="/vendor/vast-array.min.js"></script>
<script>
  VastArray.mount({
    canvas: '#sky',
    selectors: { heading: 'h1, h2', section: '[data-c1]' }
  });
</script>
```

**3. Give your sections palettes.** Nothing happens without at least one — no
crossfade, no exposure:

```html
<section data-c1="#E03A5E" data-c2="#FF7A4D" data-c3="#8E3BD6"
         data-accent="#FF6A86" data-exposure="0.92"> … </section>
```

**4. Consume the variables** the engine writes, or the type will not track the
sky behind it:

```css
h2 { color: rgb(var(--accent)); }
.card { border-color: rgb(var(--accent) / 0.28); }
```

### In a framework

Mount in an effect, destroy in cleanup, `remeasure()` on route change:

```jsx
import { useEffect, useRef } from 'react';
import { mount } from 'vast-array';
import 'vast-array/css';

export function Sky() {
  const ref = useRef(null);
  useEffect(() => {
    const sky = mount({
      canvas: ref.current,
      selectors: { heading: '.heading', section: '[data-c1]' }
    });
    return () => sky.destroy();
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
```

Importing the module during SSR is safe — nothing at module scope touches the
DOM unguarded, and the bundle imports cleanly in bare Node. Only `mount()`
needs a browser, so keep it inside the effect.

Route changes need `remeasure()`. Hold the handle in a ref and call it once the
new page has painted, or the light keeps stopping where the old headings were.

### What will bite, in order

**1. An opaque wrapper.** Symptom: a black box and no error. Walk up from the
canvas until you find the element carrying a background.

**2. Content in a scroll container.** Pass `scroller`, or the palette and the
shadows both go dead — section positions, the palette probe and the occluder
placement are all expressed in whichever coordinate space that option names.

**3. Anything that moves a heading after mount.** Accordions, lazy images above
the fold, route changes. `remeasure()`.

**4. The font.** The hollow **A** is the typeface, not an SVG substitution —
the headings are plain text. `css/font.css` embeds *Hail Mary Sans* as a base64
data URI rather than linking a file, because Chrome treats a font fetched from
a `file://` page as cross-origin and refuses it; inlining is what keeps the
page working when opened by double-click. Do not copy that file into a
published project without settling the licence first. Your own display face is
fine — just refit the sizes, because this one advances about **1.4em per
character**, which is very wide, and every display size in `demo.css` is tuned
to it: `.wordmark`, `.head`, `.eyebrow`, `.card__figure`, `.foot__mark`.

### One band instead of a whole page

If the sky only belongs behind a hero rather than the entire site, override
`.va-sky` to `position: absolute` inside that section and pass the section as
`scroller`. That avoids fighting the existing page's stacking and scroll
behaviour at all, and it is a tested path rather than an improvised one.

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

**Headings are opaque.** Every heading is rasterised once into a single atlas
texture. Each frame the renderer stamps whichever ones are on screen into a
viewport-space mask, and the ray pass marches each pixel back toward the light
through that mask. Light fills what it can reach and stops behind the letters,
and the hollow **A** lets light through its middle because the glyph really is
hollow.

Rasterising once and blitting per frame is what keeps this free while
scrolling — nothing is redrawn or re-uploaded as the page moves. Character
positions come from `Range` rectangles, so letter-spacing, wrapping and
centring are taken from the layout the browser already did rather than
re-derived.

**The stir is integrated, not eased.** Pointer movement pushes a velocity; the
loop integrates that into a displacement that is kept. Only the velocity
decays, so the clouds coast to a stop and stay put rather than springing back.

**Scrolling is a camera move.** The sky is fixed and the plates plate over it,
the palette crossfades, the iris adjusts, and the horizon sinks out of frame as
you climb and returns at the end.

## Fallbacks

No WebGL → a CSS gradient sky painted onto the canvas element, with the same
scroll-driven palette. `prefers-reduced-motion` → one static frame, no drift,
no reveal animations. If frames stay slow after a warm-up period, quality steps
down up to three times, then falls back to the CSS sky.

## Layout

```
index.html            the demo: hero, four plates, horizon footer
css/vast-array.css    engine stylesheet — ships with the package
css/demo.css          this page's type and layout — does not
css/font.css          Hail Mary Sans, embedded as a data URI
src/defaults.js       ← every number worth changing lives here
src/shaders.js        GLSL: scene / blur / mask / rays / composite
src/sky.js            WebGL renderer — 5 programs, 5 framebuffers
src/mount.js          pointer + scroll state, easing, palette, reveals
src/index.js          public entry and the data-auto hook
dist/                 built bundles, committed
```

`npm run build` regenerates `dist/`. It is committed on purpose: the promise
this repo makes is that you can double-click `index.html` and it works, and
that cannot survive a build step standing between the clone and the page.

## Before publishing

`package.json` is marked `"private": true` and carries no `license` field,
because two things are yours to decide:

1. **A licence for the code.** Pick one and add a `LICENSE` file.
2. **The font.** `css/font.css` is not in the package `files` list, and should
   stay out of it — it is a fan-made face derived from a film poster, and
   publishing it to npm is redistribution on behalf of everyone who installs.
   Ship the package with the fallback stack and let consumers bring their own.

The name is also worth a thought: keep the *Project Hail Mary* reference in the
credit line, not in anything you publish under.

---

Visual homage to the *Project Hail Mary* poster.
