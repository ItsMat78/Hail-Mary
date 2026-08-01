/* Three outputs from one entry:

   dist/vast-array.js       IIFE, readable, sets window.VastArray. This is the
                            drop-in, and the one the demo page loads — it has
                            to keep working from file://, which rules out ESM.
   dist/vast-array.min.js   the same, minified, for anyone serving it.
   dist/vast-array.mjs      ESM, for anyone with a bundler.

   dist/ is committed on purpose: the promise this repo makes is that you can
   double-click index.html and it works, and that cannot survive a build step
   standing between the clone and the page. */

import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

var pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
var banner = { js: '/*! ' + pkg.name + ' v' + pkg.version + ' */' };

var common = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['es2018'],
  charset: 'utf8',
  banner: banner,
  logLevel: 'info'
};

await esbuild.build({
  ...common,
  format: 'iife',
  globalName: 'VastArray',
  outfile: 'dist/vast-array.js'
});

await esbuild.build({
  ...common,
  format: 'iife',
  globalName: 'VastArray',
  minify: true,
  outfile: 'dist/vast-array.min.js'
});

await esbuild.build({
  ...common,
  format: 'esm',
  outfile: 'dist/vast-array.mjs'
});
