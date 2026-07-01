// Flagship Map + List view.
//
// Layout: sidebar (search + near-me + filter chips + scrollable result cards)
// beside the map. Clicking a card highlights + centers its marker. Searching
// geocodes the query (debounced) and re-sorts by distance. Near-me uses the
// browser geolocation API. Analytics fire for search/directions/call.

import {
  formatAddress,
  buildOpenPill,
  buildDistanceChip,
  buildActions,
  iconSearch,
  iconClear,
  iconPin,
  prefersReducedMotion,
} from "./shared.js";

const SEARCH_DEBOUNCE_MS = 500;
const MIN_QUERY_LEN = 2;

/**
 * @param {HTMLElement} shell  the `.ssl` container from core.js
 * @param {object} ctx         { provider, mapEl, locations, widget, config,
 *                               proxyBase, track, geocode, helpers }
 */
export function renderMapList(shell, ctx) {
  const {
    provider,
    mapEl,
    locations,
    widget,
    config,
    track,
    geocode,
    helpers,
  } = ctx;
  const { el, clear, sortByDistance, formatDistance, isOpenNow, directionsUrl } =
    helpers;

  const unitSystem = config.unitSystem || "metric";
  const timezone = widget.timezone || undefined;
  const sidebarPosition = config.sidebarPosition === "right" ? "right" : "left";
  const showDirections = config.showDirections !== false;
  const showPhone = config.showPhone !== false;
  const enableNearMe = config.enableNearMe !== false;

  // ---- state --------------------------------------------------------------
  let center = config.defaultCenter || null;
  let activeFilters = new Set();
  let selectedId = null;
  /** all locations, possibly distance-annotated */
  let working = locations.slice();

  // ---- DOM scaffold -------------------------------------------------------
  const searchInput = el("input", {
    type: "search",
    class: "ssl-search__input",
    name: "q",
    placeholder: "Search city or ZIP",
    "aria-label": "Search city or ZIP",
    autocomplete: "off",
  });

  const clearBtn = el(
    "button",
    {
      type: "button",
      class: "ssl-search__clear",
      "aria-label": "Clear search",
      hidden: true,
    },
    iconClear(el),
  );

  const searchForm = el(
    "form",
    { class: "ssl-search", role: "search" },
    el("span", { class: "ssl-search__icon", "aria-hidden": "true" }, iconSearch(el)),
    searchInput,
    clearBtn,
  );

  const nearMeBtn = enableNearMe
    ? el(
        "button",
        { type: "button", class: "ssl-nearme" },
        iconPin(el),
        el("span", null, "Use my location"),
      )
    : null;

  const chipRow = buildFilterChips();

  const resultsList = el("ul", {
    class: "ssl-results",
    "aria-live": "polite",
    "aria-label": "Locations",
  });

  const resultsCount = el("p", { class: "ssl-results__count", "aria-hidden": "false" });

  const sidebar = el(
    "div",
    { class: "ssl-sidebar" },
    searchForm,
    nearMeBtn,
    chipRow,
    resultsCount,
    resultsList,
  );

  const grid = el("div", { class: "ssl-grid", dataset: { sidebar: sidebarPosition } });
  if (sidebarPosition === "right") {
    grid.appendChild(mapEl);
    grid.appendChild(sidebar);
  } else {
    grid.appendChild(sidebar);
    grid.appendChild(mapEl);
  }

  // Mobile list/map toggle.
  const toggle = el(
    "div",
    { class: "ssl-toggle", role: "tablist", "aria-label": "View mode" },
    toggleBtn("list", "List", true),
    toggleBtn("map", "Map", false),
  );

  clear(shell);
  shell.appendChild(toggle);
  shell.appendChild(grid);

  // ---- provider wiring ----------------------------------------------------
  provider.on("ready", () => {
    paintMarkers();
    if (working.length) provider.fitBounds(working);
  });

  // ---- rendering ----------------------------------------------------------
  function paintMarkers() {
    provider.clearMarkers();
    provider.addMarkers(working, {
      markerColor: (config.theme && config.theme.markerColor) || undefined,
      onClick: (loc) => selectLocation(loc.id, { fromMap: true }),
    });
  }

  function renderResults() {
    clear(resultsList);

    if (!working.length) {
      resultsCount.textContent = "";
      resultsList.appendChild(
        el(
          "li",
          { class: "ssl-empty" },
          el("p", null, "No locations found — try a wider search."),
        ),
      );
      return;
    }

    resultsCount.textContent =
      working.length === 1 ? "1 location" : `${working.length} locations`;

    const now = new Date();
    working.forEach((loc) => {
      resultsList.appendChild(buildCard(loc, now));
    });
  }

  function buildCard(loc, now) {
    const addr = formatAddress(loc);
    const open = isOpenNow(loc.hours, now, timezone);

    const meta = el("div", { class: "ssl-card__meta" });
    const chip = buildDistanceChip(el, formatDistance, loc.distanceKm, unitSystem);
    if (chip) meta.appendChild(chip);
    meta.appendChild(buildOpenPill(el, open));

    const actions = buildActions({
      el,
      directionsUrl,
      track,
      loc,
      showDirections,
      showPhone,
    });

    const card = el(
      "li",
      {
        class: "ssl-card",
        tabindex: "0",
        role: "button",
        "aria-pressed": String(selectedId === String(loc.id)),
        dataset: { id: String(loc.id) },
        onClick: () => selectLocation(loc.id),
        onKeydown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectLocation(loc.id);
          }
        },
      },
      el("h3", { class: "ssl-card__name" }, loc.name || "Location"),
      addr ? el("p", { class: "ssl-card__addr" }, addr) : null,
      meta,
      actions,
    );
    if (selectedId === String(loc.id)) card.classList.add("ssl-card--active");
    return card;
  }

  // ---- interactions -------------------------------------------------------
  function selectLocation(id, opts = {}) {
    selectedId = id == null ? null : String(id);
    // Toggle active card styling + aria without a full re-render.
    resultsList.querySelectorAll(".ssl-card").forEach((card) => {
      const isActive = card.dataset.id === selectedId;
      card.classList.toggle("ssl-card--active", isActive);
      card.setAttribute("aria-pressed", String(isActive));
      if (isActive && !opts.fromMap) {
        card.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    });
    if (selectedId != null) {
      provider.highlight(selectedId);
      track("click", { locationId: selectedId });
      // On mobile, a card tap jumps to the map so the highlight is visible.
      if (!opts.fromMap && isMobile()) switchMode("map");
    }
  }

  async function runSearch(query) {
    const q = String(query || "").trim();
    if (q.length < MIN_QUERY_LEN) {
      resetToAll();
      return;
    }
    searchForm.classList.add("ssl-search--busy");
    const geo = await geocode(q);
    searchForm.classList.remove("ssl-search--busy");
    track("search", { query: q.slice(0, 200) });
    if (!geo) {
      // No geocoding match: show the empty state rather than a stale list.
      center = null;
      working = [];
      selectedId = null;
      renderResults();
      paintMarkers();
      return;
    }
    center = geo;
    working = sortByDistance(applyFilters(locations.slice()), center);
    selectedId = null;
    renderResults();
    paintMarkers();
    provider.setView(center, 12);
  }

  function resetToAll() {
    center = config.defaultCenter || null;
    working = applyFilters(locations.slice());
    if (center) working = sortByDistance(working, center);
    selectedId = null;
    renderResults();
    paintMarkers();
    if (working.length) provider.fitBounds(working);
  }

  function applyFilters(list) {
    if (!activeFilters.size) return list;
    // OR within the services facet: a location matches if it has ANY selected service.
    return list.filter((loc) => {
      const services = Array.isArray(loc.services) ? loc.services : [];
      for (const f of activeFilters) {
        if (services.includes(f)) return true;
      }
      return false;
    });
  }

  function nearMe() {
    if (!navigator.geolocation) {
      flashNearMe("Location unavailable");
      return;
    }
    nearMeBtn.classList.add("ssl-nearme--busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        nearMeBtn.classList.remove("ssl-nearme--busy");
        center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        working = sortByDistance(applyFilters(locations.slice()), center);
        selectedId = null;
        renderResults();
        paintMarkers();
        provider.setView(center, 12);
        track("search", { query: "near-me" });
      },
      () => {
        nearMeBtn.classList.remove("ssl-nearme--busy");
        flashNearMe("Couldn't get your location");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function flashNearMe(msg) {
    if (!nearMeBtn) return;
    const label = nearMeBtn.querySelector("span:last-child");
    if (!label) return;
    const prev = label.textContent;
    label.textContent = msg;
    setTimeout(() => {
      label.textContent = prev;
    }, 2500);
  }

  // ---- filter chips -------------------------------------------------------
  function collectFilterValues() {
    const values = new Set();
    const configured = [
      ...(Array.isArray(config.categories) ? config.categories : []),
      ...(config.filters && Array.isArray(config.filters.services)
        ? config.filters.services
        : []),
    ];
    if (configured.length) {
      configured.forEach((v) => v && values.add(String(v)));
    } else {
      // Derive from location services when nothing is configured.
      locations.forEach((loc) => {
        (Array.isArray(loc.services) ? loc.services : []).forEach(
          (s) => s && values.add(String(s)),
        );
      });
    }
    return Array.from(values);
  }

  function buildFilterChips() {
    const values = collectFilterValues();
    if (!values.length) return el("div", { class: "ssl-filters", hidden: true });
    const row = el("div", {
      class: "ssl-filters",
      role: "group",
      "aria-label": "Filter locations",
    });
    values.forEach((value) => {
      const chip = el(
        "button",
        {
          type: "button",
          class: "ssl-chip ssl-chip--filter",
          "aria-pressed": "false",
          onClick: () => {
            const on = chip.getAttribute("aria-pressed") === "true";
            if (on) activeFilters.delete(value);
            else activeFilters.add(value);
            chip.setAttribute("aria-pressed", String(!on));
            chip.classList.toggle("ssl-chip--on", !on);
            applyActiveFilters();
          },
        },
        value,
      );
      row.appendChild(chip);
    });
    return row;
  }

  function applyActiveFilters() {
    working = applyFilters(locations.slice());
    if (center) working = sortByDistance(working, center);
    selectedId = null;
    renderResults();
    paintMarkers();
    if (working.length) provider.fitBounds(working);
  }

  // ---- mobile toggle ------------------------------------------------------
  function toggleBtn(mode, label, active) {
    return el(
      "button",
      {
        type: "button",
        class: `ssl-toggle__btn${active ? " ssl-toggle__btn--active" : ""}`,
        role: "tab",
        "aria-selected": String(active),
        dataset: { mode },
        onClick: () => switchMode(mode),
      },
      label,
    );
  }

  function switchMode(mode) {
    grid.dataset.mode = mode;
    toggle.querySelectorAll(".ssl-toggle__btn").forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("ssl-toggle__btn--active", on);
      b.setAttribute("aria-selected", String(on));
    });
    if (mode === "map" && provider._map && typeof provider._map.invalidateSize === "function") {
      setTimeout(() => provider._map.invalidateSize(), 0);
    }
  }

  // ---- event listeners ----------------------------------------------------
  let searchTimer = null;
  searchInput.addEventListener("input", () => {
    clearBtn.hidden = !searchInput.value;
    if (searchTimer) clearTimeout(searchTimer);
    const value = searchInput.value;
    searchTimer = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  });
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (searchTimer) clearTimeout(searchTimer);
    runSearch(searchInput.value);
  });
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.hidden = true;
    searchInput.focus();
    resetToAll();
  });
  if (nearMeBtn) nearMeBtn.addEventListener("click", nearMe);

  // ---- initial paint ------------------------------------------------------
  if (center) working = sortByDistance(working, center);
  renderResults();

  function isMobile() {
    return shell.clientWidth > 0 && shell.clientWidth < 720;
  }
}
