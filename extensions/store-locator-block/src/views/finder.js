// Finder view.
//
// Layout: a prominent centered hero search bar + "Use my location" floating over
// a full-width map (height from config.heroHeight, default ~480px), with the
// result cards in a scrollable panel below. If config.showFilterBar, a filter
// chip row sits under the hero search. Reuses the shared card component and the
// same search / near-me / geocode logic as the Map+List view.

import {
  formatAddress,
  buildOpenPill,
  buildDistanceChip,
  buildActions,
  buildCardImage,
  iconSearch,
  iconClear,
  iconPin,
  prefersReducedMotion,
} from "./shared.js";

const SEARCH_DEBOUNCE_MS = 500;
const MIN_QUERY_LEN = 2;
const DEFAULT_HERO_HEIGHT = 480;

/**
 * @param {HTMLElement} shell  the `.ssl` container from core.js
 * @param {object} ctx         { provider, mapEl, locations, widget, config,
 *                               proxyBase, track, geocode, helpers }
 */
export function renderFinder(shell, ctx) {
  const { provider, mapEl, locations, widget, config, track, geocode, helpers } = ctx;
  const { el, clear, sortByDistance, formatDistance, isOpenNow, directionsUrl } = helpers;

  const unitSystem = config.unitSystem || "metric";
  const timezone = widget.timezone || undefined;
  const showDirections = config.showDirections !== false;
  const showPhone = config.showPhone !== false;
  const enableNearMe = config.enableNearMe !== false;
  const showFilterBar = Boolean(config.showFilterBar);
  const heroHeight = Number(config.heroHeight) > 0 ? Number(config.heroHeight) : DEFAULT_HERO_HEIGHT;

  // ---- state --------------------------------------------------------------
  let center = config.defaultCenter || null;
  const activeFilters = new Set();
  let selectedId = null;
  let working = locations.slice();

  // ---- hero search --------------------------------------------------------
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
    { type: "button", class: "ssl-search__clear", "aria-label": "Clear search", hidden: true },
    iconClear(el),
  );

  const searchForm = el(
    "form",
    { class: "ssl-search ssl-finder__search", role: "search" },
    el("span", { class: "ssl-search__icon", "aria-hidden": "true" }, iconSearch(el)),
    searchInput,
    clearBtn,
  );

  const nearMeBtn = enableNearMe
    ? el(
        "button",
        { type: "button", class: "ssl-nearme ssl-finder__nearme" },
        iconPin(el),
        el("span", null, "Use my location"),
      )
    : null;

  const hero = el(
    "div",
    { class: "ssl-finder__hero" },
    el("div", { class: "ssl-finder__hero-inner" }, searchForm, nearMeBtn),
  );

  const chipRow = showFilterBar ? buildFilterChips() : null;

  const stage = el(
    "div",
    { class: "ssl-finder__stage", style: { "--ssl-hero-h": `${heroHeight}px` } },
    mapEl,
    hero,
  );

  // ---- results panel ------------------------------------------------------
  const resultsCount = el("p", { class: "ssl-results__count" });
  const resultsList = el("ul", {
    class: "ssl-results ssl-finder__results",
    "aria-live": "polite",
    "aria-label": "Locations",
  });
  const panel = el(
    "div",
    { class: "ssl-finder__panel" },
    chipRow,
    resultsCount,
    resultsList,
  );

  clear(shell);
  shell.appendChild(stage);
  shell.appendChild(panel);

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
        el("li", { class: "ssl-empty" }, el("p", null, "No locations found — try a wider search.")),
      );
      return;
    }

    resultsCount.textContent =
      working.length === 1 ? "1 location" : `${working.length} locations`;

    const now = new Date();
    working.forEach((loc) => resultsList.appendChild(buildCard(loc, now)));
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
      buildCardImage(el, loc),
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
    resultsList.querySelectorAll(".ssl-card").forEach((card) => {
      const isActive = card.dataset.id === selectedId;
      card.classList.toggle("ssl-card--active", isActive);
      card.setAttribute("aria-pressed", String(isActive));
      if (isActive && !opts.fromMap) {
        card.scrollIntoView({
          block: "nearest",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
    });
    if (selectedId != null) {
      provider.highlight(selectedId);
      track("click", { locationId: selectedId });
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
      class: "ssl-filters ssl-finder__filters",
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
}
