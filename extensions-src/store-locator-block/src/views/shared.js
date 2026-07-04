// Shared building blocks for the storefront views.
//
// Extracted from the flagship Map+List view so finder/carousel/list/single stay
// visually + structurally consistent: the same store card, open-now pill,
// distance chip, action buttons, address formatting, and inline icons. All DOM
// is built with `helpers.el(...)` (text children auto-escape — never innerHTML
// with location data).

/**
 * Join a location's address parts into a single readable line.
 * @param {object} loc
 * @returns {string}
 */
export function formatAddress(loc) {
  return [loc.addressLine1, loc.city, loc.region, loc.postalCode, loc.countryCode]
    .filter(Boolean)
    .join(", ");
}

/**
 * Open-now pill (dot + label). Green "Open now" / amber "Opens 9:00" / grey
 * "Closed", derived from the isOpenNow result.
 * @param {(tag: string, attrs?: object, ...children: any[]) => Node} el
 * @param {{ open: boolean, label: string }} open
 */
export function buildOpenPill(el, open) {
  const state = open.open ? "open" : /^Opens/.test(open.label) ? "soon" : "closed";
  return el(
    "span",
    { class: `ssl-pill ssl-pill--${state}` },
    el("span", { class: "ssl-pill__dot", "aria-hidden": "true" }),
    el("span", null, open.label),
  );
}

/**
 * Distance chip ("2.4 km" / "1.5 mi"). Returns null when no distance is known.
 */
export function buildDistanceChip(el, formatDistance, distanceKm, unitSystem) {
  if (distanceKm == null) return null;
  return el(
    "span",
    { class: "ssl-chip ssl-chip--distance" },
    formatDistance(distanceKm, unitSystem),
  );
}

/**
 * Directions/Call action buttons row. Returns null when nothing renders.
 * @param {object} opts { el, directionsUrl, track, loc, showDirections, showPhone }
 */
export function buildActions(opts) {
  const { el, directionsUrl, track, loc, showDirections, showPhone } = opts;
  const actions = el("div", { class: "ssl-card__actions" });

  if (showDirections && loc.lat != null && loc.lng != null) {
    actions.appendChild(
      el(
        "a",
        {
          class: "ssl-btn ssl-btn--primary",
          href: directionsUrl({ lat: Number(loc.lat), lng: Number(loc.lng) }, "google"),
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: (e) => {
            e.stopPropagation();
            track("directions", { locationId: String(loc.id) });
          },
        },
        iconRoute(el),
        el("span", null, "Get directions"),
      ),
    );
  }

  if (showPhone && loc.phone) {
    actions.appendChild(
      el(
        "a",
        {
          class: "ssl-btn ssl-btn--ghost",
          href: `tel:${String(loc.phone).replace(/\s+/g, "")}`,
          onClick: (e) => {
            e.stopPropagation();
            track("call", { locationId: String(loc.id) });
          },
        },
        iconPhone(el),
        el("span", null, "Call"),
      ),
    );
  }

  return actions.childNodes.length ? actions : null;
}

/**
 * Optional card image. Returns null when the location has no `imageUrl`.
 */
export function buildCardImage(el, loc) {
  if (!loc.imageUrl) return null;
  return el(
    "div",
    { class: "ssl-card__media" },
    el("img", {
      class: "ssl-card__img",
      src: String(loc.imageUrl),
      alt: loc.name ? `${loc.name}` : "Location",
      loading: "lazy",
      decoding: "async",
    }),
  );
}

// ---- inline icons (small, currentColor) -----------------------------------
export function svg(el, attrs, ...children) {
  return el(
    "svg",
    { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", ...attrs },
    ...children,
  );
}

export function iconSearch(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("circle", { cx: "11", cy: "11", r: "7", stroke: "currentColor", "stroke-width": "2" }),
    el("path", {
      d: "M21 21l-4-4",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
    }),
  );
}

export function iconClear(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("path", {
      d: "M6 6l12 12M18 6L6 18",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
    }),
  );
}

export function iconPin(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("path", {
      d: "M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linejoin": "round",
    }),
    el("circle", { cx: "12", cy: "10", r: "2.5", stroke: "currentColor", "stroke-width": "2" }),
  );
}

export function iconRoute(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("path", {
      d: "M3 12l18-9-9 18-2-7-7-2z",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linejoin": "round",
    }),
  );
}

export function iconPhone(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("path", {
      d: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 013 5a1 1 0 011-1z",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linejoin": "round",
    }),
  );
}

export function iconChevronLeft(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("path", {
      d: "M15 6l-6 6 6 6",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );
}

export function iconChevronRight(el) {
  return svg(
    el,
    { "aria-hidden": "true" },
    el("path", {
      d: "M9 6l6 6-6 6",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );
}

/** Whether the user prefers reduced motion (guards autoplay + smooth scroll). */
export function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
