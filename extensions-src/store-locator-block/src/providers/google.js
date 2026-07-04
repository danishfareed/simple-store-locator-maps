// Google Maps provider. Lazily loads the Google Maps JS SDK with the merchant's
// API key and (when clustering) a MarkerClusterer CDN build. Implements the same
// interface as the Leaflet provider. Throws on SDK load failure so core.js can
// fall back to Leaflet.

import { loadScript } from "./base.js";

const CLUSTERER_JS =
  "https://unpkg.com/@googlemaps/markerclusterer@2.5.3/dist/index.min.js";

/**
 * @param {{ el: HTMLElement, config: any, apiKey: string }} args
 * @returns {Promise<object>} provider implementing the shared interface
 */
export async function createGoogleProvider({ el, config, apiKey }) {
  if (!apiKey) throw new Error("Google Maps requires an API key");

  await loadGoogleSdk(apiKey);
  const google = window.google;
  if (!google || !google.maps) throw new Error("Google Maps SDK failed to load");

  const clustering = Boolean(config && config.clustering);
  if (clustering) {
    // Non-fatal: clustering degrades to plain markers if the CDN is unavailable.
    try {
      await loadScript(CLUSTERER_JS);
    } catch {
      /* ignore */
    }
  }

  const center = (config && config.defaultCenter) || { lat: 20, lng: 0 };
  const zoom = (config && config.defaultZoom) || 4;

  const map = new google.maps.Map(el, {
    center: { lat: center.lat, lng: center.lng },
    zoom,
    scrollwheel: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
  });

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** @type {Array<any>} */
  let markers = [];
  /** @type {Map<string, any>} */
  const markersById = new Map();
  let clusterer = null;
  let activeMarker = null;
  let baseColor = "#2c6ecb";

  function pinSymbol(color, scale) {
    return {
      path: "M15 0C7 0 1 6 1 14c0 9.5 12 26 13.1 27.4a1.2 1.2 0 0 0 1.9 0C17 40 29 23.5 29 14 29 6 23 0 15 0z",
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.5,
      scale: scale || 1,
      anchor: new google.maps.Point(15, 42),
    };
  }

  function setClusterMarkers() {
    const Clusterer = window.markerClusterer && window.markerClusterer.MarkerClusterer;
    if (!clustering || !Clusterer) return;
    if (clusterer) clusterer.clearMarkers();
    clusterer = new Clusterer({ map, markers });
  }

  return {
    _lib: google,
    _map: map,

    setView(c, z) {
      if (!c) return;
      map.setCenter({ lat: c.lat, lng: c.lng });
      if (z != null) map.setZoom(z);
    },

    addMarkers(locations, opts = {}) {
      const { markerColor, onClick } = opts;
      baseColor = markerColor || baseColor;
      (locations || []).forEach((loc) => {
        if (loc == null || loc.lat == null || loc.lng == null) return;
        const marker = new google.maps.Marker({
          position: { lat: Number(loc.lat), lng: Number(loc.lng) },
          icon: pinSymbol(baseColor, 1),
          title: loc.name || "",
          map: clustering ? null : map,
        });
        if (typeof onClick === "function") {
          marker.addListener("click", () => onClick(loc));
        }
        markers.push(marker);
        if (loc.id != null) markersById.set(String(loc.id), marker);
      });
      setClusterMarkers();
    },

    clearMarkers() {
      if (clusterer) clusterer.clearMarkers();
      markers.forEach((m) => m.setMap(null));
      markers = [];
      markersById.clear();
      activeMarker = null;
    },

    fitBounds(locations) {
      const coords = (locations || []).filter(
        (l) => l && l.lat != null && l.lng != null,
      );
      if (!coords.length) return;
      if (coords.length === 1) {
        map.setCenter({ lat: Number(coords[0].lat), lng: Number(coords[0].lng) });
        map.setZoom(Math.max(map.getZoom() || 0, 12));
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      coords.forEach((l) =>
        bounds.extend({ lat: Number(l.lat), lng: Number(l.lng) }),
      );
      map.fitBounds(bounds, 48);
    },

    highlight(id) {
      if (activeMarker) activeMarker.setIcon(pinSymbol(baseColor, 1));
      const marker = markersById.get(String(id));
      if (!marker) return;
      activeMarker = marker;
      marker.setIcon(pinSymbol(baseColor, 1.35));
      const pos = marker.getPosition();
      if (pos) {
        if (prefersReducedMotion) {
          map.setCenter(pos);
        } else {
          map.panTo(pos);
        }
        map.setZoom(Math.max(map.getZoom() || 0, 13));
      }
    },

    on(evt, cb) {
      if (evt === "ready") {
        cb();
        return;
      }
      const map_evt = evt === "moveend" ? "idle" : evt;
      map.addListener(map_evt, cb);
    },
  };
}

function loadGoogleSdk(apiKey) {
  if (window.google && window.google.maps) return Promise.resolve();
  const url =
    "https://maps.googleapis.com/maps/api/js" +
    `?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`;
  return loadScript(url).then(() => {
    // The JS API may still be initialising `google.maps` after the script load
    // event; poll briefly for readiness.
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (window.google && window.google.maps) return resolve();
        if (Date.now() - start > 5000) return reject(new Error("Google Maps timeout"));
        setTimeout(check, 50);
      })();
    });
  });
}
