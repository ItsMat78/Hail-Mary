/* VAST ARRAY — the renderer.
   Owns the WebGL context, five programs and five framebuffers, and draws one
   frame when asked. It holds no input state; mount.js feeds it. */

import { build } from './shaders.js';

function compile(gl, type, src, label) {
  var sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[sky] ' + label + ' failed to compile:\n' + gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function program(gl, S, fragSrc, label) {
  var vs = compile(gl, gl.VERTEX_SHADER, S.VERT, label + ':vert');
  var fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc, label + ':frag');
  if (!vs || !fs) { return null; }
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[sky] ' + label + ' failed to link:\n' + gl.getProgramInfoLog(p));
    return null;
  }
  /* Cache every active uniform up front so the draw path never queries. */
  p.u = {};
  var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (var i = 0; i < n; i++) {
    var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    p.u[name] = gl.getUniformLocation(p, name);
  }
  return p;
}

/* The mask blit needs its own vertex shader, so it cannot go through
   program(), which pairs everything with the fullscreen-triangle vertex. */
function quadProgram(gl, S) {
  var vs = compile(gl, gl.VERTEX_SHADER, S.QUAD_VERT, 'quad:vert');
  var fs = compile(gl, gl.FRAGMENT_SHADER, S.QUAD_FRAG, 'quad:frag');
  if (!vs || !fs) { return null; }
  var p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[sky] quad failed to link:\n' + gl.getProgramInfoLog(p));
    return null;
  }
  p.u = {
    uDst: gl.getUniformLocation(p, 'uDst'),
    uSrc: gl.getUniformLocation(p, 'uSrc'),
    uTex: gl.getUniformLocation(p, 'uTex')
  };
  return p;
}

function makeTarget(gl, w, h) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  /* Non-power-of-two, so clamp and no mips. */
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  var fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex: tex, fbo: fbo, w: w, h: h };
}

/* The renderer is created against one config and bakes its glsl/glslInt block
   into the programs. Changing those means a new renderer, which is what
   mount()'s setConfig does. */
export function create(canvas, cfg) {
  var opts = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  };
  var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) { return null; }

  var S = build(cfg);
  var progQuad = quadProgram(gl, S);
  var progScene = program(gl, S, S.SCENE, 'scene');
  var progBlur = program(gl, S, S.BLUR, 'blur');
  var progRays = program(gl, S, S.RAYS, 'rays');
  var progComp = program(gl, S, S.COMPOSITE, 'composite');
  if (!progQuad || !progScene || !progBlur || !progRays || !progComp) { return null; }

  /* Two geometries: a fullscreen triangle for the image passes, and a unit
     quad for stamping headings into the mask. */
  var triBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  var boundBuf = null;
  function useGeom(buf) {
    if (boundBuf === buf) { return; }
    boundBuf = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  var scene = null, blurA = null, blurB = null, rays = null, mask = null;

  /* The atlas: every heading rasterised once, packed into one texture.
     Starts as a single transparent pixel so the passes are valid before the
     fonts have landed and the first rasterisation has happened. */
  var atlasTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  /* Canvas rows run downward and GL texture rows run upward. */
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

  /* A software rasteriser will run this shader at seconds per frame, which
     looks identical to a hung page. Start it at the bottom of the quality
     range rather than discovering that over the first few seconds. */
  var dbg = gl.getExtension('WEBGL_debug_renderer_info');
  var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  var software = /swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(renderer);
  if (software) {
    scale = 0.30;
    lowQ = 1;
    steps = 1;
    console.warn('[sky] software renderer (' + renderer + ') — starting at reduced quality.');
  }

  function allocate() {
    [scene, blurA, blurB, rays, mask].forEach(function (t) {
      if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    });
    var w = Math.max(2, Math.floor(vw * scale));
    var h = Math.max(2, Math.floor(vh * scale));
    var bw = Math.max(2, Math.floor(w * 0.25));
    var bh = Math.max(2, Math.floor(h * 0.25));
    scene = makeTarget(gl, w, h);
    blurA = makeTarget(gl, bw, bh);
    blurB = makeTarget(gl, bw, bh);
    /* Shafts are soft, so half res upsamples without showing seams. The
       mask matches the ray buffer so the lookup is 1:1. */
    var rw = Math.max(2, Math.floor(w * 0.5));
    var rh = Math.max(2, Math.floor(h * 0.5));
    rays = makeTarget(gl, rw, rh);
    mask = makeTarget(gl, rw, rh);
  }

  function resize(cssW, cssH) {
    vw = Math.max(1, cssW);
    vh = Math.max(1, cssH);
    /* The composite runs at the drawing-buffer size, so this is the most
       expensive number on the page. 1.5x is past the point where grain and
       flare read any sharper. */
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

    /* The composite leaves scene.tex bound to a sampler. Drawing into it
       next frame while it is still bound is a feedback loop, and ANGLE
       resolves those by copying the texture on every draw — which is what
       turned a 2ms frame into a multi-second one. Clear the units first. */
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    /* 1. scene */
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

    /* 2. bright pass + horizontal blur */
    pass(blurA, progBlur);
    u = progBlur.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 1.6 / blurA.w, 0);
    gl.uniform1f(u.uThreshold, 0.52);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* 3. vertical blur */
    pass(blurB, progBlur);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 0, 1.6 / blurB.h);
    gl.uniform1f(u.uThreshold, -1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* 4. second, wider blur so the halo has both a core and a spread */
    pass(blurA, progBlur);
    gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 3.4 / blurA.w, 0);
    gl.uniform1f(u.uThreshold, -1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    pass(blurB, progBlur);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 0, 3.4 / blurB.h);
    gl.uniform1f(u.uThreshold, -1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* 5. stamp every visible heading into the viewport-space mask */
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

    /* 6. volumetric light, with those headings blocking it */
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

    /* 7. composite to the screen */
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

  /* Step down when the GPU cannot keep up. Bounded — after three steps
     there is nothing left worth trying and the caller should give up on
     WebGL entirely rather than keep shrinking the buffer. */
  function degrade() {
    if (steps >= 3) { return false; }
    steps++;
    lowQ = 1;
    console.warn('[sky] frames are slow — stepping quality down (' + steps + '/3).');
    scale = Math.max(0.18, scale * 0.68);
    allocate();
    return true;
  }

  /* Give everything back. A page that mounts and unmounts repeatedly — a
     route change, a hot reload — would otherwise leak a context per mount,
     and browsers cap how many live WebGL contexts they will hand out before
     they start killing the oldest ones. */
  function dispose() {
    [scene, blurA, blurB, rays, mask].forEach(function (t) {
      if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    });
    scene = blurA = blurB = rays = mask = null;
    gl.deleteTexture(atlasTex);
    gl.deleteBuffer(triBuf);
    gl.deleteBuffer(quadBuf);
    [progQuad, progScene, progBlur, progRays, progComp].forEach(function (p) {
      if (p) { gl.deleteProgram(p); }
    });
    var lose = gl.getExtension('WEBGL_lose_context');
    if (lose) { lose.loseContext(); }
  }

  return {
    gl: gl,
    resize: resize,
    render: render,
    degrade: degrade,
    setAtlas: setAtlas,
    dispose: dispose,
    renderer: renderer,
    isSoftware: software
  };
}
