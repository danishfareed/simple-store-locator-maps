// List / Grid view.
//
// A responsive CSS grid of location cards with NO map (config.columns 1–4,
// default 3). Each card: image (if imageUrl), name, address, open-now pill, and
// a "View on map" link (config.showMapLink, default true) that opens the Google
// Maps directions deep link in a new tab. Never touches ctx.provider — core.js
// skips provider creation for this view entirely.

import {
  formatAddress,
  buildOpenPill,
  buildActions,
  buildCardImage,
} from "./shared.js";

const DEFAULT_COLUMNS = 3;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 4;

/**
 * @param {HTMLElement} shell  the `.ssl` container from core.js
 * @param {object} ctx         { provider: null, locations, widget, config,
 *                               proxyBase, track, helpers }
 */
export function renderList(shell, ctx) {
  const { locations, widget, config, track, helpers } = ctx;
  const { el, clear, isOpenNow, directionsUrl } = helpers;

  const timezone = widget.timezone || undefined;
  const showDirections = config.showDirections !== false;
  const showPhone = config.showPhone !== false;
  const showMapLink = config.showMapLink !== false;
  const columns = clampColumns(config.columns);

  clear(shell);

  if (!locations.length) {
    shell.appendChild(
      el(
        "div",
        { class: "ssl-empty" },
        el("p", null, "No locations found — try a wider search."),
      ),
    );
    return;
  }

  const grid = el("ul", {
    class: "ssl-list",
    "aria-label": "Locations",
    style: { "--ssl-columns": String(columns) },
  });

  const now = new Date();
  locations.forEach((loc) => grid.appendChild(buildCard(loc, now)));
  shell.appendChild(grid);

  function buildCard(loc, whenNow) {
    const addr = formatAddress(loc);
    const open = isOpenNow(loc.hours, whenNow, timezone);

    const meta = el("div", { class: "ssl-card__meta" }, buildOpenPill(el, open));

    const actions = buildActions({
      el,
      directionsUrl,
      track,
      loc,
      showDirections,
      showPhone,
    });

    // "View on map" deep link — opens Google Maps in a new tab.
    let mapLink = null;
    if (showMapLink && loc.lat != null && loc.lng != null) {
      mapLink = el(
        "a",
        {
          class: "ssl-list__maplink",
          href: directionsUrl({ lat: Number(loc.lat), lng: Number(loc.lng) }, "google"),
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: () => track("directions", { locationId: String(loc.id) }),
        },
        "View on map",
      );
    }

    return el(
      "li",
      { class: "ssl-card ssl-list__card", dataset: { id: String(loc.id) } },
      buildCardImage(el, loc),
      el("h3", { class: "ssl-card__name" }, loc.name || "Location"),
      addr ? el("p", { class: "ssl-card__addr" }, addr) : null,
      meta,
      actions,
      mapLink,
    );
  }
}

function clampColumns(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_COLUMNS;
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(n)));
}
