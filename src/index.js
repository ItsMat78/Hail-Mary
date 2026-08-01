/* VAST ARRAY — public entry.

   Two ways in:

     <script src="vast-array.js" data-auto></script>
       mounts on DOMContentLoaded against the default selectors. Zero JS on
       the consumer's side; add `data-canvas="#id"` to aim it at a specific
       canvas, or leave it and one gets created.

     VastArray.mount({ ... })  /  import { mount } from 'vast-array'
       everything else.

   `document.currentScript` is only meaningful while a classic script is
   executing, which is exactly when the bundled build runs — so the auto-init
   block below is inert in the ESM build, where the consumer is calling
   mount() anyway. */

import defaults from './defaults.js';
import { mount } from './mount.js';

export { mount, defaults };

var self = typeof document !== 'undefined' ? document.currentScript : null;

if (self && self.hasAttribute('data-auto')) {
  var boot = function () {
    mount({ canvas: self.getAttribute('data-canvas') || undefined });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
