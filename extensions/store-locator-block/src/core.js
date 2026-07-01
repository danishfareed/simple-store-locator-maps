// Storefront widget bootstrap (bundle entry).
//
// For every `.simple-store-locator` root on the page: read its data-* config,
// fetch the widget definition + locations from the app proxy, pick a map
// provider (Google when configured + keyed, else Leaflet, with a Leaflet
// fallback if Google fails), look up the view module for the widget type, and
// hand it a fully-wired context.

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
const VIEWS = {
  map_list: renderMapList,
  finder: renderFinder,
  carousel: renderCarousel,
  list: renderList,
  single: renderSingle,
};

function boot() {
  const roots = document.querySelectorAll(".simple-store-locator");
  roots.forEach((root) => {
    if (root.dataset.sslBooted === "true") return;
    root.dataset.sslBooted = "true";
    initWidget(root).catch((err) => {
      console.warn("[store-locator] init failed", err);
      renderError(root);
    });
  });
}

async function initWidget(root) {
  const proxyBase = (root.dataset.proxyBase || "").replace(/\/$/, "");
  const handle = root.dataset.handle || "default";
  if (!proxyBase) throw new Error("Missing data-proxy-base");

  renderLoading(root);

  const widget = await fetchJson(
    `${proxyBase}/widget?handle=${encodeURIComponent(handle)}`,
  ).then((data) => data && data.widget);
  if (!widget) throw new Error("Widget not available");

  const locations = await fetchJson(`${proxyBase}/locations`).then((data) =>
    Array.isArray(data && data.locations) ? data.locations : [],
  );

  const config = widget.config || {};
  applyTheme(root, config.theme);

  // Map provider container lives inside the view; core provides a detached node
  // the view mounts where it wants, then core initialises the provider on it.
  clear(root);
  const shell = el("div", { class: "ssl", dataset: { view: widget.type || "map_list" } });
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

  const trackBound = (type, payload) => track(proxyBase, type, payload);
  const geocodeBound = (query) =>
    geocode(query, {
      provider: widget.provider,
      apiKey: widget.googleMapsApiKey,
      osmGeocoderUrl: config.osmGeocoderUrl,
    });

  const ctx = {
    provider,
    mapEl,
    locations,
    widget,
    config,
    proxyBase,
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
async function createProvider({ el: mapEl, widget, config }) {
  const wantsGoogle = widget.provider === "google" && Boolean(widget.googleMapsApiKey);
  if (wantsGoogle) {
    try {
      return await createGoogleProvider({
        el: mapEl,
        config,
        apiKey: widget.googleMapsApiKey,
      });
    } catch (err) {
      console.warn("[store-locator] Google Maps failed, falling back to Leaflet", err);
    }
  }
  return createLeafletProvider({ el: mapEl, config });
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

/**
 * Map `config.theme` onto CSS custom properties on the root. Unset values fall
 * through to the stylesheet defaults.
 */
function applyTheme(root, theme) {
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

function renderLoading(root) {
  clear(root);
  const skeletons = Array.from({ length: 4 }, () =>
    el("div", { class: "ssl-skeleton-card", "aria-hidden": "true" }),
  );
  root.appendChild(
    el(
      "div",
      { class: "ssl ssl--loading", role: "status", "aria-label": "Loading locations" },
      el("div", { class: "ssl-sidebar" }, ...skeletons),
      el("div", { class: "ssl-map ssl-map--loading" }),
    ),
  );
}

function renderError(root) {
  clear(root);
  root.appendChild(
    el(
      "div",
      { class: "ssl ssl--error", role: "alert" },
      el(
        "div",
        { class: "ssl-state" },
        el("p", { class: "ssl-state__title" }, "Couldn't load locations."),
        el("p", { class: "ssl-state__body" }, "Please try again."),
      ),
    ),
  );
}

function renderPoweredBy() {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
