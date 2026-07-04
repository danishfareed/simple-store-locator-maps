// Carousel view.
//
// A horizontal snap-scroll row of location cards (config.cardsPerView, default 3,
// responsive), with prev/next buttons and optional autoplay (config.autoplay:
// advances on an interval, PAUSES on hover/focus, and is DISABLED entirely under
// prefers-reduced-motion). An optional synced mini-map (config.showMiniMap)
// centers/highlights the active card's location via the provider.
//
// Cards show image (if imageUrl), name, address, distance (only when a center is
// known), open-now pill, and Directions/Call actions.

import {
  formatAddress,
  buildOpenPill,
  buildDistanceChip,
  buildActions,
  buildCardImage,
  iconChevronLeft,
  iconChevronRight,
  prefersReducedMotion,
} from "./shared.js";

const DEFAULT_CARDS_PER_VIEW = 3;
const AUTOPLAY_INTERVAL_MS = 5000;

/**
 * @param {HTMLElement} shell  the `.ssl` container from core.js
 * @param {object} ctx         { provider, mapEl, locations, widget, config,
 *                               proxyBase, track, geocode, helpers }
 */
export function renderCarousel(shell, ctx) {
  const { provider, mapEl, locations, widget, config, track, helpers } = ctx;
  const { el, clear, sortByDistance, formatDistance, isOpenNow, directionsUrl } = helpers;

  const unitSystem = config.unitSystem || "metric";
  const timezone = widget.timezone || undefined;
  const showDirections = config.showDirections !== false;
  const showPhone = config.showPhone !== false;
  const showMiniMap = Boolean(config.showMiniMap);
  const reduced = prefersReducedMotion();
  const autoplay = Boolean(config.autoplay) && !reduced;
  const cardsPerView =
    Number(config.cardsPerView) > 0 ? Math.round(Number(config.cardsPerView)) : DEFAULT_CARDS_PER_VIEW;

  // Distance is only meaningful when a center is known (default center).
  const center = config.defaultCenter || null;
  const working = center ? sortByDistance(locations.slice(), center) : locations.slice();

  let activeIndex = 0;
  let autoplayTimer = null;
  let navRaf = null;

  // ---- track (the scroll row) ---------------------------------------------
  const trackEl = el("div", {
    class: "ssl-carousel__track",
    role: "list",
    "aria-label": "Locations",
    style: { "--ssl-cards-per-view": String(cardsPerView) },
  });

  const now = new Date();
  const slides = working.map((loc, i) => {
    const slide = buildSlide(loc, now, i);
    trackEl.appendChild(slide);
    return slide;
  });

  const prevBtn = el(
    "button",
    {
      type: "button",
      class: "ssl-carousel__nav ssl-carousel__nav--prev",
      "aria-label": "Previous locations",
    },
    iconChevronLeft(el),
  );
  const nextBtn = el(
    "button",
    {
      type: "button",
      class: "ssl-carousel__nav ssl-carousel__nav--next",
      "aria-label": "Next locations",
    },
    iconChevronRight(el),
  );

  const viewport = el(
    "div",
    { class: "ssl-carousel__viewport" },
    prevBtn,
    trackEl,
    nextBtn,
  );

  const carousel = el(
    "div",
    { class: "ssl-carousel" },
    showMiniMap ? el("div", { class: "ssl-carousel__map" }, mapEl) : null,
    viewport,
  );

  clear(shell);
  if (!working.length) {
    shell.appendChild(
      el(
        "div",
        { class: "ssl-empty" },
        el("p", null, "No locations found — try a wider search."),
      ),
    );
    return;
  }
  shell.appendChild(carousel);

  // ---- mini-map wiring ----------------------------------------------------
  if (showMiniMap) {
    provider.on("ready", () => {
      provider.clearMarkers();
      provider.addMarkers(working, {
        markerColor: (config.theme && config.theme.markerColor) || undefined,
        onClick: (loc) => {
          const idx = working.findIndex((l) => String(l.id) === String(loc.id));
          if (idx >= 0) goTo(idx, { fromMap: true });
        },
      });
      if (working.length) provider.fitBounds(working);
      syncMap();
    });
  }

  // ---- slide component ----------------------------------------------------
  function buildSlide(loc, whenNow, index) {
    const addr = formatAddress(loc);
    const open = isOpenNow(loc.hours, whenNow, timezone);

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

    return el(
      "div",
      {
        class: "ssl-card ssl-carousel__slide",
        role: "listitem",
        tabindex: "0",
        dataset: { id: String(loc.id), index: String(index) },
        onFocus: () => {
          activeIndex = index;
          if (showMiniMap) syncMap();
        },
      },
      buildCardImage(el, loc),
      el("h3", { class: "ssl-card__name" }, loc.name || "Location"),
      addr ? el("p", { class: "ssl-card__addr" }, addr) : null,
      meta,
      actions,
    );
  }

  // ---- navigation ---------------------------------------------------------
  function goTo(index, opts = {}) {
    const max = slides.length - 1;
    activeIndex = Math.max(0, Math.min(max, index));
    const slide = slides[activeIndex];
    if (slide) {
      // Scroll the slide to the track's left edge (robust across offset parents):
      // slide-left relative to the track content box = delta of bounding rects
      // plus the track's current scroll offset.
      const left =
        slide.getBoundingClientRect().left -
        trackEl.getBoundingClientRect().left +
        trackEl.scrollLeft;
      trackEl.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
    }
    if (showMiniMap && !opts.fromMap) syncMap();
    updateNavState();
  }

  function step(delta) {
    goTo(activeIndex + delta * cardsPerView);
  }

  function syncMap() {
    const loc = working[activeIndex];
    if (!loc || loc.id == null) return;
    provider.highlight(String(loc.id));
  }

  function updateNavState() {
    const atStart = trackEl.scrollLeft <= 1;
    const atEnd = trackEl.scrollLeft + trackEl.clientWidth >= trackEl.scrollWidth - 1;
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  }

  // ---- autoplay -----------------------------------------------------------
  function startAutoplay() {
    if (!autoplay || autoplayTimer) return;
    autoplayTimer = setInterval(() => {
      const atEnd = trackEl.scrollLeft + trackEl.clientWidth >= trackEl.scrollWidth - 1;
      if (atEnd) goTo(0);
      else step(1);
    }, AUTOPLAY_INTERVAL_MS);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  // ---- events -------------------------------------------------------------
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  trackEl.addEventListener("scroll", () => {
    // Keep prev/next enabled state in sync with manual scrolling.
    if (navRaf) cancelAnimationFrame(navRaf);
    navRaf = requestAnimationFrame(updateNavState);
  });

  if (autoplay) {
    // Pause on hover/focus (accessibility + polite behaviour).
    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", startAutoplay);
    carousel.addEventListener("focusin", stopAutoplay);
    carousel.addEventListener("focusout", startAutoplay);
    startAutoplay();
  }

  // ---- initial paint ------------------------------------------------------
  updateNavState();
}
