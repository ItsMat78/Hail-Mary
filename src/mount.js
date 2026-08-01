/* VAST ARRAY — input, easing and the palette.
   One rAF loop drives everything. The same numbers go to the shader and to
   CSS custom properties, so the page and the sky are never out of step.

   mount() owns a canvas, a scroll source and a set of selectors, and hands
   back a handle. Everything it attaches to the document is tracked so
   destroy() can put it all back. */

import defaults from './defaults.js';
import { create } from './sky.js';

/* Classes the engine writes. Prefixed, because a package has no business
   claiming a name as generic as `.is-visible` in someone else's stylesheet. */
var CLS = {
  canvas:  'va-sky',
  ready:   'va-ready',
  hasSun:  'va-has-sun',
  noWebgl: 'va-no-webgl',
  visible: 'va-visible',
  settled: 'va-settled'
};

var SELECTORS = {
  /* What blocks the light. Anything matching this gets rasterised into the
     occluder atlas, so keep it to display type — a whole article of body copy
     would be a large texture for a shadow nobody can read. */
  heading: '.va-heading',
  /* What carries a palette: data-c1/c2/c3, data-accent, data-exposure. */
  section: '[data-c1]',
  /* What fades in on scroll. The engine only toggles the class. */
  reveal:  '.va-reveal',
  /* Text that is present for screen readers only, and must not stamp a
     shadow out in the corner where it is parked. */
  srOnly:  '.sr-only',
  /* Optional. An element whose intro animation changes its own box, so the
     atlas has to be rebuilt once it settles. */
  hero:    null
};

var CSS_VARS = ['--c1', '--c2', '--c3', '--accent', '--fringe'];

/* More than one sky can share a root element, and the classes and custom
   properties written there belong to all of them. Without a count, the first
   instance to be destroyed strips `va-ready` out from under its siblings —
   which is exactly what happens on an SPA route change, where the incoming
   mount usually runs before the outgoing cleanup. Last one out turns off the
   lights.

   Note this only makes teardown safe. Two instances sharing a root still
   share one palette and one `va-has-sun`, so give each its own `root` if they
   need to disagree. */
var rootUsers = new WeakMap();

function claimRoot(el) {
  rootUsers.set(el, (rootUsers.get(el) || 0) + 1);
}

function releaseRoot(el) {
  var n = (rootUsers.get(el) || 1) - 1;
  if (n > 0) { rootUsers.set(el, n); return false; }
  rootUsers.delete(el);
  return true;
}

/* ----------------------------------------------------------------- config */

function isPlain(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && v.nodeType === undefined;
}

/* Merges into `target` rather than returning a new object, so the `config`
   handed back by mount() stays a live reference through setConfig(). */
function assignDeep(target, src) {
  if (!isPlain(src)) { return target; }
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) { continue; }
    if (isPlain(src[k])) {
      if (!isPlain(target[k])) { target[k] = {}; }
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
    if (!Object.prototype.hasOwnProperty.call(src, k)) { continue; }
    out[k] = isPlain(src[k]) ? cloneDeep(src[k]) : src[k];
  }
  return out;
}

/* ----------------------------------------------------------------- colour */

function hexToRgb(hex) {
  var h = String(hex).trim().replace('#', '');
  if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  ];
}

/* The shader mixes light, so it needs linear values. Mixing sRGB directly is
   what makes gradients go muddy through the middle. */
function toLinear(c) {
  return c.map(function (v) {
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
  return Math.round(c[0] * 255) + ' ' + Math.round(c[1] * 255) + ' ' + Math.round(c[2] * 255);
}

function smoothstep(e0, e1, x) {
  var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/* Frame-rate independent easing: same feel at 60 and 144 Hz. */
function easeTo(cur, target, k, dt) {
  return cur + (target - cur) * (1 - Math.exp(-k * dt));
}

function clamp(v, lim) { return v < -lim ? -lim : (v > lim ? lim : v); }

/* ------------------------------------------------------------------ mount */

export function mount(options) {
  var opts = options || {};

  var cfg = assignDeep(cloneDeep(defaults), opts.config);
  var sel = assignDeep(assignDeep({}, SELECTORS), opts.selectors);
  var root = opts.root || document.documentElement;
  claimRoot(root);

  /* Given an element, a selector, or nothing at all. With nothing, take a
     canvas that is already there before making one — a page that ships its
     own markup should not end up with two. */
  var madeCanvas = false;
  var canvas = null;
  if (opts.canvas && opts.canvas.nodeType === 1) {
    canvas = opts.canvas;
  } else if (typeof opts.canvas === 'string') {
    canvas = document.querySelector(opts.canvas);
  } else {
    canvas = document.querySelector('.' + CLS.canvas) || document.querySelector('#sky');
  }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    madeCanvas = true;
  }
  canvas.classList.add(CLS.canvas);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Everything attached to the document, so destroy() can hand it all back. */
  var listeners = [];
  function on(target, type, fn, o) {
    target.addEventListener(type, fn, o);
    listeners.push([target, type, fn, o]);
  }

  /* --------------------------------------------------------------- scroll */

  /* The scroll source is an option because the sky does not care whether the
     page scrolls or a container does — but every page coordinate below has to
     be expressed in whichever one it is. */
  var scroller = opts.scroller || window;
  var scrollEl = (scroller === window || scroller === document ||
                  scroller === document.documentElement) ? null : scroller;

  function scrollTop() { return scrollEl ? scrollEl.scrollTop : window.pageYOffset; }
  function viewH() { return scrollEl ? scrollEl.clientHeight : window.innerHeight; }

  function maxScroll() {
    return scrollEl
      ? Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight)
      : Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* Untransformed layout box, walked up the offsetParent chain.
     getBoundingClientRect would include the reveal animation's translate and
     the hero's scale, which would put every shadow a few dozen pixels below
     where the text really is. Offsets inside a heading are still taken from
     client rects — a translate cancels out there, since both ends of the
     subtraction carry it. */
  function chainTop(el) {
    var y = 0, n = el;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }

  function offsetBox(el) {
    var x = 0, y = 0, n = el;
    while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  }

  /* Tops are stored in scroll space — the coordinate that scrollTop() indexes
     into — so the palette probe and the occluder placement agree whether the
     window scrolls or a container does. */
  var originY = 0;

  /* Where the top of the scrolled content currently sits, in viewport
     coordinates. For the window this is just -scrollY and costs no DOM read. */
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

  /* Per frame. A fixed canvas over a scrolling window — the default — needs
     nothing read back from the DOM at all. */
  function liveGeom() {
    if (!canvasFixed) { measureCanvas(); }
    contentTop = scrollEl
      ? scrollEl.getBoundingClientRect().top - scrollEl.scrollTop
      : -window.pageYOffset;
  }

  /* -------------------------------------------------------------- sections */

  var stops = [];

  function readSections() {
    var els = [].slice.call(document.querySelectorAll(sel.section));
    stops = els.map(function (el) {
      var c1 = hexToRgb(el.dataset.c1);
      var c2 = hexToRgb(el.dataset.c2);
      var c3 = hexToRgb(el.dataset.c3);
      return {
        el: el,
        /* sRGB for CSS, linear for the shader — the same colours, twice. */
        c1: c1, c2: c2, c3: c3,
        l1: toLinear(c1), l2: toLinear(c2), l3: toLinear(c3),
        accent: hexToRgb(el.dataset.accent || el.dataset.c1),
        exposure: parseFloat(el.dataset.exposure || '1'),
        top: 0,
        h: 1
      };
    });
  }

  function measure() {
    canvasFixed = getComputedStyle(canvas).position === 'fixed';
    measureCanvas();
    originY = scrollEl ? chainTop(scrollEl) : 0;
    for (var i = 0; i < stops.length; i++) {
      var b = offsetBox(stops[i].el);
      stops[i].top = b.top - originY;
      stops[i].h = Math.max(1, b.height);
    }
  }

  /* Which palette applies right now: the section under the middle of the
     viewport, crossfading into the next one across its back half. */
  function paletteAt(y) {
    if (!stops.length) { return null; }
    var probe = y + viewH() * 0.5;
    var i = 0;
    for (; i < stops.length - 1; i++) {
      if (probe < stops[i].top + stops[i].h) { break; }
    }
    var a = stops[i];
    var b = stops[Math.min(i + 1, stops.length - 1)];
    var p = (probe - a.top) / a.h;
    var t = smoothstep(0.5, 1.0, p);
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

  /* --------------------------------------------------------- occluder mask */

  /* Every heading gets rasterised once into a single atlas canvas. Each frame
     the renderer stamps whichever ones are on screen into a viewport-space
     mask, and the ray pass marches light against that. Rasterising once and
     blitting per frame is what keeps this free while scrolling.

     Characters are placed from Range rectangles rather than measured text, so
     letter-spacing, line breaks and centring come straight from the layout the
     browser already did — no attempt to re-derive any of it. */

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
    while ((n = walk.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) { continue; }
      var p = n.parentElement, hidden = false;
      while (p && p !== el) {
        if (sel.srOnly && p.matches && p.matches(sel.srOnly)) { hidden = true; break; }
        p = p.parentElement;
      }
      if (!hidden) { out.push(n); }
    }
    return out;
  }

  function drawHeading(ctx, el, ox, oy) {
    var cs = getComputedStyle(el);
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    var er = el.getBoundingClientRect();
    var nodes = visibleText(el);
    var range = document.createRange();

    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k];
      var text = node.nodeValue;
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (ch === ' ' || ch === '\n' || ch === '\t') { continue; }
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        var r = range.getBoundingClientRect();
        if (r.width < 0.5 || r.height < 0.5) { continue; }
        var m = ctx.measureText(ch);
        var asc = m.fontBoundingBoxAscent;
        var desc = m.fontBoundingBoxDescent;
        if (!asc) { asc = r.height * 0.78; desc = r.height * 0.22; }
        /* Half-leading: correct whether the rect is the font box or the line
           box, which differs between element types. */
        var baseline = (r.top - er.top) + oy + asc + (r.height - (asc + desc)) / 2;
        ctx.fillText(ch, (r.left - er.left) + ox, baseline);
      }
    }
  }

  function buildAtlas() {
    if (!sky) { return; }
    var els = headings();
    if (!els.length) { occluders = []; return; }

    var boxes = els.map(offsetBox);
    var W = 0, H = 0;
    for (var i = 0; i < boxes.length; i++) {
      W = Math.max(W, Math.ceil(boxes[i].width) + ATLAS_PAD * 2);
      H += Math.ceil(boxes[i].height) + ATLAS_PAD * 2;
    }
    if (W < 2 || H < 2) { return; }

    if (!atlasCanvas) { atlasCanvas = document.createElement('canvas'); }
    atlasCanvas.width = W;
    atlasCanvas.height = H;
    var ctx = atlasCanvas.getContext('2d');
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
        ax: 0, ay: y, aw: bw, ah: bh,
        left: r.left - ATLAS_PAD,
        top: (r.top - originY) - ATLAS_PAD,
        w: bw, h: bh,
        src: [0, 0, 0, 0],
        dst: [0, 0, 0, 0]
      });
      y += bh;
    }

    atlasW = W;
    atlasH = H;
    sky.setAtlas(atlasCanvas);
  }

  /* Per frame: which headings are on screen, and where. Cheap enough to redo
     every frame because it is pure arithmetic on cached boxes. */
  function updateOccluders() {
    var live = [];
    var vw = canvasRect.width, vh = canvasRect.height;
    for (var i = 0; i < occluders.length; i++) {
      var o = occluders[i];
      var top = contentTop + o.top - canvasRect.top;
      if (top > vh || top + o.h < 0) { continue; }
      var left = o.left - canvasRect.left;
      /* Clip space, y up. */
      o.dst[0] = (left / vw) * 2 - 1;
      o.dst[1] = 1 - ((top + o.h) / vh) * 2;
      o.dst[2] = (o.w / vw) * 2;
      o.dst[3] = (o.h / vh) * 2;
      /* Atlas uv. The texture was uploaded flipped, so v = 0 is the last row. */
      o.src[0] = o.ax / atlasW;
      o.src[1] = 1 - (o.ay + o.ah) / atlasH;
      o.src[2] = o.aw / atlasW;
      o.src[3] = o.ah / atlasH;
      live.push(o);
    }
    st.occluders = live;
  }

  /* ---------------------------------------------------------------- state */

  /* The light's own colour, blended bilinearly across the viewport, so a
     sweep of the pointer runs it through all four hues. */
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
    lightX: 0.5, lightY: 0.62,
    lightCol: [1, 1, 1],
    scroll: 0,
    c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0],
    exposure: 1,
    aberration: 0.35,
    grain: 0.055,
    vignette: 0.58,
    flare: 0.6,
    motion: 0,
    bloom: cfg.camera.bloom,
    rayAmt: 1,
    flowX: 0, flowY: 0, swirl: 0,
    occluders: [],
    drift: reduced ? 0 : 1
  };

  var targetX = 0.5, targetY = 0.62;
  var lastPx = 0.5, lastPy = 0.62;
  var vel = 0, velTarget = 0;
  var pal = null;

  /* CSS custom properties are cheap to read and expensive to write — every
     write restyles the elements that use them. So only write on real change,
     which means an idle pointer costs the DOM nothing at all. */
  var wroteFringe = -999;
  var wroteCss = null;

  function writeCss(p) {
    if (wroteCss) {
      var d = 0;
      for (var i = 0; i < 3; i++) {
        d = Math.max(d, Math.abs(p.accent[i] - wroteCss.accent[i]),
                        Math.abs(p.c1[i] - wroteCss.c1[i]),
                        Math.abs(p.c2[i] - wroteCss.c2[i]),
                        Math.abs(p.c3[i] - wroteCss.c3[i]));
      }
      if (d < 0.006) { return; }
    }
    wroteCss = p;
    root.style.setProperty('--accent', cssRgb(p.accent));
    root.style.setProperty('--c1', cssRgb(p.c1));
    root.style.setProperty('--c2', cssRgb(p.c2));
    root.style.setProperty('--c3', cssRgb(p.c3));
  }

  /* --------------------------------------------------------------- input */

  /* Momentum in the medium, kept as velocity and position separately.
     Pointer movement pushes the velocity; the loop integrates that into a
     position that is never pulled back. Only the velocity decays, so the
     clouds coast to a stop and stay where they were left — decaying the
     displacement instead is what made them spring back to where they began. */
  var stirVX = 0, stirVY = 0, stirVA = 0;
  var stirX = 0, stirY = 0, stirA = 0;

  if (hasHover && !reduced) {
    on(window, 'pointermove', function (e) {
      /* Relative to the canvas rather than the window, so an embedded canvas
         still gets 0..1 across its own box. */
      var nx = (e.clientX - canvasRect.left) / canvasRect.width;
      var ny = (e.clientY - canvasRect.top) / canvasRect.height;
      var dx = nx - lastPx;
      var dy = ny - lastPy;
      velTarget = Math.min(1, Math.hypot(dx, dy) * 26);
      stirVX += dx * cfg.stir.pushGain;
      stirVY -= dy * cfg.stir.pushGain;
      stirVA += dx * cfg.stir.swirlGain;
      lastPx = nx; lastPy = ny;
      targetX = nx;
      targetY = 1 - ny; /* GL space has y up */
    }, { passive: true });
  }

  var resizeTimer = 0;
  on(window, 'resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (destroyed) { return; }
      measure();
      if (sky) { sky.resize(canvasRect.width, canvasRect.height); }
      buildAtlas();
      if (reduced || !sky) { requestAnimationFrame(function () { frame(0); }); }
    }, 120);
  }, { passive: true });

  var atlasQueued = false;
  function scheduleAtlas() {
    if (atlasQueued || destroyed) { return; }
    atlasQueued = true;
    requestAnimationFrame(function () {
      atlasQueued = false;
      if (!destroyed) { buildAtlas(); }
    });
  }

  /* The public hook. Anything that moves a heading — a route change, a
     revealed accordion, a lazily loaded image above the fold — has to say so,
     or the light keeps stopping where the text used to be. */
  function remeasure() {
    if (destroyed) { return; }
    readSections();
    measure();
    scheduleAtlas();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure);
  }
  on(window, 'load', remeasure);

  /* The hero animates in with a scale, so its box is wrong until that ends. */
  var settleTimer = 0;
  var heroEl = sel.hero ? document.querySelector(sel.hero) : null;
  if (heroEl) {
    var settled = false;
    var settle = function () {
      if (settled) { return; }
      settled = true;
      /* Release the compositor layer the intro needed. */
      heroEl.classList.add(CLS.settled);
      remeasure();
    };
    on(heroEl, 'animationend', settle);
    /* animationend does not arrive if the animation is interrupted, or if the
       page is in a background tab where the browser is barely producing
       frames. Without this the layer would stay pinned and the occluder atlas
       would keep the scaled-up boxes it was built with. */
    settleTimer = setTimeout(settle, 3000);
  }

  /* --------------------------------------------------------------- reveal */

  var io = null;
  var revealables = [].slice.call(document.querySelectorAll(sel.reveal));
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add(CLS.visible); });
  } else {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add(CLS.visible);
          io.unobserve(entry.target);
        }
      });
    }, { root: scrollEl || null, rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    /* Anything already on screen is shown now rather than handed to the
       observer. A browser does not compute intersections for a page it is not
       painting, so a page opened in a background tab would otherwise sit at
       opacity 0 until it was looked at — including the hero, which is in view
       by definition. */
    revealables.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.classList.add(CLS.visible);
      } else {
        io.observe(el);
      }
    });
  }

  /* ---------------------------------------------------------------- setup */

  var sky = null;
  var destroyed = false;
  var running = true;
  var rafId = 0;

  function startSky() {
    sky = create(canvas, cfg);
    if (!sky) {
      root.classList.add(CLS.noWebgl);
      console.warn('[sky] WebGL unavailable — falling back to the CSS backdrop.');
      return;
    }
    root.classList.remove(CLS.noWebgl);
    sky.resize(canvasRect.width, canvasRect.height);
  }

  readSections();
  measure();
  liveGeom();
  startSky();

  on(canvas, 'webglcontextlost', function (e) {
    e.preventDefault();
    running = false;
    root.classList.add(CLS.noWebgl);
    root.classList.remove(CLS.hasSun);
  });

  /* Seed the palette from the section in view so frame one is already right. */
  pal = paletteAt(scrollTop());
  if (pal) {
    st.c1 = pal.l1.slice();
    st.c2 = pal.l2.slice();
    st.c3 = pal.l3.slice();
    st.exposure = pal.exposure;
  }

  root.classList.add(CLS.ready);

  /* Hide the native pointer only when a sun is actually following it. With no
     WebGL, no fine pointer, or reduced motion there is nothing standing in for
     it, and taking the cursor away would just leave the page feeling broken. */
  if (sky && hasHover && !reduced) { root.classList.add(CLS.hasSun); }

  buildAtlas();

  /* ----------------------------------------------------------------- loop */

  var last = 0;
  var samples = [];
  var watching = true;

  function frame(now) {
    if (destroyed) { return; }
    var raw = last ? (now - last) / 1000 : 0.016;
    /* Clamped at both ends: the resize path calls this with now = 0, and a
       negative delta makes every eased value run backwards away from target. */
    var dt = Math.max(0, Math.min(raw, 0.05));
    last = now;
    if (!reduced) { st.time += dt; }

    liveGeom();
    var y = scrollTop();

    /* Without a pointer the light still has to come from somewhere, so it
       drifts on its own and rides the scroll. */
    if (!hasHover && !reduced) {
      targetX = 0.5 + 0.30 * Math.sin(st.time * 0.11);
      targetY = 0.62 + 0.18 * Math.cos(st.time * 0.083);
    }

    var sp = Math.min(1, Math.max(0, y / maxScroll()));
    st.scroll = easeTo(st.scroll, sp, cfg.ease.scroll, dt);

    st.lightX = easeTo(st.lightX, targetX, cfg.ease.light, dt);
    st.lightY = easeTo(st.lightY, targetY, cfg.ease.light, dt);

    velTarget *= Math.pow(0.02, dt);
    vel = easeTo(vel, velTarget, 12, dt);
    /* Separate from vel: this one drives the anamorphic streak, and wants a
       gentler curve so the sweep trails the cursor rather than snapping. */
    st.motion = easeTo(st.motion, Math.min(1, velTarget * 1.6), cfg.camera.motionEase, dt);

    /* Integrate first, then bleed the velocity. The offsets are kept. */
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

    /* Shafts belong to the opening. Past it the light keeps its colour but
       stops filling the frame, so the deep-space plates stay dark. */
    st.rayAmt = 1 - 0.5 * smoothstep(0, 0.22, st.scroll);

    updateOccluders();

    var p = paletteAt(y);
    if (p) {
      var kc = 1 - Math.exp(-cfg.ease.palette * dt);
      st.c1 = mix3(st.c1, p.l1, kc);
      st.c2 = mix3(st.c2, p.l2, kc);
      st.c3 = mix3(st.c3, p.l3, kc);

      /* An iris stops down fast and opens back up slowly. That asymmetry is
         most of why this reads as a camera rather than a crossfade. */
      var k = p.exposure < st.exposure ? cfg.ease.exposureDown : cfg.ease.exposureUp;
      st.exposure = easeTo(st.exposure, p.exposure, k, dt);

      writeCss(p);
    }

    /* Off-axis distance drives the fringing, the way a real lens does. The
       shader scales this by distance-cubed, so single-digit thousandths
       already read as a few pixels of separation out at the corners. */
    var offAxis = Math.hypot(st.lightX - 0.5, st.lightY - 0.5) * 2;
    st.aberration = cfg.camera.aberrationBase + offAxis * cfg.camera.aberrationEdge + vel * cfg.camera.aberrationVel;
    st.flare = cfg.camera.flareBase + vel * cfg.camera.flareVel;
    st.vignette = cfg.camera.vignetteBase + st.scroll * cfg.camera.vignetteScroll;
    st.grain = cfg.camera.grainBase + (1 - Math.min(1, st.exposure)) * 0.05;
    st.bloom = cfg.camera.bloom;

    /* The type is fringed by the same optics as the sky. Stepped, because a
       text-shadow that changes every frame repaints the whole headline. */
    var fringe = (st.lightX - 0.5) * (cfg.camera.fringePx + vel * 5) * (0.4 + offAxis * 0.8);
    if (Math.abs(fringe - wroteFringe) > 0.12) {
      wroteFringe = fringe;
      root.style.setProperty('--fringe', fringe.toFixed(2));
    }

    if (sky) {
      sky.render(st);

      /* Check early, so a GPU that cannot cope is caught in the first second
         rather than after several. Frames longer than 200ms are thrown away
         rather than counted: a browser throttles rAF hard whenever its window
         is occluded or backgrounded, and that must not be mistaken for a slow
         GPU — it would drop a perfectly capable machine to the CSS fallback
         just because the user looked at another window. */
      if (watching && st.time > cfg.quality.warmupSeconds && raw < 0.2) {
        samples.push(raw);
        if (samples.length >= 32) {
          var sum = 0;
          for (var i = 4; i < samples.length; i++) { sum += samples[i]; }
          var mean = sum / (samples.length - 4);
          samples.length = 0;
          if (mean > cfg.quality.slowFrameMs / 1000) {
            if (!sky.degrade()) {
              /* Out of headroom. The CSS sky is better than a frozen page.
                 The loop stays alive — without GL it costs almost nothing,
                 and it still drives the palette as you scroll. */
              watching = false;
              sky.dispose();
              sky = null;
              root.classList.add(CLS.noWebgl);
              root.classList.remove(CLS.hasSun);
              console.warn('[sky] GPU cannot sustain the shader — using the CSS backdrop.');
            }
          } else if (mean < 0.020) {
            watching = false;
          }
        }
      }
    }

    if (running && !reduced) { rafId = requestAnimationFrame(frame); }
  }

  /* No visibility handling here on purpose. Browsers already throttle rAF to
     roughly a frame every few seconds for hidden pages, which is the whole
     benefit, and stopping the loop ourselves only adds a way to get stuck
     frozen after an occlusion event. */

  if (reduced) {
    /* One frame at rest, then repaint only when the palette should change. */
    rafId = requestAnimationFrame(frame);
    var queued = false;
    on(scroller, 'scroll', function () {
      if (queued) { return; }
      queued = true;
      rafId = requestAnimationFrame(function (t) { queued = false; frame(t); });
    }, { passive: true });
  } else {
    rafId = requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------- handle */

  function setConfig(partial) {
    if (destroyed) { return cfg; }
    /* glsl and glslInt are #defines and quality sizes the buffers, so all
       three are only read when the renderer is built. Changing one means a
       new renderer; everything else lands on the next frame by itself. */
    var rebuild = !!(partial && (partial.glsl || partial.glslInt || partial.quality));
    assignDeep(cfg, partial);
    deriveLight();
    if (rebuild && sky) {
      sky.dispose();
      sky = null;
      startSky();
      if (sky) { buildAtlas(); }
    }
    return cfg;
  }

  function destroy() {
    if (destroyed) { return; }
    destroyed = true;
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); }
    clearTimeout(resizeTimer);
    clearTimeout(settleTimer);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i][0].removeEventListener(listeners[i][1], listeners[i][2], listeners[i][3]);
    }
    listeners.length = 0;
    if (io) { io.disconnect(); io = null; }
    if (sky) { sky.dispose(); sky = null; }
    if (releaseRoot(root)) {
      root.classList.remove(CLS.ready, CLS.hasSun, CLS.noWebgl);
      for (var v = 0; v < CSS_VARS.length; v++) { root.style.removeProperty(CSS_VARS[v]); }
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
    canvas: canvas,
    remeasure: remeasure,
    setConfig: setConfig,
    destroy: destroy,
    /* Null whenever there is no WebGL — at startup, after a context loss, or
       after the quality ladder gave up. */
    get sky() { return sky; }
  };
}
