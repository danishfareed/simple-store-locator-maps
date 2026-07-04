// Fire-and-forget storefront analytics beacon. Debounced per event type so a
// burst of keystroke-driven "search" events collapses to one request. Never
// throws — analytics must never break the widget.

const DEBOUNCE_MS = 400;
const timers = new Map();

/**
 * Send an analytics event to `${proxyBase}/event`. Debounced by `type` so rapid
 * repeats (e.g. typing in search) coalesce. Uses `navigator.sendBeacon` when
 * available, falling back to `fetch(..., { keepalive: true })`.
 *
 * @param {string} proxyBase  App-proxy base, e.g. "/apps/store-locator".
 * @param {"search"|"view"|"click"|"directions"|"call"|"impression"} type
 * @param {Record<string, unknown>} [payload]
 */
export function track(proxyBase, type, payload = {}) {
  if (!proxyBase || !type) return;

  const key = `${type}:${payload && payload.locationId ? payload.locationId : ""}`;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(key);
    send(proxyBase, { type, ...payload });
  }, DEBOUNCE_MS);

  timers.set(key, timer);
}

function send(proxyBase, body) {
  const url = `${proxyBase}/event`;
  let json;
  try {
    json = JSON.stringify(body);
  } catch {
    return;
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([json], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    // swallow — analytics is best-effort
  }
}
