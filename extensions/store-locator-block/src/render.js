// Shared "render a widget into an element" logic.
//
// Extracted from `core.js` so BOTH the storefront bootstrap and the admin live
// preview render through exactly the same view + provider code path. The only
// difference is where the data comes from:
//   - storefront (`core.js`): fetches {widget, locations} from the app proxy,
//     passes a real `proxyBase` so analytics beacons fire.
//   - admin preview (`preview.js`): is handed {widget, locations} directly over
//     postMessage, with no `proxyBase` — so `track` becomes a no-op.
//
// This module owns NO fetching and NO DOM discovery; the caller supplies the
// root element and the already-resolved data.

import { haversineKm, sortByDistance, formatDistance } from "./lib/geo.js";
import { escapeHtml, el, clear } from "./lib/dom.js";
import { geocode } from "./lib/geocode.js";
import { track } from "./lib/analytics.js";
import { createLeafletProvider } from "./providers/leaflet.js";
import { createGoogleProvider } from "./providers/google.js";
import { renderMapList } from "./views/mapList.js";
import { renderFinder } from "./views/finder.js";
import { renderCarousel } from "./views/carousel.js";
import { renderList } from "./views/list.js";
import { renderSingle } from "./views/single.js";

// Pure, client-safe utilities shared with the admin (type-only TS imports).
import { isOpenNow } from "../../../app/lib/utils/hours";
import { directionsUrl } from "../../../app/lib/utils/directions";

/** View registry keyed by widget.type. Unknown types fall back to Map+List. */
export const VIEWS = {
  map_list: renderMapList,
  finder: renderFinder,
  carousel: renderCarousel,
  list: renderList,
  single: renderSingle,
};

/**
 * Render a fully-resolved widget into `root`.
 *
 * Picks the map provider (Google when configured + keyed, else Leaflet, with a
 * Leaflet fallback if Google fails), looks up the view for `widget.type`, builds
 * the view context, and hands it off. Clears `root` first.
 *
 * @param {HTMLElement} root  the `.simple-store-locator` container.
 * @param {object} opts
 * @param {object} opts.widget     the widget definition (type, provider, config,
 *                                  timezone, showPoweredBy, googleMapsApiKey).
 * @param {Array<object>} opts.locations  location records to render.
 * @param {string} [opts.proxyBase]  app-proxy base for analytics. When absent
 *                                   (preview), analytics are a no-op.
 */
export async function renderWidget(root, { widget, locations, proxyBase }) {
  const base = (proxyBase || "").replace(/\/$/, "");
  const config = widget.config || {};
  const locs = Array.isArray(locations) ? locations : [];

  applyTheme(root, config.theme);

  // Map provider container lives inside the view; we provide a detached node the
  // view mounts where it wants, then initialise the provider on it.
  clear(root);
  const shell = el("div", {
    class: "ssl",
    dataset: { view: widget.type || "map_list" },
  });
  root.appendChild(shell);

  const mapEl = el("div", {
    class: "ssl-map",
    role: "region",
    "aria-label": "Map of locations",
  });

  // The List/Grid view is map-less, and a Carousel without a mini-map has no
  // map to render either: don't load a map SDK it will never use.
  const skipProvider =
    widget.type === "list" ||
    (widget.type === "carousel" && !config.showMiniMap);
  const provider = skipProvider
    ? null
    : await createProvider({ el: mapEl, widget, config });

  // Analytics no-op when there's no proxy base (preview): `track` already
  // short-circuits on a falsy base, so this just forwards it.
  const trackBound = (type, payload) => track(base, type, payload);
  const geocodeBound = (query) =>
    geocode(query, {
      provider: widget.provider,
      apiKey: widget.googleMapsApiKey,
      osmGeocoderUrl: config.osmGeocoderUrl,
    });

  const ctx = {
    provider,
    mapEl,
    locations: locs,
    widget,
    config,
    proxyBase: base,
    track: trackBound,
    geocode: geocodeBound,
    helpers: {
      haversineKm,
      sortByDistance,
      formatDistance,
      escapeHtml,
      el,
      clear,
      isOpenNow,
      directionsUrl,
    },
  };

  const render = VIEWS[widget.type] || VIEWS.map_list;
  render(shell, ctx);

  if (widget.showPoweredBy) {
    root.appendChild(renderPoweredBy());
  }
}

/**
 * Pick and construct the map provider. Prefers Google when the widget is
 * configured for it AND a key is present; otherwise Leaflet. If Google fails to
 * initialise (bad key, blocked SDK), transparently fall back to Leaflet.
 */
export async function createProvider({ el: mapEl, widget, config }) {
  const wantsGoogle =
    widget.provider === "google" && Boolean(widget.googleMapsApiKey);
  if (wantsGoogle) {
    try {
      return await createGoogleProvider({
        el: mapEl,
        config,
        apiKey: widget.googleMapsApiKey,
      });
    } catch (err) {
      console.warn(
        "[store-locator] Google Maps failed, falling back to Leaflet",
        err,
      );
    }
  }
  return createLeafletProvider({ el: mapEl, config });
}

/**
 * Map `config.theme` onto CSS custom properties on the root. Unset values fall
 * through to the stylesheet defaults.
 */
export function applyTheme(root, theme) {
  if (!theme || typeof theme !== "object") return;
  const map = {
    primaryColor: "--ssl-accent",
    markerColor: "--ssl-marker",
    backgroundColor: "--ssl-bg",
    textColor: "--ssl-text",
  };
  for (const [key, cssVar] of Object.entries(map)) {
    if (theme[key]) root.style.setProperty(cssVar, String(theme[key]));
  }
  // Marker defaults to accent when not separately set.
  if (theme.primaryColor && !theme.markerColor) {
    root.style.setProperty("--ssl-marker", String(theme.primaryColor));
  }
  if (theme.fontFamily) {
    root.style.setProperty("--ssl-font", String(theme.fontFamily));
    root.style.fontFamily = String(theme.fontFamily);
  }
}

export function renderPoweredBy() {
  return el(
    "div",
    { class: "ssl-powered" },
    "Powered by ",
    el(
      "a",
      {
        href: "https://apps.shopify.com/",
        target: "_blank",
        rel: "noopener noreferrer",
      },
      "Simple Store Locator",
    ),
  );
}
