// Storefront widget bootstrap (bundle entry).
//
// For every `.simple-store-locator` root on the page: read its data-* config,
// fetch the widget definition + locations from the app proxy, then hand them to
// the shared `renderWidget` (which picks the map provider, looks up the view for
// the widget type, and wires the context). The render logic is shared with the
// admin live preview via `render.js` — the only difference here is that we fetch
// the data and pass a real `proxyBase` so analytics beacons fire.

import { el, clear } from "./lib/dom.js";
import { renderWidget } from "./render.js";

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

  await renderWidget(root, { widget, locations, proxyBase });
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
