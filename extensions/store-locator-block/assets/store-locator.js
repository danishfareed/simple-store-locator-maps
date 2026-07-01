/* global L */
(function () {
  "use strict";

  const nodes = document.querySelectorAll(".simple-store-locator");
  if (!nodes.length || typeof L === "undefined") return;

  nodes.forEach((root) => {
    const proxyBase = root.dataset.proxyBase;
    const handle = root.dataset.handle || "default";
    const initialZoom = Number(root.dataset.initialZoom) || 10;
    const mapEl = root.querySelector(".simple-store-locator__map");
    const resultsEl = root.querySelector(".simple-store-locator__results");
    const form = root.querySelector("form");

    const map = L.map(mapEl).setView([0, 0], 2);
    let tileLayer;
    const markerLayer = L.layerGroup().addTo(map);

    fetch(`${proxyBase}/widget.json?handle=${encodeURIComponent(handle)}`, {
      credentials: "omit",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(({ widget }) => {
        if (widget?.providerMeta?.tileUrl) {
          tileLayer = L.tileLayer(widget.providerMeta.tileUrl, {
            attribution: widget.providerMeta.attribution,
            maxZoom: 19,
          }).addTo(map);
        }
        const c = widget?.config?.defaultCenter;
        map.setView([c?.lat ?? 20, c?.lng ?? 0], widget?.config?.defaultZoom ?? initialZoom);
        return fetch(`${proxyBase}/locations.json`, { credentials: "omit" });
      })
      .then((r) => r.json())
      .then(({ locations }) => {
        renderList(locations);
        renderMarkers(locations);
      })
      .catch((err) => {
        console.warn("[store-locator] load failed", err);
        resultsEl.innerHTML =
          '<li><p>Unable to load locations. Please try again later.</p></li>';
      });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = new FormData(form).get("q");
      if (!q) return;
      try {
        const geo = await geocode(String(q));
        if (!geo) return;
        map.setView([geo.lat, geo.lng], 12);
        const params = new URLSearchParams({
          lat: String(geo.lat),
          lng: String(geo.lng),
          q: String(q),
          radiusKm: "50",
        });
        const r = await fetch(`${proxyBase}/search.json?${params}`, {
          credentials: "omit",
        });
        const { results } = await r.json();
        renderList(results);
        renderMarkers(results);
      } catch (err) {
        console.warn("[store-locator] search failed", err);
      }
    });

    resultsEl.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-lat]");
      if (!li) return;
      map.setView([Number(li.dataset.lat), Number(li.dataset.lng)], 14);
    });

    function renderList(items) {
      resultsEl.innerHTML = items.length
        ? items
            .map(
              (l) => `
                <li data-lat="${l.lat ?? ""}" data-lng="${l.lng ?? ""}">
                  <h4>${escapeHtml(l.name)}</h4>
                  <p>${escapeHtml([l.city, l.region, l.countryCode].filter(Boolean).join(", "))}</p>
                  ${typeof l.distanceKm === "number" ? `<p>${l.distanceKm.toFixed(1)} km away</p>` : ""}
                </li>`,
            )
            .join("")
        : '<li><p>No locations found.</p></li>';
    }

    function renderMarkers(items) {
      markerLayer.clearLayers();
      items.forEach((l) => {
        if (l.lat == null || l.lng == null) return;
        L.marker([l.lat, l.lng])
          .bindPopup(
            `<strong>${escapeHtml(l.name)}</strong><br>${escapeHtml(
              [l.city, l.region].filter(Boolean).join(", "),
            )}`,
          )
          .addTo(markerLayer);
      });
    }
  });

  async function geocode(q) {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
    );
    const hits = await r.json();
    return hits[0] ? { lat: Number(hits[0].lat), lng: Number(hits[0].lon) } : null;
  }

  function escapeHtml(v) {
    return String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
    );
  }
})();
