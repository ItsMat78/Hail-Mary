/* VAST ARRAY — input, easing and the palette.
   One rAF loop drives everything. The same numbers go to the shader and to
   CSS custom properties, so the page and the sky are never out of step. */

(function () {
  'use strict';

  var CFG = window.VA_CONFIG;
  var root = document.documentElement;
  var canvas = document.getElementById('sky');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------------------- colour */

  function hexToRgb(hex) {
    var h = hex.trim().replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }

  /* The shader mixes light, so it needs linear values. Mixing sRGB directly
     is what makes gradients go muddy through the middle. */
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
  function ease(cur, target, k, dt) {
    return cur + (target - cur) * (1 - Math.exp(-k * dt));
  }

  /* ------------------------------------------------------------ sections */

  var sections = [].slice.call(document.querySelectorAll('[data-c1]'));
  var stops = sections.map(function (el) {
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

  var vw = window.innerWidth, vh = window.innerHeight;

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    for (var i = 0; i < stops.length; i++) {
      var r = stops[i].el.getBoundingClientRect();
      stops[i].top = r.top + window.pageYOffset;
      stops[i].h = Math.max(1, r.height);
    }
  }

  /* ------------------------------------------------------- occluder mask */

  /* Every heading gets rasterised once into a single atlas canvas. Each frame
     the renderer stamps whichever ones are on screen into a viewport-space
     mask, and the ray pass marches light against that. Rasterising once and
     blitting per frame is what keeps this free while scrolling.

     Characters are placed from Range rectangles rather than measured text, so
     letter-spacing, line breaks and centring come straight from the layout the
     browser already did — no attempt to re-derive any of it. */

  var atlasCanvas = null;
  var occluders = [];
  var ATLAS_PAD = 14;

  function headings() {
    return [].slice.call(document.querySelectorAll('.wordmark, .head'));
  }

  /* Skip text that is only there for screen readers — it is positioned off
     in the corner and would stamp a shadow in the wrong place. */
  function visibleText(root) {
    var out = [];
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walk.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) { continue; }
      var p = n.parentElement, hidden = false;
      while (p && p !== root) {
        if (p.classList && p.classList.contains('sr-only')) { hidden = true; break; }
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

  /* Untransformed layout box, in page coordinates. getBoundingClientRect
     would include the reveal animation's translate and the hero's scale, which
     would put every shadow a few dozen pixels below where the text really is.
     Offsets inside a heading are still taken from client rects — a translate
     cancels out there, since both ends of the subtraction carry it. */
  function pageBox(el) {
    var x = 0, y = 0, n = el;
    while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  }

  function buildAtlas() {
    if (!sky) { return; }
    var els = headings();
    if (!els.length) { return; }

    var boxes = els.map(pageBox);
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
        /* Where it sits in the atlas, and where it sits on the page. */
        ax: 0, ay: y, aw: bw, ah: bh,
        left: r.left - ATLAS_PAD,
        top: r.top - ATLAS_PAD,
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

  var atlasW = 1, atlasH = 1;

  /* Per frame: which headings are on screen, and where. Cheap enough to redo
     every frame because it is pure arithmetic on cached boxes. */
  function updateOccluders() {
    var live = [];
    for (var i = 0; i < occluders.length; i++) {
      var o = occluders[i];
      var top = o.top - scrollY;
      if (top > vh || top + o.h < 0) { continue; }
      /* Clip space, y up. */
      o.dst[0] = (o.left / vw) * 2 - 1;
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

  /* Which palette applies right now: the section under the middle of the
     viewport, crossfading into the next one across its back half. */
  function paletteAt(scrollY) {
    if (!stops.length) { return null; }
    var probe = scrollY + window.innerHeight * 0.5;
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

  /* --------------------------------------------------------------- state */

  /* The light's own colour, blended bilinearly across the viewport, so a
     sweep of the pointer runs it through all four hues. */
  var LIGHT_TL = toLinear(hexToRgb(CFG.light.topLeft));
  var LIGHT_TR = toLinear(hexToRgb(CFG.light.topRight));
  var LIGHT_BL = toLinear(hexToRgb(CFG.light.bottomLeft));
  var LIGHT_BR = toLinear(hexToRgb(CFG.light.bottomRight));

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
    bloom: CFG.camera.bloom,
    rayAmt: 1,
    flowX: 0, flowY: 0, swirl: 0,
    occluders: [],
    drift: reduced ? 0 : 1
  };

  var targetX = 0.5, targetY = 0.62;
  var lastPx = 0.5, lastPy = 0.62;
  var vel = 0, velTarget = 0;
  var scrollY = window.pageYOffset;
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

  /* Seed the palette from the first section so frame one is already right. */
  measure();
  pal = paletteAt(scrollY);
  if (pal) {
    st.c1 = pal.l1.slice();
    st.c2 = pal.l2.slice();
    st.c3 = pal.l3.slice();
    st.exposure = pal.exposure;
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
    window.addEventListener('pointermove', function (e) {
      var nx = e.clientX / vw;
      var ny = e.clientY / vh;
      var dx = nx - lastPx;
      var dy = ny - lastPy;
      velTarget = Math.min(1, Math.hypot(dx, dy) * 26);
      stirVX += dx * CFG.stir.pushGain;
      stirVY -= dy * CFG.stir.pushGain;
      stirVA += dx * CFG.stir.swirlGain;
      lastPx = nx; lastPy = ny;
      targetX = nx;
      targetY = 1 - ny; /* GL space has y up */
    }, { passive: true });
  }

  function clamp(v, lim) { return v < -lim ? -lim : (v > lim ? lim : v); }

  window.addEventListener('scroll', function () {
    scrollY = window.pageYOffset;
  }, { passive: true });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      if (sky) { sky.resize(window.innerWidth, window.innerHeight); }
      buildAtlas();
      if (reduced || !sky) { requestAnimationFrame(function () { frame(0); }); }
    }, 120);
  }, { passive: true });

  var atlasQueued = false;
  function scheduleAtlas() {
    if (atlasQueued) { return; }
    atlasQueued = true;
    requestAnimationFrame(function () { atlasQueued = false; buildAtlas(); });
  }

  function remeasure() {
    measure();
    scheduleAtlas();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure);
  }
  window.addEventListener('load', remeasure);

  /* The hero animates in with a scale, so its box is wrong until that ends.
     Rebuild once it settles. */
  var wordmarkEl = document.querySelector('.wordmark');
  if (wordmarkEl) {
    var settled = false;
    function settle() {
      if (settled) { return; }
      settled = true;
      /* Release the compositor layer the intro needed. */
      wordmarkEl.classList.add('is-settled');
      remeasure();
    }
    wordmarkEl.addEventListener('animationend', settle);
    /* animationend does not arrive if the animation is interrupted, or if the
       page is in a background tab where the browser is barely producing
       frames. Without this the layer would stay pinned and the occluder atlas
       would keep the scaled-up boxes it was built with. */
    setTimeout(settle, 3000);
  }

  /* --------------------------------------------------------------- reveal */

  var revealables = [].slice.call(document.querySelectorAll('.reveal'));
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    /* Anything already on screen is shown now rather than handed to the
       observer. A browser does not compute intersections for a page it is not
       painting, so a page opened in a background tab would otherwise sit at
       opacity 0 until it was looked at — including the hero, which is in view
       by definition. */
    revealables.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.classList.add('is-visible');
      } else {
        io.observe(el);
      }
    });
  }

  /* ---------------------------------------------------------------- setup */

  var sky = window.VA_SKY.create(canvas);
  if (!sky) {
    root.classList.add('no-webgl');
    console.warn('[sky] WebGL unavailable — falling back to the CSS backdrop.');
  } else {
    sky.resize(window.innerWidth, window.innerHeight);
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      running = false;
      root.classList.add('no-webgl');
    });
  }

  root.classList.add('is-ready');
  buildAtlas();

  /* ----------------------------------------------------------------- loop */

  var last = 0;
  var running = true;
  var samples = [];
  var watching = true;

  function frame(now) {
    var raw = last ? (now - last) / 1000 : 0.016;
    /* Clamped at both ends: the resize path calls this with now = 0, and a
       negative delta makes every eased value run backwards away from target. */
    var dt = Math.max(0, Math.min(raw, 0.05));
    last = now;
    if (!reduced) { st.time += dt; }

    /* Without a pointer the light still has to come from somewhere, so it
       drifts on its own and rides the scroll. */
    if (!hasHover && !reduced) {
      targetX = 0.5 + 0.30 * Math.sin(st.time * 0.11);
      targetY = 0.62 + 0.18 * Math.cos(st.time * 0.083);
    }

    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var sp = Math.min(1, Math.max(0, scrollY / docH));
    st.scroll = ease(st.scroll, sp, CFG.ease.scroll, dt);

    st.lightX = ease(st.lightX, targetX, CFG.ease.light, dt);
    st.lightY = ease(st.lightY, targetY, CFG.ease.light, dt);

    velTarget *= Math.pow(0.02, dt);
    vel = ease(vel, velTarget, 12, dt);
    /* Separate from vel: this one drives the anamorphic streak, and wants a
       gentler curve so the sweep trails the cursor rather than snapping. */
    st.motion = ease(st.motion, Math.min(1, velTarget * 1.6), CFG.camera.motionEase, dt);

    /* Integrate first, then bleed the velocity. The offsets are kept. */
    stirX = clamp(stirX + stirVX * dt, CFG.stir.pushLimit);
    stirY = clamp(stirY + stirVY * dt, CFG.stir.pushLimit);
    stirA = clamp(stirA + stirVA * dt, CFG.stir.swirlLimit);
    var bleed = Math.pow(CFG.stir.decay, dt);
    stirVX *= bleed;
    stirVY *= bleed;
    stirVA *= bleed;
    st.flowX = stirX;
    st.flowY = stirY;
    st.swirl = stirA;

    var top = mix3(LIGHT_TL, LIGHT_TR, st.lightX);
    var bot = mix3(LIGHT_BL, LIGHT_BR, st.lightX);
    st.lightCol = mix3(bot, top, st.lightY);

    /* Shafts belong to the hero. Past it the light keeps its colour but
       stops filling the frame, so the deep-space plates stay dark. */
    st.rayAmt = 1 - 0.5 * smoothstep(0, 0.22, st.scroll);

    updateOccluders();

    var p = paletteAt(scrollY);
    if (p) {
      var kc = 1 - Math.exp(-CFG.ease.palette * dt);
      st.c1 = mix3(st.c1, p.l1, kc);
      st.c2 = mix3(st.c2, p.l2, kc);
      st.c3 = mix3(st.c3, p.l3, kc);

      /* An iris stops down fast and opens back up slowly. That asymmetry is
         most of why this reads as a camera rather than a crossfade. */
      var k = p.exposure < st.exposure ? CFG.ease.exposureDown : CFG.ease.exposureUp;
      st.exposure = ease(st.exposure, p.exposure, k, dt);

      writeCss(p);
    }

    /* Off-axis distance drives the fringing, the way a real lens does. The
       shader scales this by distance-cubed, so single-digit thousandths
       already read as a few pixels of separation out at the corners. */
    var offAxis = Math.hypot(st.lightX - 0.5, st.lightY - 0.5) * 2;
    st.aberration = CFG.camera.aberrationBase + offAxis * CFG.camera.aberrationEdge + vel * CFG.camera.aberrationVel;
    st.flare = CFG.camera.flareBase + vel * CFG.camera.flareVel;
    st.vignette = CFG.camera.vignetteBase + st.scroll * CFG.camera.vignetteScroll;
    st.grain = CFG.camera.grainBase + (1 - Math.min(1, st.exposure)) * 0.05;

    /* The type is fringed by the same optics as the sky. Stepped, because a
       text-shadow that changes every frame repaints the whole headline. */
    var fringe = (st.lightX - 0.5) * (CFG.camera.fringePx + vel * 5) * (0.4 + offAxis * 0.8);
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
      if (watching && st.time > CFG.quality.warmupSeconds && raw < 0.2) {
        samples.push(raw);
        if (samples.length >= 32) {
          var sum = 0;
          for (var i = 4; i < samples.length; i++) { sum += samples[i]; }
          var mean = sum / (samples.length - 4);
          samples.length = 0;
          if (mean > CFG.quality.slowFrameMs / 1000) {
            if (!sky.degrade()) {
              /* Out of headroom. The CSS sky is better than a frozen page.
                 The loop stays alive — without GL it costs almost nothing,
                 and it still drives the palette as you scroll. */
              watching = false;
              sky = null;
              root.classList.add('no-webgl');
              console.warn('[sky] GPU cannot sustain the shader — using the CSS backdrop.');
            }
          } else if (mean < 0.020) {
            watching = false;
          }
        }
      }
    }

    if (running && !reduced) { requestAnimationFrame(frame); }
  }

  /* No visibility handling here on purpose. Browsers already throttle rAF to
     roughly a frame every few seconds for hidden pages, which is the whole
     benefit, and stopping the loop ourselves only adds a way to get stuck
     frozen after an occlusion event. */

  if (reduced) {
    /* One frame at rest, then repaint only when the palette should change. */
    requestAnimationFrame(frame);
    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) { return; }
      queued = true;
      requestAnimationFrame(function (t) { queued = false; frame(t); });
    }, { passive: true });
  } else {
    requestAnimationFrame(frame);
  }
})();
