# Simple Store Locator — Completion & Publication Design

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Goal:** Finish the app to a seamless, competitive, App-Store-publishable state, deployed on Cloudflare, with 5 storefront widget types, OpenStreetMap default + Google Maps (bring-your-own-key), and a simple 2-plan pricing model.

---

## 1. Context & current state

The app is a Shopify embedded app (React Router 7 framework mode) on Cloudflare Workers + D1 + Drizzle + R2 + Queues, with a theme app extension for the storefront. A completeness assessment found it ~90% built:

**Already working (do not rebuild):**
- Shopify OAuth + D1-backed session storage, embedded app, `requireAdmin` gate.
- Full DB schema (shops, sessions, plans, subscriptions, locations, widgets, imports, analytics_events, quota_usage, audit_log) with indexes.
- Locations CRUD + haversine/bbox radius search + slug collision handling.
- CSV/XLSX import pipeline: R2 upload → Queue → consumer → validation → batch upsert, with column aliasing and error tracking.
- App-proxy routes (`proxy.locations`, `proxy.search`, `proxy.widget`) with HMAC verification, quota enforcement, cache headers.
- Analytics event recording + dashboard (sparklines, top locations, IP hashing).
- Billing scaffolding (`billing.require()` wrapper) + quota service.
- Cloudflare worker entry wiring `fetch` + `queue` handlers; build pipeline; per-env wrangler config.
- Unit tests for hmac, schemas, geo, quotas, slug; one import-parse integration test.

**Gaps this design closes:**
1. Only **one** widget layout exists — need **5 distinct widget types**.
2. Google Maps is registered as a provider spec but **never rendered on the storefront** (Leaflet/OSM only). Need real Google rendering with the merchant's key.
3. **GDPR mandatory webhooks missing** (`customers/data_request`, `customers/redact`, `shop/redact`) — hard App Store blocker.
4. Pricing is **4 tiers** — reduce to **2** (Free + Premium) with proven pricing psychology.
5. Scopes request `read_products,write_products` — **not needed**; reduce to least-privilege.
6. Billing activation leaves charge in `pending` — must actually flip to active.
7. Settings UI incomplete (branding, default center/zoom exist in schema but not exposed).
8. Storefront missing competitive features: "near me" geolocation, clustering, filters, open/closed-now, and good-citizen client-side geocoding.

---

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| React Router | **7.18.1** (latest 7.x) | RR8 needs React 19 + RSC + Node 22 and is **not supported** by `@shopify/shopify-app-react-router@1.2.1` (peer `react-router ^7.6.2`). 7.18.1 keeps "latest" without breaking Shopify embedded auth/billing. |
| Shopify API version | **2026-04** (current stable) | Shopify recommends targeting latest stable; quarterly bumps thereafter. |
| Access scopes | **Minimal / none of product scopes** | Locator manages own data via app-proxy + theme extension; least-privilege is expected at review. |
| Widget types | **All 5** | Map+List, Full-screen Finder, Carousel, List/Grid, Single Store. |
| Pricing | **Free + Premium** | Free ≤3 locations; Premium ≤100 locations, $14.99/mo, 7-day trial, optional annual. |
| Widget type source of truth | **In-app widget record** | Theme block references a widget by handle; type & config come from DB. |
| Compute location | **Client-side first** | Minimize Worker load. Only trust-sensitive/secret work stays server-side (see §3.1). Search, distance, sort, filter, near-me, open-now, and geocoding run in the browser. |

---

## 3. Architecture principle: client-side first

Keep Worker/server load minimal. Only work that is **secret, trust-sensitive, or must be authoritative** stays server-side; everything else runs in the browser.

### 3.1 Server-side (only what must be)
- **App-proxy data feeds** — `proxy.widget.json` (config + provider + key) and `proxy.locations.json` (all active locations for the shop). Both HMAC-verified, plan-gated, quota-counted, and **edge-cached** so a page load is ~one cheap cached fetch.
- **Analytics beacon** — a single lightweight `proxy.event` endpoint (fire-and-forget) for meaningful events (search performed, directions/call clicks). Debounced/batched on the client; it's our data and plan-gated, so it stays server-side but stays cheap.
- **Admin, auth, billing, imports** — inherently server-side (secrets, Shopify API, D1 writes, queue).
- **Plan/quota/feature enforcement + HMAC + secrets** — never trusted to the client.

### 3.2 Client-side (the browser does the work)
- Rendering all 5 widget views; map providers loaded from CDN (Leaflet) or via the merchant's key (Google).
- **Search, radius filtering, distance calc, sorting, category/service filtering, "near me", open/closed-now** — all computed in-browser from the single locations feed (≤100 locations, trivial to filter locally; avoids a server round-trip per keystroke).
- **Geocoding** — client-side (Google Geocoding/Places when on Google; Nominatim/Photon otherwise), with debounce + min-query-length to be a good API citizen.

This means the hot path per storefront visit is: one cached `widget.json` + one cached `locations.json`, then everything is local. `proxy.search.json` (existing server-side radius search) is **retained as a non-JS/backward-compat fallback** but is not on the default hot path.

---

## 3A. Versions & foundation (Section A)

- `react-router`, `@react-router/dev`, `@react-router/cloudflare` → **7.18.1**.
- Keep `@shopify/shopify-app-react-router@^1.2.1`, `@shopify/polaris`, `@shopify/app-bridge-react`, `@shopify/shopify-api` at latest compatible.
- Vite stays on the **6.x** line (RR7 dev peer); Wrangler bump within v4; Drizzle current.
- `shopify.app.toml` + `wrangler.toml`: `SHOPIFY_API_VERSION = "2026-04"`, webhook `api_version = "2026-04"`.
- Scopes: set `access_scopes.scopes = ""` (empty) unless a concrete need emerges; update `SCOPES` var to match. Verify OAuth still completes with empty scopes.
- Node engine stays `>=20`.

**Acceptance:** `npm install` clean (no peer conflicts), `npm run typecheck`, `npm run build`, `npm test` all pass after the bump.

---

## 4. Widget type system (Section B)

### 4.1 Data model
Add a `type` column to `widgets`:
```
type: text enum ["map_list","finder","carousel","list","single"] NOT NULL DEFAULT "map_list"
```
Migration `0002_widget_type.sql` adds the column with default `map_list` so existing rows stay valid.

### 4.2 Config schema — discriminated union
`app/schemas/widget.schema.ts` becomes a discriminated union keyed on `type`. Shared base (map center/zoom, searchRadiusKm, showHours/Phone/Directions, filters, theme, clustering, nearMe) plus per-type extras:
- `map_list`: sidebarPosition ("left"|"right"), resultsPerPage.
- `finder`: heroHeight, showFilterBar.
- `carousel`: cardsPerView, autoplay, showMiniMap.
- `list`: columns (1–4), showMapLink.
- `single`: locationId (which store), showContactForm (bool, future-safe but off by default).

Add to base config: `clustering?: boolean`, `enableNearMe?: boolean`, `categories?: string[]` (filter facet), `showPoweredBy` derived from plan (not user-editable).

### 4.3 Admin UI
- `app.widgets.tsx` → **list** of widgets (name, type, handle, published) with "Create widget" + per-row edit/delete. Enforce plan gating: Free may only create `map_list`; attempting others shows an upgrade banner.
- `app.widgets.new.tsx` + `app.widgets.$id.tsx` → create/edit form with a **type picker** that reveals type-specific fields, provider select, theme controls, and the shared toggles. Show the theme-editor handle prominently ("Add the Store Locator block and select handle `X`").
- Widget-count / type gating enforced server-side in `widget.service` against the active plan's features.

### 4.4 App proxy
- `proxy.widget.ts` returns `{ type, config, provider, providerMeta, timezone, showPoweredBy, googleMapsApiKey? }`. The key is included **only** when `provider === "google"` and a key is set (Maps JS API keys are client-side by design; doc guidance: restrict by HTTP referrer). `showPoweredBy` reflects the shop's plan.
- `proxy.locations.ts` returns all active locations for the shop (edge-cached); the client filters/sorts locally.
- `proxy.event.ts` (new) — lightweight analytics beacon (POST), HMAC-verified, plan-gated, fire-and-forget; the client debounces/batches calls.
- `proxy.search.ts` retained as a non-JS/backward-compat fallback (server-side radius search) but off the default hot path.

### 4.5 Storefront rendering
One shared JS bundle (`store-locator.js`) refactored into a small module structure:
- `providers/leaflet.js`, `providers/google.js` — a common map interface (init, setView, addMarkers, clearMarkers, fitBounds, cluster).
- `views/mapList.js`, `views/finder.js`, `views/carousel.js`, `views/list.js`, `views/single.js` — render per type using the shared data + provider.
- `core.js` — fetch widget config → pick provider → pick view → wire search/near-me/filters.

Kept vanilla JS (no framework) to stay light on the storefront; bundled by an esbuild step in `scripts/build-worker.mjs` (or a dedicated extension asset build) into `store-locator.js`. Leaflet loaded from CDN only when a Leaflet-based view is used; Google SDK loaded dynamically with the key only for `provider=google`.

### 4.6 Theme extension
- One section block "Store Locator" with settings: `widget_handle`, height, and cosmetic overrides. Type & behavior come from the referenced widget (DB is source of truth).
- Add an optional **app-embed/app block variant** suitable for product/contact pages for the `single` type (small footprint).

**Acceptance:** each of the 5 types renders correctly with sample data on both providers (Google path validated with a test key), responsive down to mobile, keyboard-accessible, XSS-safe.

---

## 5. Maps, search & competitive features (Section C) — client-side

Per §3, these run in the browser against the single cached `locations.json` feed:

- **Default OSM (Leaflet)**; **Google Maps** rendered on storefront when `provider=google` + key present, else graceful fallback to Leaflet.
- **Geocoding is client-side.** Google Geocoding/Places when on Google; otherwise Nominatim (or Photon) called directly from the browser with debounce, min-query-length, and attribution — good-citizen usage, zero Worker load. The OSM geocoder base URL is a config field so a high-volume merchant can point to their own/Google. *(Trade-off noted: for very high-traffic stores, public Nominatim can rate-limit; the in-app copy recommends Google or a custom endpoint for those cases. We deliberately do not add a server geocode proxy in v1 to keep Worker load minimal.)*
- **"Near me"**: `navigator.geolocation` → local haversine sort/filter over the loaded feed. Graceful when denied/unsupported.
- **Distance display + sort, radius filter, text search, category/service filters** — all computed in-browser from the feed (≤100 locations). Filter chips fed by `config.categories`/location `services`; wired for `map_list` and `finder`.
- **Get-directions** deep links (Google Maps + Apple Maps). **Open/closed-now** computed client-side from `hours` in the shop timezone (timezone passed in the feed/config).
- **Marker clustering** for up to 100 pins (Leaflet.markercluster; Google MarkerClusterer), toggled by `config.clustering`.
- **Analytics**: debounced client beacon → `proxy.event` for search / directions / call / view (extends the existing fire-and-forget recording path; plan-gated server-side).

**Acceptance:** search-by-address, "near me", filters, clustering, directions, and open-now all work on OSM entirely client-side; Google path works with a supplied key; per-visit server traffic is ~2 cached GETs + occasional analytics beacons.

---

## 6. Pricing — 2 plans, psychology-driven (Section D)

### 6.1 Plans
Replace the 4-tier seed with **2 plans** (`0003_reprice_plans.sql`, deactivate old tiers rather than hard-delete to protect existing subscribers):

| | **Free** | **Premium** |
|---|---|---|
| Price | $0 | **$14.99/mo** (charm pricing) + optional **$149.90/yr** |
| Trial | — | **7-day free trial** |
| Locations | **3** | **100** |
| Map providers | OSM only | OSM + **Google (own key)** |
| Widget types | **Map+List only** | **All 5** |
| Import | Manual add + CSV (capped by 3-location limit) | CSV **+ XLSX** bulk |
| Analytics | Basic (7-day) | Full (30-day, top locations, clicks/directions/calls) |
| Theming | Defaults | Custom colors/fonts/logo |
| Storefront extras | — | Clustering, filters, near-me |
| Branding | "Powered by" shown | **Removed** |

### 6.2 Psychology levers (documented for the listing/decisions)
1. **Charm pricing** — $14.99 not $15 (left-digit effect).
2. **Freemium as anchor + acquisition funnel** — zero-friction install; the **3-location cap is a natural upgrade trigger** when a merchant adds a 4th store.
3. **7-day free trial** — loss aversion; merchants who set up don't want to lose it.
4. **Hick's law** — only 2 options → no choice paralysis (matches "keep it simple").
5. **Aspirational de-branding** — removing "Powered by" is a concrete Premium reason.
6. **Optional annual anchor** — "$149.90/yr = 2 months free (~17% off)" makes monthly feel like the default and lifts LTV. Implemented as an **annual billing interval on the same Premium plan** (Shopify billing supports `ANNUAL`), not a third plan — the plan count stays at 2.

### 6.3 Billing correctness
- Complete activation: on return from Shopify billing confirmation (and/or `app_subscriptions/update` webhook), flip subscription → `active` and set `shop.planHandle`. Fix the hardcoded `pending` charge-id path so upgrades take effect and downgrades on cancel work.
- Feature/quota fencing enforced server-side from the active plan (locations cap, widget types, import kind, provider availability, powered-by).

**Acceptance:** upgrade → active plan reflected in UI + quotas; cancel → downgrade to Free; Free blocked at 4th location and non-`map_list` widget with upgrade prompt; trial honored.

---

## 7. App Store publication readiness (Section E)

- **GDPR mandatory webhooks** — new routes with HMAC verification (`verifyWebhook` helper exists):
  - `webhooks.customers.data_request.ts` — log/acknowledge (app stores no customer PII beyond analytics ipHash; respond with what's held).
  - `webhooks.customers.redact.ts` — purge any customer-linked analytics rows if applicable; acknowledge.
  - `webhooks.shop.redact.ts` — delete all shop data (locations, widgets, imports, analytics, subscription, sessions, shop row) 48h+ after uninstall.
  - Register all three in `shopify.app.toml`; add to worker/route config.
- **Settings UI completion** (`app.settings.tsx`): branding primaryColor + logoUrl, default lat/lng/zoom, unit system, Google key input with **referrer-restriction guidance** copy.
- **Listing checklist doc** (`docs/publishing-checklist.md`): privacy policy URL, scope justification, screenshots/demo-store notes, GDPR webhook confirmation, billing test steps.

**Acceptance:** all four webhooks (uninstall + 3 GDPR) verified with HMAC and return 200/401 correctly under test; settings persist and drive storefront defaults.

---

## 8. Cloudflare deployment & tests (Section F)

- Deployment stays Workers + D1 + R2 + Queues. Provide a runbook (`README` update): create resources → put secrets → `db:migrate:remote` → `deploy` → `shopify:deploy` (extensions + config) → set `application_url`/proxy URLs.
- Per-env (`staging`, `production`) config verified.
- **Tests added:** widget-type config discriminated-union validation; GDPR webhook HMAC (accept/reject); billing activation state transitions; `proxy.event` beacon (HMAC + plan gate); plan-gating (location cap, widget-type gate); client-side geo/filter/open-now pure functions (extracted into testable modules). Keep existing suite green.

**Acceptance:** `npm test` green; `npm run build` produces a deployable worker; documented deploy steps are accurate.

---

## 9. Out of scope (YAGNI, v1)

- Per-store SEO landing pages / store detail routes.
- Multi-language beyond theme defaults / i18n framework.
- Heavy client-state libraries on storefront.
- POS embedding (kept `pos.embedded = false`).
- Contact form on Single Store (schema flag reserved, off).

---

## 10A. UI/UX & widget manageability (quality bar)

The admin must feel native to Shopify and give merchants **full, easy control** over every widget.

### 10A.1 Admin experience (Polaris + App Bridge)
- Native Polaris throughout: consistent `Page`/`Card`/`Layout`, loading skeletons, save bars, toasts, error banners, empty states, and contextual help text on every field.
- **Home dashboard** = onboarding checklist (1 Add locations → 2 Create a widget → 3 Add the block to your theme → 4 Go live) with live progress, plus quick stats (locations, views, searches) and a "View plan" nudge.
- **Locations**: searchable/filterable/sortable table, bulk actions (activate/deactivate/delete), CSV/XLSX import entry point; edit form with a **map picker** (click to set lat/lng) + one-click **geocode from address**, hours editor (per-day open/close, closed toggle), services/category tags, image URL.

### 10A.2 Widget editor — full options, easy to manage
- **Widget list**: cards/table showing name, **type badge**, provider, published status, theme handle (copy-to-clipboard); "Create widget" opens a **type gallery** (each of the 5 types with a thumbnail + one-line description; locked types show an upgrade nudge on Free).
- **Create/Edit** screen with a **two-pane layout**: left = grouped settings, right = **live preview** that renders the real storefront widget (sandboxed iframe loading the same bundle against sample/live data) and updates as settings change.
- **Every setting editable** with the right control: provider select (OSM/Google) + Google key link; map default center via interactive map picker + zoom slider; search radius; **color pickers** (primary, marker, background/text) and font selector (theme fonts + web-safe); toggles for hours / phone / directions / near-me / clustering / filters; category facet manager; and **type-specific** controls (Map+List: sidebar side, results per page; Finder: hero height, filter bar; Carousel: cards per view, autoplay, mini-map; List/Grid: columns, map link; Single: store picker).
- Sensible defaults so a widget works with zero config; **"how to add to your theme" guide** with the exact handle and deep link to the theme editor; duplicate-widget and preview-on-storefront actions.
- Plan gating is friendly: locked controls are visible but disabled with an inline "Upgrade to Premium" explanation (never a dead end).

### 10A.3 Storefront widget aesthetics
- Clean, modern, responsive designs that inherit theme fonts/colors by default and respect the merchant's chosen palette; smooth interactions (hover/active states, focus rings), skeleton/loading states, graceful empties and errors; fully keyboard-accessible and screen-reader labeled.
- Distinctive but not templated — use the frontend-design skill for aesthetic direction on both admin custom surfaces and the 5 storefront views.

**Acceptance:** a non-technical merchant can create, fully customize (via live preview), publish, and embed any widget type without documentation; every config field has a visible control and inline help; admin passes an accessibility pass.

---

## 10. High-level build order

1. Version + scope bump; verify build/typecheck/tests green (Section A).
2. GDPR webhooks + settings completion (Section E) — unblock App Store early.
3. Widget `type` schema + config union + admin **type gallery + two-pane editor with live preview + full controls** + plan gating (Section B admin side, §10A.2).
4. Storefront refactor (client-side): provider interface (Leaflet + Google) + 5 views + client geocoding + near-me/filters/clustering/open-now + analytics beacon; edge-cached `locations.json`/`widget.json` feeds (Sections B storefront + C).
5. Pricing: 2-plan reseed + billing activation fix + fencing (Section D).
6. Theme extension updates (block settings, single-store block).
7. Home dashboard/onboarding checklist + locations map-picker/geocode + settings completion + admin UI polish pass (§10A).
8. Tests for all new surfaces; deploy runbook; publishing checklist (Section F).
9. End-to-end verification on a dev store; final review.
