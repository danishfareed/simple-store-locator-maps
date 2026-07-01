# Simple Store Locator

Shopify embedded app (React Router 7 + Cloudflare Workers) for merchants to manage store locations, bulk-import via CSV/XLSX, and embed a storefront widget via a theme app extension.

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

## First-time setup

1. **Install deps**

   ```sh
   npm install
   ```

2. **Create Cloudflare resources**

   ```sh
   wrangler login
   wrangler d1 create simple-store-locator
   wrangler r2 bucket create simple-store-locator-uploads
   wrangler queues create simple-store-locator-imports
   wrangler queues create simple-store-locator-imports-dlq
   ```

   Paste the D1 `database_id` into [wrangler.toml](wrangler.toml).

3. **Apply migrations**

   ```sh
   npm run db:migrate:local      # local D1 (for `wrangler dev`)
   npm run db:migrate:remote     # hosted D1
   ```

4. **Link to your Shopify app**

   ```sh
   npm run shopify:config:link   # wires shopify.app.toml to your app
   ```

5. **Secrets**

   ```sh
   wrangler secret put SHOPIFY_API_KEY
   wrangler secret put SHOPIFY_API_SECRET
   wrangler secret put SESSION_SECRET
   ```

6. **Dev**

   ```sh
   npm run dev                   # Shopify CLI (tunnel + HMR)
   # — or —
   npm run dev:rr                # raw React Router dev
   ```

7. **Deploy**

   ```sh
   npm run deploy                # build + wrangler deploy
   npm run shopify:deploy        # push extensions/ + app config
   ```

## Theme extension

The storefront block lives in `extensions/store-locator-block/` and is embedded via the theme editor under **Add section → Apps → Store Locator**. It calls the app proxy at `https://<shop>/apps/store-locator/...` which is routed through `proxy.*` routes — those verify the Shopify HMAC signature before serving JSON.

## Tests

```sh
npm test            # Vitest run once
npm run test:watch  # watch mode
```

## Deployment environments

```
wrangler deploy --env staging
wrangler deploy --env production
```
