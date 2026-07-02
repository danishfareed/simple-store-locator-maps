# Simple Store Locator

Shopify embedded app (React Router 7 + Cloudflare Workers) for merchants to manage store locations, bulk-import via CSV/XLSX, and embed a storefront widget via a theme app extension.

## Features

- **5 widget types**: Map + list (the classic locator), Store finder (hero search + filters), Carousel, List, and Single location — pick a layout per widget, drop it in via the theme editor.
- **Maps**: Leaflet + OpenStreetMap by default (no key required); merchants can switch to Google Maps by supplying their own API key in Settings.
- **Pricing**: 2 plans — **Free** (3 locations, Map + list widget only, OSM only, CSV import) and **Premium** ($14.99/mo or $149.90/yr, 7-day free trial — 100 locations, all 5 widget types, Google Maps, CSV/XLSX import, clustering, near-me, filters, custom theming, branding removal).
- **Client-side-first storefront**: the theme extension ships a small framework-free JS bundle that fetches widget config + locations from the app proxy at render time and renders in the browser — no SSR dependency for the storefront widget itself. The same render code powers the live preview in the admin (via `postMessage` into an iframe).
- **Bulk import**: CSV/XLSX uploads go to R2 and are processed asynchronously by a Cloudflare Queue (with a dead-letter queue for failures).
- **GDPR-compliant**: implements the mandatory `customers/data_request`, `customers/redact`, and `shop/redact` webhooks, plus `app/uninstalled` and `app_subscriptions/update`.

## Stack

- **Framework**: React Router 7 (framework mode) — future-ready for v8.
- **Shopify**: `@shopify/shopify-app-react-router`, App Bridge, Polaris.
- **Runtime**: Cloudflare Workers.
- **Database**: Cloudflare D1 via Drizzle ORM.
- **File storage**: Cloudflare R2 (import uploads).
- **Background jobs**: Cloudflare Queues (import pipeline).
- **Maps**: Leaflet + OSM by default; Google Maps when the merchant supplies a key.

## Project layout

```
app/
  components/            generic UI
  features/              feature-scoped UI (locations, imports, widgets, analytics)
  routes/                React Router route modules (admin + auth + proxy + webhooks)
  lib/
    shopify/             Shopify adapter + HMAC helpers
    db/                  Drizzle schema + client
    auth/                requireAdmin / requireStorefront gates
    billing/             billing config helpers
    utils/               slug, geo, etc.
  repositories/          typed D1 queries
  services/              business logic (location, import, widget, analytics, quota, billing, provider)
  schemas/               Zod input schemas
  entry.server.tsx
  root.tsx
  routes.ts              explicit route config (RR7 programmatic routing)
  shopify.server.ts
workers/app.ts           Cloudflare Worker entry (fetch + queue)
drizzle/migrations/      D1 migrations
extensions/              Shopify theme extension(s)
fixtures/                sample CSV
tests/                   Vitest
```

## Deploy runbook (Cloudflare + Shopify, from scratch)

This app deploys as a Cloudflare Worker (backend + admin UI) that Shopify's app framework talks to, plus a theme app extension pushed to Shopify. Existing production config already targets:

- App URL: `https://storelocator.vdesignu.com` (set in [`shopify.app.toml`](shopify.app.toml) and [`wrangler.toml`](wrangler.toml))
- Cloudflare `account_id`: already set in [`wrangler.toml`](wrangler.toml)

### 1. Prerequisites

- Node.js **>= 20**.
- A [Cloudflare account](https://dash.cloudflare.com/sign-up), authenticated locally via either:
  ```sh
  wrangler login
  # — or, for CI / non-interactive environments —
  export CLOUDFLARE_API_TOKEN=...
  ```
- A [Shopify Partner account](https://partners.shopify.com/) with this app created (or permission to link to an existing one) and a development store for testing.
- `npm install` to pull down dependencies.

### 2. Create the Cloudflare resources

```sh
wrangler d1 create simple-store-locator
```
Copy the returned `database_id` into [`wrangler.toml`](wrangler.toml), replacing the placeholder:
```toml
[[d1_databases]]
binding = "DB"
database_name = "simple-store-locator"
database_id = "REPLACE_WITH_D1_ID"   # <- paste the id here
```

```sh
wrangler r2 bucket create simple-store-locator-uploads
wrangler queues create simple-store-locator-imports
wrangler queues create simple-store-locator-imports-dlq
```

These names already match the bindings in `wrangler.toml` (`UPLOADS`, `IMPORT_QUEUE`, and the `dead_letter_queue`), so no further edits are needed once the D1 id is in place.

### 3. Set secrets

Non-secret vars (`SHOPIFY_APP_URL`, `SHOPIFY_API_VERSION`, `APP_ENV`) already live in `wrangler.toml` under `[vars]`. Secrets are pushed separately and never committed:

```sh
wrangler secret put SHOPIFY_API_KEY
wrangler secret put SHOPIFY_API_SECRET
wrangler secret put SESSION_SECRET      # 32+ random chars, e.g. `openssl rand -hex 32`
```

`SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` come from the app's **Client ID** / **Client secret** in the Partner Dashboard (or are filled in automatically after step 6's `shopify:config:link`).

### 4. Run migrations against the remote D1 database

```sh
npm run db:migrate:remote
```

(Use `npm run db:migrate:local` separately when developing against `wrangler dev`'s local D1.)

### 5. Build and deploy the Worker

```sh
npm run deploy
```

This runs `npm run build` (React Router client/server build → `node scripts/build-worker.mjs` → `node scripts/build-extension.mjs`, emitting the Worker bundle, the storefront widget bundle, and the admin preview bundle) followed by `wrangler deploy`. Once it completes, the app is live at `https://storelocator.vdesignu.com`.

### 6. Link and push the Shopify app config + extension

```sh
npm run shopify:config:link    # wires shopify.app.toml to your Partner Dashboard app
npm run shopify:deploy         # pushes shopify.app.toml (incl. webhook subscriptions),
                                # the app proxy config, and the theme app extension
```

`shopify:deploy` pushes:
- The theme app extension in `extensions/store-locator-block/` (two blocks: **Store Locator** and **Store — Single Location**).
- App config from `shopify.app.toml`, including the app proxy (`/apps/store-locator` → `.../proxy`) and the webhook subscriptions (`app/uninstalled`, `app_subscriptions/update`, `customers/data_request`, `customers/redact`, `shop/redact`).

### 7. Configure billing and the app proxy in the Partner Dashboard

- **Pricing**: create 2 plans — **Free** and **Premium** ($14.99/mo, 7-day trial; optionally add a $149.90/yr annual option on the same tier). These mirror `app/lib/billing/plans.ts` and `drizzle/migrations/0003_reprice_plans.sql`, which are the source of truth for plan caps/features server-side.
- **App proxy**: confirm subpath `store-locator` under prefix `apps` (already declared in `shopify.app.toml`'s `[app_proxy]` block and pushed by `shopify:deploy`) — this is what the storefront widget calls for widget/location data.

### 8. Merchant setup (post-install)

1. **Add locations** — manually or via CSV/XLSX bulk import (Settings → Import).
2. **Create a widget** — pick one of the 5 types (Map + list, Store finder, Carousel, List, Single location; non-`map_list` types require Premium) and configure its map provider, theme, and filters.
3. **Add the block in the theme editor** — Online Store → Themes → Customize → Add section/block → Apps → **Store Locator** (or **Store — Single Location** for a focused single-store page) → select the widget's handle in the block settings.

## Theme extension

The storefront block lives in `extensions/store-locator-block/` and is embedded via the theme editor under **Add section → Apps → Store Locator** (or **Store — Single Location**). It calls the app proxy at `https://<shop>/apps/store-locator/...`, routed through the `proxy.*` routes (`app/routes/proxy.widget.ts`, `proxy.locations.ts`, `proxy.search.ts`, `proxy.event.ts`) — those verify the Shopify HMAC signature before serving JSON.

## Local development

```sh
npm run dev                   # Shopify CLI (tunnel + HMR)
# — or —
npm run dev:rr                # raw React Router dev
```

## Tests

```sh
npm test            # Vitest run once
npm run test:watch  # watch mode
```

## Verification

```sh
npm run lint         # eslint .
npm run typecheck    # react-router typegen && tsc --noEmit
npm test             # vitest run
npm run build        # react-router build + worker + extension bundles
```

## Deployment environments

```sh
wrangler deploy --env staging
wrangler deploy --env production
```
