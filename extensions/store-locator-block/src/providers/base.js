// Shared provider utilities + the provider interface contract.
//
// A "map provider" wraps a concrete mapping library (Leaflet, Google Maps) behind
// a small, uniform surface so views never touch the underlying SDK. Every
// provider factory (createLeafletProvider / createGoogleProvider) is async
// (it lazily loads its SDK) and resolves to an object implementing:
//
//   setView(center, zoom)                 -> void   center = {lat, lng}
//   addMarkers(locations, opts)           -> void   opts = { markerColor, onClick(loc) }
//   clearMarkers()                        -> void
//   fitBounds(locations)                  -> void   pan/zoom to enclose all coords
//   highlight(id)                         -> void   emphasise marker for location id, center it
//   on(evt, cb)                           -> void   "ready" | "moveend" | ...
//
// `locations` are the raw records from the proxy: { id, name, lat, lng, ... }.
// Providers ignore records missing lat/lng.

const scriptPromises = new Map();
const stylePromises = new Map();

/**
 * Inject a `<script src>` once (idempotent by URL) and resolve when it loads.
 * @param {string} url
 * @returns {Promise<void>}
 */
export function loadScript(url) {
  if (scriptPromises.has(url)) return scriptPromises.get(url);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ssl-src="${cssEscape(url)}"]`);
    if (existing && existing.dataset.sslLoaded === "true") {
      resolve();
      return;
    }

    const script = existing || document.createElement("script");
    if (!existing) {
      script.src = url;
      script.async = true;
      script.dataset.sslSrc = url;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      script.dataset.sslLoaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load script: ${url}`)),
    );
  });

  scriptPromises.set(url, promise);
  return promise;
}

/**
 * Inject a `<link rel=stylesheet>` once (idempotent by URL) and resolve on load.
 * Resolves even if the browser doesn't fire `load` for the stylesheet within a
 * short grace window, since CSS is non-blocking for our purposes.
 * @param {string} url
 * @returns {Promise<void>}
 */
export function loadStyle(url) {
  if (stylePromises.has(url)) return stylePromises.get(url);

  const promise = new Promise((resolve) => {
    if (document.querySelector(`link[data-ssl-href="${cssEscape(url)}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.sslHref = url;
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => resolve());
    document.head.appendChild(link);
    // Safety net: don't block map init on stylesheet load events.
    setTimeout(resolve, 1500);
  });

  stylePromises.set(url, promise);
  return promise;
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}
