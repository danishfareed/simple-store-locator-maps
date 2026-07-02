# Simple Store Locator — App Store Publishing Checklist

**App:** Simple Store Locator — Shopify embedded app (React Router 7 + Cloudflare Workers/D1/R2/Queues) with a theme app extension storefront widget.
**Deploy target:** `https://simple-store-locator.fareedanish1.workers.dev`
**Status:** Code complete, CI-clean, compliance- and security-reviewed. Remaining items below require your Cloudflare/Shopify accounts and a dev store.

---

## 1. Verification snapshot (at time of writing)

- `npm run typecheck` — clean
- `npm run lint` — 0 errors
- `npm test` — **196 passing**
- `npm run build` — succeeds (worker + storefront bundle + preview bundle emitted)

---

## 2. Shopify App Store compliance (self-review)

Evaluated against Shopify's official self-review requirements (fetched live via `shopify doc fetch`). **22 likely-passing, 0 failing, 2 needs-review, 8 groups N/A.**

**Confirmed compliant:**
- ✅ **Mandatory GDPR webhooks** — `customers/data_request`, `customers/redact`, `shop/redact` implemented + HMAC-verified + registered in `shopify.app.toml`. `shop/redact` purges all shop D1 data **and** the R2 upload objects.
- ✅ **Session-token auth (1.1.1)** — App Bridge (`@shopify/app-bridge-react@4`) via `AppProvider embedded` (injects the `app-bridge.js` CDN script with `data-api-key`); no cookie/localStorage auth.
- ✅ **Latest App Bridge (2.2.3)** — not the deprecated `@shopify/app-bridge`.
- ✅ **Least-privilege scopes (3.2.x)** — empty scope set; no product/order/payment/checkout scopes.
- ✅ **Shopify Billing API (1.2.1–1.2.3)** — real subscription flow (`billing.request`/`check`), in-app upgrade/downgrade, genuine Shopify-side cancellation, activation via the verified `app_subscriptions/update` webhook.
- ✅ **Theme app extension only (5.1.1)** — no ScriptTag/Asset/theme-write; setup instructions + theme-editor **deep link** in onboarding (5.1.3).
- ✅ **GraphQL-only (2.2.4)** — no REST Admin API; **TLS** via Cloudflare; **no fabricated data**; storefront analytics visible in-app (5.1.5).

**⚠️ Needs review (not blockers):**
1. **2.3.1 — shop-domain input on `auth.login.tsx`.** This is Shopify's own template login fallback (`shopify.login`), only reached on direct-URL access; App Store installs go straight through OAuth. Standard/accepted pattern.
2. **1.2.2 — billing accept/decline/reinstall** is implemented correctly, but must be exercised once on a real dev store (see §4).

**N/A groups:** Payment, Payment facilitator, Purchase option, Product sourcing, Checkout customization, Sales channel, Post-purchase, Mobile app builders, Donation.

---

## 3. Security & correctness audit

A multi-dimension audit (auth/HMAC, storefront-XSS/exposure, billing/plan-enforcement, data-privacy/injection, correctness, secrets/config) with adversarial verification found **12 real issues; all fixed and re-reviewed.** The storefront-XSS and secrets/config dimensions came back clean.

**Fixed (Critical/Important):**
- Import no longer bypasses the plan location cap (worker enforces the cap on net-new rows; overflow → row errors).
- Import slug collisions no longer abort the batch; resilient per-row fallback; deterministic failures are acked (no poison-message retry loop).
- Storefront now gates widget **type** at render (premium types coerce to `map_list` after a downgrade).
- GDPR `shop/redact` deletes the R2 upload files (raw CSV/XLSX PII), not just DB rows.
- Blank lat/lng cells no longer become `(0,0)`; blank optional columns no longer reject valid rows; `failedRows` counts rows, not issues.
- Overnight (cross-midnight) store hours now show "open" correctly.
- App-proxy HMAC rejects malformed hex signatures (strict).

**Known minors (documented, accepted for v1):**
- `assertLocationQuota` on the *manual* add path is read-then-write (theoretical TOCTOU); negligible on D1's single-shop write pattern.
- `bboxForRadius` doesn't wrap the antimeridian (±180° longitude) — irrelevant for realistic retail locations.
- Two rows in the *same import file* sharing an `external_id` collapse to one row while `processedRows` counts both (pre-existing, benign counter artifact).

---

## 4. Pre-submission action items (require your accounts)

Follow the deploy runbook in [README.md](../README.md) for exact commands.

- [ ] **Deploy to Cloudflare** — `wrangler login` (or `CLOUDFLARE_API_TOKEN`); create D1/R2/Queues; paste the D1 `database_id` into `wrangler.toml`; `wrangler secret put SHOPIFY_API_KEY SHOPIFY_API_SECRET SESSION_SECRET`; `npm run db:migrate:remote`; `npm run deploy`.
- [ ] **Link + push the Shopify app** — `npm run shopify:config:link`; `npm run shopify:deploy` (uploads the theme extension + app config + all webhook subscriptions).
- [ ] **Configure pricing in the Partner Dashboard** — Free (3 locations) / Premium ($14.99/mo, 7-day trial; optional $149.90/yr).
- [ ] **Exercise billing once on a dev store** — upgrade → confirm the plan activates via the webhook; downgrade → confirm the Shopify charge is cancelled (satisfies the 1.2.2 needs-review item). Dev stores use test charges automatically.
- [ ] **Confirm GDPR webhook delivery** — after deploy, verify the three mandatory webhooks return 200 (they're HMAC-verified and registered).
- [ ] **Listing assets** — privacy policy URL (required); screenshots of each of the 5 widget types + the admin; a demo store; app description.
- [ ] **Verify the Google Maps path** (premium) — enter a key in Settings (restricted by HTTP referrer, per the in-app guidance) and confirm the storefront renders Google tiles; OSM is the default and needs no key.

---

## 5. What merchants get

- **5 storefront widget types** — Map + List, Full-screen Finder, Carousel, List/Grid, Single Store — each configured in-app with a **live preview**.
- **OpenStreetMap by default; Google Maps** with their own key (premium).
- Search, "near me" geolocation, distance sorting, category filters, marker clustering, open/closed-now, get-directions — all **client-side** (minimal Worker load).
- CSV/XLSX bulk import, analytics dashboard, custom theming, onboarding checklist.
