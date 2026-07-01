// Leaflet map provider. Lazily loads Leaflet (and Leaflet.markercluster when
// clustering is enabled) from unpkg, then exposes the shared provider interface.

import { loadScript, loadStyle } from "./base.js";

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const CLUSTER_CSS = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
const CLUSTER_DEFAULT_CSS =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
const CLUSTER_JS =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * @param {{ el: HTMLElement, config: any }} args
 * @returns {Promise<object>} provider implementing the shared interface
 */
export async function createLeafletProvider({ el, config }) {
  const clustering = Boolean(config && config.clustering);

  await loadStyle(LEAFLET_CSS);
  await loadScript(LEAFLET_JS);
  if (clustering) {
    await Promise.all([loadStyle(CLUSTER_CSS), loadStyle(CLUSTER_DEFAULT_CSS)]);
    await loadScript(CLUSTER_JS);
  }

  const L = window.L;
  if (!L) throw new Error("Leaflet failed to initialise");

  const center = (config && config.defaultCenter) || { lat: 20, lng: 0 };
  const zoom = (config && config.defaultZoom) || 4;

  const map = L.map(el, { scrollWheelZoom: false, attributionControl: true }).setView(
    [center.lat, center.lng],
    zoom,
  );

  L.tileLayer((config && config.tileUrl) || DEFAULT_TILE_URL, {
    attribution: (config && config.attribution) || DEFAULT_ATTRIBUTION,
    maxZoom: 19,
  }).addTo(map);

  const markerLayer = clustering ? L.markerClusterGroup() : L.layerGroup();
  markerLayer.addTo(map);

  /** @type {Map<string, any>} id -> marker */
  const markersById = new Map();
  let activeMarker = null;

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeIcon(color) {
    const fill = color || "#2c6ecb";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">` +
      `<path d="M15 0C7 0 1 6 1 14c0 9.5 12 26 13.1 27.4a1.2 1.2 0 0 0 1.9 0C17 40 29 23.5 29 14 29 6 23 0 15 0z" ` +
      `fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>` +
      `<circle cx="15" cy="14" r="5" fill="#ffffff"/></svg>`;
    return L.divIcon({
      className: "ssl-leaflet-pin",
      html: svg,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -38],
    });
  }

  return {
    _lib: L,
    _map: map,

    setView(c, z) {
      if (!c) return;
      map.setView([c.lat, c.lng], z == null ? map.getZoom() : z, {
        animate: !prefersReducedMotion,
      });
    },

    addMarkers(locations, opts = {}) {
      const { markerColor, onClick } = opts;
      const icon = makeIcon(markerColor);
      (locations || []).forEach((loc) => {
        if (loc == null || loc.lat == null || loc.lng == null) return;
        const marker = L.marker([Number(loc.lat), Number(loc.lng)], { icon });
        if (typeof onClick === "function") {
          marker.on("click", () => onClick(loc));
        }
        marker.addTo(markerLayer);
        if (loc.id != null) markersById.set(String(loc.id), marker);
      });
    },

    clearMarkers() {
      markerLayer.clearLayers();
      markersById.clear();
      activeMarker = null;
    },

    fitBounds(locations) {
      const coords = (locations || [])
        .filter((l) => l && l.lat != null && l.lng != null)
        .map((l) => [Number(l.lat), Number(l.lng)]);
      if (!coords.length) return;
      if (coords.length === 1) {
        map.setView(coords[0], Math.max(map.getZoom(), 12), {
          animate: !prefersReducedMotion,
        });
        return;
      }
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 });
    },

    highlight(id) {
      const marker = markersById.get(String(id));
      if (activeMarker && activeMarker._icon) {
        activeMarker._icon.classList.remove("ssl-leaflet-pin--active");
      }
      if (!marker) return;
      activeMarker = marker;
      const ll = marker.getLatLng();
      map.setView([ll.lat, ll.lng], Math.max(map.getZoom(), 13), {
        animate: !prefersReducedMotion,
      });
      // Ensure clustered markers are spiderfied/visible before styling.
      if (typeof markerLayer.zoomToShowLayer === "function") {
        markerLayer.zoomToShowLayer(marker, () => {
          if (marker._icon) marker._icon.classList.add("ssl-leaflet-pin--active");
        });
      } else if (marker._icon) {
        marker._icon.classList.add("ssl-leaflet-pin--active");
      }
    },

    on(evt, cb) {
      if (evt === "ready") {
        cb();
        return;
      }
      map.on(evt, cb);
    },
  };
}
