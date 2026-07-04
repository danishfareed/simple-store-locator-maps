// Single Store view.
//
// Renders one location chosen by config.locationId. Layout: the map (centered on
// the location) + image + full address + an hours table (all 7 days, current day
// highlighted, open-now pill) + Call + Directions. Compact footprint (also used
// by the app-block variant). If the location is missing or not found, a friendly
// "Location unavailable" state is shown.

import {
  formatAddress,
  buildOpenPill,
  iconRoute,
  iconPhone,
} from "./shared.js";

const WEEKDAY_LABELS = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * @param {HTMLElement} shell  the `.ssl` container from core.js
 * @param {object} ctx         { provider, mapEl, locations, widget, config,
 *                               proxyBase, track, geocode, helpers }
 */
export function renderSingle(shell, ctx) {
  const { provider, mapEl, locations, widget, config, track, helpers } = ctx;
  const { el, clear, isOpenNow, directionsUrl } = helpers;

  const timezone = widget.timezone || undefined;
  const showDirections = config.showDirections !== false;
  const showPhone = config.showPhone !== false;

  const loc = findLocation(locations, config.locationId);

  clear(shell);

  if (!loc) {
    shell.appendChild(
      el(
        "div",
        { class: "ssl-state ssl-single__unavailable", role: "status" },
        el("p", { class: "ssl-state__title" }, "Location unavailable"),
        el("p", { class: "ssl-state__body" }, "This location can't be shown right now."),
      ),
    );
    return;
  }

  const now = new Date();
  const open = isOpenNow(loc.hours, now, timezone);
  const addr = formatAddress(loc);
  const hasCoords = loc.lat != null && loc.lng != null;

  // ---- media / map --------------------------------------------------------
  const mediaChildren = [];
  if (loc.imageUrl) {
    mediaChildren.push(
      el(
        "div",
        { class: "ssl-single__image" },
        el("img", {
          class: "ssl-card__img",
          src: String(loc.imageUrl),
          alt: loc.name ? `${loc.name}` : "Location",
          loading: "lazy",
          decoding: "async",
        }),
      ),
    );
  }
  if (hasCoords) {
    mediaChildren.push(el("div", { class: "ssl-single__map" }, mapEl));
  }
  const media = mediaChildren.length
    ? el("div", { class: "ssl-single__media" }, ...mediaChildren)
    : null;

  // ---- header + actions ---------------------------------------------------
  const header = el(
    "div",
    { class: "ssl-single__header" },
    el("h2", { class: "ssl-single__name" }, loc.name || "Location"),
    el("div", { class: "ssl-card__meta" }, buildOpenPill(el, open)),
    addr ? el("p", { class: "ssl-single__addr" }, addr) : null,
  );

  const actions = el("div", { class: "ssl-card__actions ssl-single__actions" });
  if (showDirections && hasCoords) {
    actions.appendChild(
      el(
        "a",
        {
          class: "ssl-btn ssl-btn--primary",
          href: directionsUrl({ lat: Number(loc.lat), lng: Number(loc.lng) }, "google"),
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: () => track("directions", { locationId: String(loc.id) }),
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
          onClick: () => track("call", { locationId: String(loc.id) }),
        },
        iconPhone(el),
        el("span", null, "Call"),
      ),
    );
  }
  if (actions.childNodes.length) header.appendChild(actions);

  // ---- hours table --------------------------------------------------------
  const hoursSection = buildHoursTable(loc.hours, now, timezone);

  const details = el(
    "div",
    { class: "ssl-single__details" },
    header,
    hoursSection,
  );

  const layout = el(
    "div",
    { class: "ssl-single" },
    media,
    details,
  );
  shell.appendChild(layout);

  // ---- provider wiring ----------------------------------------------------
  if (hasCoords) {
    provider.on("ready", () => {
      provider.clearMarkers();
      provider.addMarkers([loc], {
        markerColor: (config.theme && config.theme.markerColor) || undefined,
      });
      provider.setView({ lat: Number(loc.lat), lng: Number(loc.lng) }, config.defaultZoom || 14);
    });
  }

  // ---- hours table builder ------------------------------------------------
  function buildHoursTable(hours, whenNow, tz) {
    const todayIso = resolveTodayIso(whenNow, tz);

    const rows = [];
    for (let day = 1; day <= 7; day += 1) {
      const dayHours = hours && Array.isArray(hours[String(day)]) ? hours[String(day)] : [];
      const label = formatDayHours(dayHours);
      const isToday = day === todayIso;
      rows.push(
        el(
          "tr",
          {
            class: `ssl-hours__row${isToday ? " ssl-hours__row--today" : ""}`,
            "aria-current": isToday ? "date" : undefined,
          },
          el("th", { scope: "row", class: "ssl-hours__day" }, WEEKDAY_LABELS[day]),
          el("td", { class: "ssl-hours__time" }, label),
        ),
      );
    }

    return el(
      "div",
      { class: "ssl-single__hours" },
      el("h3", { class: "ssl-single__hours-title" }, "Opening hours"),
      el(
        "table",
        { class: "ssl-hours" },
        el("caption", { class: "ssl-sr-only" }, "Opening hours by day"),
        el("tbody", null, ...rows),
      ),
    );
  }
}

// ---- helpers --------------------------------------------------------------
function findLocation(locations, locationId) {
  if (!Array.isArray(locations) || !locations.length) return null;
  if (locationId == null || locationId === "") return null;
  const wanted = String(locationId);
  return locations.find((l) => l && String(l.id) === wanted) || null;
}

/** Turn a day's hours intervals into a display string ("9:00 – 17:00" / "Closed"). */
function formatDayHours(dayHours) {
  const openIntervals = (dayHours || []).filter((i) => i && !i.closed);
  if (!openIntervals.length) return "Closed";
  return openIntervals
    .map((i) => `${stripLeadingZero(i.open)} – ${stripLeadingZero(i.close)}`)
    .join(", ");
}

function stripLeadingZero(hhmm) {
  if (typeof hhmm !== "string") return String(hhmm ?? "");
  const [h, m] = hhmm.split(":");
  return `${parseInt(h, 10)}:${m}`;
}

/** ISO weekday (1=Mon..7=Sun) for `now`, optionally in a specific IANA zone. */
function resolveTodayIso(now, timeZone) {
  if (timeZone) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(now);
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[weekday] ?? isoFromDate(now);
  }
  return isoFromDate(now);
}

function isoFromDate(now) {
  const day = now.getDay();
  return day === 0 ? 7 : day;
}
