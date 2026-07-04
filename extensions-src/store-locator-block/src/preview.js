// Admin live-preview entry (bundle entry, separate from the storefront `core.js`).
//
// Loaded ONLY by the standalone `/widget-preview` iframe route. It exposes a
// tiny global that the iframe's inline bootstrap calls whenever the authenticated
// admin parent posts a new config. There is NO fetching here — all data arrives
// via same-origin postMessage — and no `proxyBase`, so `renderWidget` runs the
// exact same view + provider code as the storefront while analytics stay a no-op.

import { renderWidget } from "./render.js";
import { clear } from "./lib/dom.js";

// Serialize renders so a rapid burst of config messages can't interleave two
// async provider setups into the same root. The latest requested render wins.
let renderSeq = 0;

/**
 * Clear `rootEl` and render `{ widget, locations }` into it (no proxyBase).
 *
 * Re-entrant safe: if called again mid-render, the earlier in-flight render is
 * abandoned before it can paint, so the last call always wins.
 *
 * @param {HTMLElement} rootEl
 * @param {{ widget: object, locations: Array<object> }} data
 */
async function render(rootEl, data) {
  if (!rootEl || !data || !data.widget) return;
  const seq = ++renderSeq;

  // Clear immediately so re-renders visibly replace prior content even before
  // an async provider resolves.
  clear(rootEl);

  try {
    await renderWidget(rootEl, {
      widget: data.widget,
      locations: Array.isArray(data.locations) ? data.locations : [],
      // No proxyBase in preview: analytics beacons become a no-op.
    });
  } catch (err) {
    if (seq !== renderSeq) return; // superseded — swallow
    console.warn("[store-locator-preview] render failed", err);
    return;
  }

  // A newer render started while this one was awaiting: discard our output.
  if (seq !== renderSeq) clear(rootEl);
}

window.SSLPreview = { render };
