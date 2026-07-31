/* VAST ARRAY — the renderer.
   Owns the WebGL context, three programs and three framebuffers, and draws
   one frame when asked. It holds no input state; main.js feeds it. */

window.VA_SKY = (function () {
  'use strict';

  var S = window.VA_SHADERS;

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

  function program(gl, fragSrc, label) {
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

  function create(canvas) {
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

    var progScene = program(gl, S.SCENE, 'scene');
    var progBlur = program(gl, S.BLUR, 'blur');
    var progComp = program(gl, S.COMPOSITE, 'composite');
    if (!progScene || !progBlur || !progComp) { return null; }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var scene = null, blurA = null, blurB = null;
    var scale = Math.min(window.devicePixelRatio || 1, 2) * 0.72;
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
      [scene, blurA, blurB].forEach(function (t) {
        if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
      });
      var w = Math.max(2, Math.floor(vw * scale));
      var h = Math.max(2, Math.floor(vh * scale));
      var bw = Math.max(2, Math.floor(w * 0.25));
      var bh = Math.max(2, Math.floor(h * 0.25));
      scene = makeTarget(gl, w, h);
      blurA = makeTarget(gl, bw, bh);
      blurB = makeTarget(gl, bw, bh);
    }

    function resize(cssW, cssH) {
      vw = Math.max(1, cssW);
      vh = Math.max(1, cssH);
      /* The composite runs at the drawing-buffer size, so this is the most
         expensive number on the page. 1.5x is past the point where grain and
         flare read any sharper. */
      var dpr = Math.min(window.devicePixelRatio || 1, software ? 1 : 1.5);
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
    }

    function render(s) {
      var u;

      /* The composite leaves scene.tex bound to a sampler. Drawing into it
         next frame while it is still bound is a feedback loop, and ANGLE
         resolves those by copying the texture on every draw — which is what
         turned a 2ms frame into a multi-second one. Clear the units first. */
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

      /* 5. composite to the screen */
      pass(null, progComp);
      u = progComp.u;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.tex);
      gl.uniform1i(u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
      gl.uniform1i(u.uBloom, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, s.time);
      gl.uniform2f(u.uLight, s.lightX, s.lightY);
      gl.uniform1f(u.uExposure, s.exposure);
      gl.uniform1f(u.uAberration, s.aberration);
      gl.uniform1f(u.uGrain, s.grain);
      gl.uniform1f(u.uVignette, s.vignette);
      gl.uniform1f(u.uFlare, s.flare);
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
      scale = Math.max(0.18, scale * 0.68);
      allocate();
      return true;
    }

    return {
      gl: gl,
      resize: resize,
      render: render,
      degrade: degrade,
      renderer: renderer,
      isSoftware: software
    };
  }

  return { create: create };
})();
