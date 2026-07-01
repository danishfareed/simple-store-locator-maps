/**
 * Standalone live-preview document for the widget editor iframe.
 *
 * Security model: this route serves ONLY static HTML — no admin auth, no data,
 * no secrets, and it accepts NO query params carrying data. Everything it needs
 * to render (the in-progress widget config + locations) is delivered at runtime
 * by the AUTHENTICATED parent editor over same-origin `postMessage`. Because it
 * ships no data and echoes nothing to other origins, it is safe to serve
 * unauthenticated. It must remain same-origin frameable, so we deliberately do
 * NOT set `X-Frame-Options` (the parent frames it from the same app origin).
 *
 * The bundle + stylesheet it loads (`/store-locator-preview.js` and `.css`) are
 * emitted by `scripts/build-extension.mjs` into `build/client/` and served by
 * the Cloudflare ASSETS binding at the app origin. A build must have run.
 */

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Widget preview</title>
    <link rel="stylesheet" href="/store-locator-preview.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #fff; }
      body { padding: 12px; box-sizing: border-box; }
      #ssl-preview-root { min-height: 320px; }
    </style>
  </head>
  <body>
    <div id="ssl-preview-root" class="simple-store-locator"></div>
    <script src="/store-locator-preview.js"></script>
    <script>
      (function () {
        var root = document.getElementById("ssl-preview-root");
        function render(msg) {
          if (!window.SSLPreview || !msg) return;
          window.SSLPreview.render(root, {
            widget: msg.widget,
            locations: msg.locations,
          });
        }
        window.addEventListener("message", function (e) {
          // Only act on our own message shape. We never echo data back out.
          if (e.data && e.data.type === "ssl-preview") render(e.data);
        });
        // Tell the parent we're ready to receive the config.
        try {
          window.parent.postMessage({ type: "ssl-preview-ready" }, "*");
        } catch (err) {}
      })();
    </script>
  </body>
</html>`;

export async function loader() {
  return new Response(HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // No caching of the shell while iterating; it's tiny and data-free.
      "cache-control": "no-store",
    },
  });
}
