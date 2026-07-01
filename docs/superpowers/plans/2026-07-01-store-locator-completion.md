# Simple Store Locator — Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Simple Store Locator into a seamless, competitive, App-Store-publishable Shopify app with 5 storefront widget types, OSM-default + Google-Maps (BYO key) rendering, a full-featured admin widget editor, 2-plan pricing, GDPR webhooks, and Cloudflare deployment.

**Architecture:** React Router 7 (framework mode) embedded app on Cloudflare Workers + D1 (Drizzle) + R2 + Queues. Admin is Polaris + App Bridge. Storefront is a theme app extension (vanilla JS bundle) that renders any of 5 widget types, doing search/filter/sort/geocode/near-me/open-now **client-side** against one edge-cached locations feed. Only trust-sensitive work (HMAC, plan/quota enforcement, billing, imports, config/data feeds, analytics beacon) stays on the Worker.

**Tech Stack:** React Router 7.18.1, `@shopify/shopify-app-react-router` 1.2.x, Polaris 13.x, App Bridge React 4.x, Drizzle ORM, Zod, Leaflet + Leaflet.markercluster, Google Maps JS SDK (dynamic), Vitest, Wrangler 4, esbuild (worker + extension bundle).

## Global Constraints

- React Router pinned to the **7.x** line (target `7.18.1`); do NOT introduce RR8/React 19/RSC (breaks `@shopify/shopify-app-react-router` peer `^7.6.2`).
- React stays **18**; Vite stays on the **6.x** line; Node engine `>=20`.
- Shopify API version = **`2026-04`** everywhere (`shopify.app.toml`, `wrangler.toml` `SHOPIFY_API_VERSION`, webhook `api_version`).
- Access scopes = **empty** (`scopes = ""`); no `read_products`/`write_products`.
- Business logic lives in `services/`; DB access in `repositories/`; Zod schemas in `schemas/`; Shopify/session/auth in `lib/`. Route modules orchestrate only. Server-only modules end in `.server.ts`.
- All storefront/data endpoints under `proxy.*` MUST verify the Shopify app-proxy HMAC before returning data; all `webhooks.*` MUST verify the webhook HMAC.
- **Client-side-first**: storefront does search/filter/sort/distance/near-me/open-now/geocoding in the browser; the Worker serves cached feeds + config + a lightweight analytics beacon only.
- Pricing = exactly **2 active plans**: `free` and `premium`. Premium price **$14.99/mo** (`1499` cents) with a **7-day trial**; optional **annual** `$149.90/yr` (`14990` cents) as an interval on the same plan.
- Free caps: **3 locations**, `map_list` widget type only, OSM only, CSV import (bounded by the 3-location cap), "Powered by" shown. Premium: **100 locations**, all 5 types, OSM+Google, CSV+XLSX, full analytics, custom theming, clustering/filters/near-me, "Powered by" removed.
- Widget `type` ∈ `map_list | finder | carousel | list | single`. The in-app widget record is the single source of truth for type + config; the theme block only references a widget by handle.
- TDD for logic (schemas, services, geo, webhooks, billing, quotas); typecheck + build + manual/preview verification for UI. Commit after each task. Never claim done without running the stated verification command.

---

## File Structure (created / modified)

**Config & foundation**
- Modify: `package.json` (dep versions), `wrangler.toml`, `shopify.app.toml`, `.env.example`.

**Schema & migrations**
- Modify: `app/lib/db/schema.ts` (widget `type`, config union type, shop settings fields).
- Create: `drizzle/migrations/0002_widget_type.sql`, `drizzle/migrations/0003_reprice_plans.sql`.
- Modify: `app/schemas/widget.schema.ts` (discriminated union), `app/schemas/settings.schema.ts` (new).

**Services / repositories**
- Modify: `app/services/widget.service.server.ts`, `app/repositories/widget.repository.server.ts`, `app/services/billing.service.server.ts`, `app/services/quota.service.server.ts`, `app/lib/billing/plans.ts`, `app/services/provider.service.server.ts`.
- Create: `app/services/settings.service.server.ts`, `app/services/gdpr.service.server.ts`, `app/repositories/shop.repository.server.ts` (if not present; else extend).

**Routes — admin**
- Modify: `app/routes/app._index.tsx` (dashboard/onboarding), `app/routes/app.widgets.tsx` (list), `app/routes/app.billing.tsx`, `app/routes/app.settings.tsx`, `app/routes/app.locations.$id.tsx`, `app/routes/app.locations.new.tsx`, `app/routes.ts`.
- Create: `app/routes/app.widgets.new.tsx`, `app/routes/app.widgets.$id.tsx`, `app/routes/app.widgets.preview.tsx` (preview data/iframe host).

**Routes — proxy & webhooks**
- Modify: `app/routes/proxy.widget.ts`, `app/routes/proxy.locations.ts`.
- Create: `app/routes/proxy.event.ts`, `app/routes/webhooks.customers.data_request.ts`, `app/routes/webhooks.customers.redact.ts`, `app/routes/webhooks.shop.redact.ts`.

**Admin UI components (features)**
- Create: `app/features/widgets/WidgetTypeGallery.tsx`, `app/features/widgets/WidgetEditor.tsx`, `app/features/widgets/WidgetPreview.tsx`, `app/features/widgets/typeControls/*.tsx`, `app/features/widgets/widget-types.ts` (client-safe type metadata), `app/features/locations/MapPicker.tsx`, `app/features/locations/HoursEditor.tsx`, `app/features/dashboard/OnboardingChecklist.tsx`.

**Storefront extension**
- Create (source): `extensions/store-locator-block/src/core.js`, `src/providers/{leaflet,google,base}.js`, `src/views/{mapList,finder,carousel,list,single}.js`, `src/lib/{geo,geocode,hours,directions,analytics,dom}.js`.
- Modify: `extensions/store-locator-block/blocks/store-locator.liquid`, `extensions/store-locator-block/assets/store-locator.css`, `extensions/store-locator-block/shopify.extension.toml`.
- Create: `extensions/store-locator-block/blocks/store-single.liquid` (single-store app block variant).
- Modify: `scripts/build-worker.mjs` or add `scripts/build-extension.mjs` to bundle `src/` → `assets/store-locator.js`.

**Shared pure logic (testable, used by both storefront and tests)**
- Create: `app/lib/utils/hours.ts` (open-now), `app/lib/utils/directions.ts` (deep links) — mirrored/imported into the extension bundle via the build.

**Tests**
- Create/modify under `tests/unit/**` and `tests/integration/**` per each task.

**Docs**
- Modify: `README.md`. Create: `docs/publishing-checklist.md`.

---

## Phase 0 — Foundation: versions, scope, API version

### Task 0.1: Bump React Router to 7.18.1 + adjust deps

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: pinned dependency versions used by all later tasks.

- [ ] **Step 1: Edit `package.json` dependency versions**

Set: `react-router`, `@react-router/dev`, `@react-router/cloudflare` → `^7.18.1`. Bump `wrangler` → `^4.106.0`, `@cloudflare/vite-plugin` → `^1.42.4`. Keep `react`/`react-dom` at `^18.3.1`, `vite` at `^6.4.2`, `@shopify/shopify-app-react-router` at `^1.2.1`, `@shopify/polaris` `^13.9.5`, `@shopify/app-bridge-react` `^4.2.11`, `@shopify/shopify-api` `^13.1.0`.

- [ ] **Step 2: Reinstall and check for peer conflicts**

Run: `npm install`
Expected: completes without `ERESOLVE` peer errors.

- [ ] **Step 3: Typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: all pass (baseline green after bump). Fix any RR7.18 type drift surfaced.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade React Router to 7.18.1 and bump Cloudflare tooling"
```

### Task 0.2: Set Shopify API version 2026-04 and drop product scopes

**Files:**
- Modify: `shopify.app.toml`, `wrangler.toml`, `.env.example`, `app/shopify.server.ts` (if it reads a scopes/apiVersion constant)

**Interfaces:**
- Produces: `SHOPIFY_API_VERSION="2026-04"`, empty scopes across config.

- [ ] **Step 1: Update `shopify.app.toml`**

Set `[access_scopes] scopes = ""`, `[webhooks] api_version = "2026-04"`. (Leave URL placeholders as-is; `config link` overwrites them.)

- [ ] **Step 2: Update `wrangler.toml` `[vars]`**

Set `SCOPES = ""` and `SHOPIFY_API_VERSION = "2026-04"`.

- [ ] **Step 3: Update `.env.example`** to reflect empty scopes + `2026-04`.

- [ ] **Step 4: Verify shopify.server config reads these**

Read `app/shopify.server.ts`; confirm `apiVersion`/`scopes` derive from env/config (adjust to `ApiVersion.April26` or the string `"2026-04"` as the package expects; if the enum lacks it, pass the string via `apiVersion`).

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add shopify.app.toml wrangler.toml .env.example app/shopify.server.ts
git commit -m "chore: target Shopify API 2026-04 and reduce scopes to least-privilege"
```

---

## Phase 1 — App Store unblockers: GDPR webhooks

### Task 1.1: GDPR service (data purge helpers)

**Files:**
- Create: `app/services/gdpr.service.server.ts`
- Test: `tests/unit/gdpr-service.test.ts`

**Interfaces:**
- Consumes: `Database` from `app/lib/db/client.server`, schema tables.
- Produces:
  - `export async function purgeShopData(db: Database, shopId: string): Promise<void>` — deletes locations, widgets, imports, analyticsEvents, quotaUsage, subscriptions, sessions, auditLog, and the shop row for `shopId` (order respects FKs; cascades cover children but delete explicitly for safety).
  - `export async function customerDataReport(db: Database, shopId: string, customerId: string): Promise<{ heldData: string[] }>` — returns human-readable list of data categories held (the app stores no customer PII beyond hashed IPs in analytics; return that fact).
  - `export async function redactCustomer(db: Database, shopId: string, customerId: string): Promise<void>` — no-op purge (no customer-keyed rows exist) but present for compliance; deletes any analytics rows tagged with the customer if such linkage is ever added.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, seedShop, countRows } from "../helpers/db"; // create helper if absent
import { purgeShopData, customerDataReport } from "../../app/services/gdpr.service.server";

describe("gdpr.service", () => {
  it("purgeShopData removes all rows for the shop", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1"); // inserts shop + a location + a widget + analytics row
    await purgeShopData(db, "s1");
    expect(await countRows(db, "shops", "s1")).toBe(0);
    expect(await countRows(db, "locations", "s1")).toBe(0);
    expect(await countRows(db, "widgets", "s1")).toBe(0);
    expect(await countRows(db, "analytics_events", "s1")).toBe(0);
  });

  it("customerDataReport lists held categories", async () => {
    const db = await makeTestDb();
    await seedShop(db, "s1");
    const r = await customerDataReport(db, "s1", "cust-1");
    expect(Array.isArray(r.heldData)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `npx vitest run tests/unit/gdpr-service.test.ts`
Expected: FAIL (module/functions not defined). If `makeTestDb`/helpers absent, create `tests/helpers/db.ts` using an in-memory D1 (better-sqlite3 or `@miniflare/d1`) or a Drizzle-over-libsql memory instance matching existing test patterns; if the repo already has a DB test helper, reuse it.

- [ ] **Step 3: Implement `gdpr.service.server.ts`**

Implement the three functions using Drizzle `delete(...).where(eq(table.shopId, shopId))` for each table in FK-safe order, then delete the shop. `customerDataReport` returns `{ heldData: ["No customer PII stored; storefront analytics use hashed IPs only."] }`. `redactCustomer` deletes any customer-linked analytics rows (currently none) and resolves.

- [ ] **Step 4: Run test, expect pass**

Run: `npx vitest run tests/unit/gdpr-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/gdpr.service.server.ts tests/unit/gdpr-service.test.ts tests/helpers/db.ts
git commit -m "feat: add GDPR data purge/report service with tests"
```

### Task 1.2: Three GDPR webhook routes + registration

**Files:**
- Create: `app/routes/webhooks.customers.data_request.ts`, `app/routes/webhooks.customers.redact.ts`, `app/routes/webhooks.shop.redact.ts`
- Modify: `app/routes.ts` (register routes), `shopify.app.toml` (subscriptions)
- Test: `tests/unit/gdpr-webhooks.test.ts`

**Interfaces:**
- Consumes: existing webhook HMAC verification (`verifyWebhook` in `app/lib/shopify/hmac.server.ts`) and the shopify webhook auth path used by `webhooks.app.uninstalled.ts` (mirror its exact pattern), `gdpr.service.server` funcs.
- Produces: HTTP 200 on valid HMAC, 401 on invalid.

- [ ] **Step 1: Read the existing uninstall webhook** (`app/routes/webhooks.app.uninstalled.ts`) to copy its auth/verification pattern exactly.

- [ ] **Step 2: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
// Mirror tests/unit/hmac.test.ts style: build a signed request, assert 200; tamper, assert 401.
import { action as dataRequest } from "../../app/routes/webhooks.customers.data_request";
// ...import redact + shop.redact actions

describe("gdpr webhooks", () => {
  it("customers/data_request returns 200 on valid HMAC", async () => {
    const res = await dataRequest({ request: signedWebhook("customers/data_request", body), context } as any);
    expect(res.status).toBe(200);
  });
  it("returns 401 on invalid HMAC", async () => {
    const res = await dataRequest({ request: tamperedWebhook(body), context } as any);
    expect(res.status).toBe(401);
  });
  // repeat for customers/redact and shop/redact; shop/redact should call purgeShopData
});
```

- [ ] **Step 3: Run test, expect fail**

Run: `npx vitest run tests/unit/gdpr-webhooks.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the three routes**

Each exports an `action` that: verifies HMAC via the same helper/authenticate path as uninstall; on success, `customers/data_request` → returns 200 (optionally logs the report), `customers/redact` → calls `redactCustomer`, `shop/redact` → resolves the shopId and calls `purgeShopData`; return `new Response(null, { status: 200 })`; on invalid HMAC return `new Response("Unauthorized", { status: 401 })`.

- [ ] **Step 5: Register routes in `app/routes.ts`** with paths `/webhooks/customers/data_request`, `/webhooks/customers/redact`, `/webhooks/shop/redact`.

- [ ] **Step 6: Register subscriptions in `shopify.app.toml`**

Add three `[[webhooks.subscriptions]]` blocks with topics `["customers/data_request"]`, `["customers/redact"]`, `["shop/redact"]` and matching `uri`s.

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run tests/unit/gdpr-webhooks.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/routes/webhooks.customers.data_request.ts app/routes/webhooks.customers.redact.ts app/routes/webhooks.shop.redact.ts app/routes.ts shopify.app.toml tests/unit/gdpr-webhooks.test.ts
git commit -m "feat: add mandatory GDPR webhooks (data_request, customers/redact, shop/redact)"
```

---

## Phase 2 — Data model & config

### Task 2.1: Widget `type` column + migration

**Files:**
- Modify: `app/lib/db/schema.ts`
- Create: `drizzle/migrations/0002_widget_type.sql`

**Interfaces:**
- Produces: `widgets.type` column typed `WidgetType = "map_list" | "finder" | "carousel" | "list" | "single"`; exported `WidgetType` type; `WidgetConfig` extended (see Task 2.2 for the union — schema stores config as JSON so DB type is the union).

- [ ] **Step 1: Add column to `widgets` table** in `schema.ts`:

```ts
type: text("type", { enum: ["map_list","finder","carousel","list","single"] })
  .notNull().default("map_list"),
```
Add `export type WidgetType = "map_list" | "finder" | "carousel" | "list" | "single";` and reference it. Extend `WidgetConfig` interface base with `clustering?: boolean; enableNearMe?: boolean; categories?: string[];` and per-type optional fields (see Task 2.2).

- [ ] **Step 2: Write the migration** `0002_widget_type.sql`:

```sql
ALTER TABLE `widgets` ADD `type` text NOT NULL DEFAULT 'map_list';
```

- [ ] **Step 3: Apply locally + typecheck**

Run: `npm run db:migrate:local && npm run typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add app/lib/db/schema.ts drizzle/migrations/0002_widget_type.sql
git commit -m "feat(db): add widget.type column and migration"
```

### Task 2.2: Widget config discriminated-union schema

**Files:**
- Modify: `app/schemas/widget.schema.ts`
- Test: `tests/unit/widget-schema.test.ts`

**Interfaces:**
- Produces:
  - `WidgetTypeEnum = z.enum(["map_list","finder","carousel","list","single"])`.
  - `BaseConfigSchema` (center, zoom, searchRadiusKm, showHours, showPhone, showDirections, clustering, enableNearMe, categories, filters, theme{primaryColor, markerColor, backgroundColor, textColor, fontFamily}).
  - `WidgetConfigSchema = z.discriminatedUnion("type", [mapListConfig, finderConfig, carouselConfig, listConfig, singleConfig])` where each variant = base fields + `type` literal + per-type extras (map_list: `sidebarPosition`, `resultsPerPage`; finder: `heroHeight`, `showFilterBar`; carousel: `cardsPerView`, `autoplay`, `showMiniMap`; list: `columns`, `showMapLink`; single: `locationId`, `showContactForm`).
  - `WidgetInputSchema` = `{ handle, name, provider, type, config, isPublished }` where `config` is validated against the variant matching `type` (use `z.discriminatedUnion` by embedding `type` in config, or a `superRefine` that picks the variant by top-level `type`).
  - `export type WidgetInput = z.infer<typeof WidgetInputSchema>`.

- [ ] **Step 1: Write failing tests**

```ts
import { WidgetInputSchema } from "../../app/schemas/widget.schema";

it("accepts a valid map_list widget", () => {
  const r = WidgetInputSchema.safeParse({
    handle: "default", name: "Store map", provider: "leaflet", type: "map_list",
    isPublished: true,
    config: { type: "map_list", sidebarPosition: "left", resultsPerPage: 10, defaultZoom: 10 },
  });
  expect(r.success).toBe(true);
});

it("rejects carousel-only fields on a list widget", () => {
  const r = WidgetInputSchema.safeParse({
    handle: "x", name: "n", provider: "leaflet", type: "list",
    isPublished: false, config: { type: "list", cardsPerView: 3 },
  });
  expect(r.success).toBe(false);
});

it("requires locationId for single type", () => {
  const r = WidgetInputSchema.safeParse({
    handle: "x", name: "n", provider: "leaflet", type: "single",
    isPublished: false, config: { type: "single" },
  });
  expect(r.success).toBe(false);
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run tests/unit/widget-schema.test.ts`.

- [ ] **Step 3: Implement the discriminated union** in `widget.schema.ts` with `type` as the discriminant inside `config`; `WidgetInputSchema` cross-checks top-level `type === config.type` via `.refine`.

- [ ] **Step 4: Run, expect pass.** Update the widget-schema existing test file if it referenced the old flat schema.

- [ ] **Step 5: Commit**

```bash
git add app/schemas/widget.schema.ts tests/unit/widget-schema.test.ts
git commit -m "feat: discriminated-union widget config schema per type"
```

### Task 2.3: Client-safe widget-type metadata

**Files:**
- Create: `app/features/widgets/widget-types.ts`
- Test: `tests/unit/widget-types.test.ts`

**Interfaces:**
- Produces: `export const WIDGET_TYPES: Record<WidgetType, { id: WidgetType; label: string; description: string; icon: string; requiresMap: boolean; requiresPremium: boolean }>` and `export const WIDGET_TYPE_ORDER: WidgetType[]`. `map_list.requiresPremium=false`; all others `true`.

- [ ] **Step 1: Test** — assert every `WidgetType` has an entry, only `map_list` is free, `list.requiresMap===false`.
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement** the metadata map.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** `feat: widget-type metadata for gallery + gating`.

### Task 2.4: Extend shop settings schema

**Files:**
- Create: `app/schemas/settings.schema.ts`
- Modify: `app/lib/db/schema.ts` (`ShopSettings` interface)
- Test: `tests/unit/settings-schema.test.ts`

**Interfaces:**
- Produces: `SettingsSchema` (Zod) covering `mapProvider`, `googleMapsApiKey`, `defaultLatitude`, `defaultLongitude`, `defaultZoom`, `unitSystem`, `branding{primaryColor, logoUrl}`, `osmGeocoderUrl?`. `export type SettingsInput = z.infer<...>`. Update `ShopSettings` interface to match.

- [ ] **Step 1: Test** valid + invalid (bad hex color, out-of-range lat) cases.
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement** schema + interface update.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** `feat: shop settings zod schema`.

---

## Phase 3 — Pricing & billing

### Task 3.1: Reprice to 2 plans (migration + plans config)

**Files:**
- Create: `drizzle/migrations/0003_reprice_plans.sql`
- Modify: `app/lib/billing/plans.ts`
- Test: `tests/unit/plans.test.ts`

**Interfaces:**
- Produces: `PLAN_FREE` and `PLAN_PREMIUM` constants with handles `free`/`premium`, caps per Global Constraints; `export const PLANS = [PLAN_FREE, PLAN_PREMIUM]`; helper `planFeatures(handle): string[]`, `planAllows(handle, feature): boolean`, `planMaxLocations(handle): number`, `planAllowsWidgetType(handle, type): boolean` (free → only `map_list`), `planAllowsProvider(handle, provider)`, `planShowsPoweredBy(handle): boolean`.

- [ ] **Step 1: Write the migration** `0003_reprice_plans.sql`:

```sql
-- Deactivate legacy tiers (keep rows to preserve historical subscriptions).
UPDATE `plans` SET `is_active` = 0 WHERE `handle` IN ('starter','pro','unlimited');
-- Upsert the two live plans.
INSERT INTO `plans` (`handle`,`name`,`price_cents`,`currency`,`interval`,`trial_days`,`max_locations`,`max_imports_per_month`,`max_storefront_requests_per_day`,`features`,`sort_order`,`is_active`)
VALUES
 ('free','Free',0,'USD','every_30_days',0,3,1,20000,'["osm","map_list_widget","csv_import","basic_analytics"]',1,1),
 ('premium','Premium',1499,'USD','every_30_days',7,100,1000,500000,'["osm","google_maps","all_widgets","csv_import","xlsx_import","full_analytics","custom_theme","clustering","filters","near_me","remove_branding"]',2,1)
ON CONFLICT(`handle`) DO UPDATE SET
 `name`=excluded.`name`,`price_cents`=excluded.`price_cents`,`trial_days`=excluded.`trial_days`,
 `max_locations`=excluded.`max_locations`,`max_imports_per_month`=excluded.`max_imports_per_month`,
 `max_storefront_requests_per_day`=excluded.`max_storefront_requests_per_day`,`features`=excluded.`features`,
 `sort_order`=excluded.`sort_order`,`is_active`=1;
```

- [ ] **Step 2: Rewrite `app/lib/billing/plans.ts`** to the two-plan model + helper functions listed in Interfaces. Include `PREMIUM_ANNUAL_CENTS = 14990` and an `interval` helper.

- [ ] **Step 3: Write tests** asserting: only `free`+`premium` active; `planAllowsWidgetType("free","carousel")===false`; `planAllowsWidgetType("premium","carousel")===true`; `planMaxLocations("free")===3`; `planShowsPoweredBy("premium")===false`.

- [ ] **Step 4: Run migration locally + tests**

Run: `npm run db:migrate:local && npx vitest run tests/unit/plans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(billing): 2-plan model (free/premium) + gating helpers`.

### Task 3.2: Billing activation correctness

**Files:**
- Modify: `app/services/billing.service.server.ts`, `app/routes/app.billing.tsx`
- Create: `app/routes/webhooks.app_subscriptions.update.ts`, register in `app/routes.ts` + `shopify.app.toml`
- Test: `tests/unit/billing-service.test.ts`

**Interfaces:**
- Consumes: Shopify billing API from `shopify.server`, `subscription.repository`, `plans`.
- Produces:
  - `createCharge(admin, db, shopId, planHandle, interval): Promise<{ confirmationUrl: string }>` — creates a Shopify subscription (with 7-day trial for premium) and stores a `pending` subscription with the real charge id.
  - `syncSubscriptionFromShopify(db, shopId, payload): Promise<void>` — on `app_subscriptions/update`, set status (`active`/`cancelled`/…) and, when active, set `shop.planHandle`; when cancelled/expired, downgrade to `free`.
  - `getActivePlanHandle(db, shopId): Promise<"free"|"premium">`.

- [ ] **Step 1: Write failing tests** for `syncSubscriptionFromShopify`: active payload → shop plan `premium` + subscription active; cancelled → shop plan `free`.
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement** the sync + fix the `pending` charge-id hardcode (store the id returned by Shopify). Add the `app_subscriptions/update` webhook route that verifies HMAC and calls `syncSubscriptionFromShopify`.
- [ ] **Step 4: Update `app.billing.tsx`** to show 2 plans + monthly/annual toggle, current-plan badge, and CTA that calls `createCharge` then redirects (App Bridge `Redirect`/`open`) to `confirmationUrl`.
- [ ] **Step 5: Register route + subscription** in `routes.ts` + `shopify.app.toml`.
- [ ] **Step 6: Run tests + typecheck.**
- [ ] **Step 7: Commit** `feat(billing): real activation via subscription webhook + 2-plan UI`.

### Task 3.3: Enforce plan gating in services

**Files:**
- Modify: `app/services/quota.service.server.ts`, `app/services/widget.service.server.ts`, `app/services/import.service.server.ts`, `app/services/provider.service.server.ts`
- Test: `tests/unit/plan-gating.test.ts`

**Interfaces:**
- Consumes: `plans` helpers, `getActivePlanHandle`.
- Produces:
  - `assertLocationQuota` already exists — ensure it reads `planMaxLocations(activePlan)` (3 for free).
  - `assertWidgetTypeAllowed(planHandle, type)` in `widget.service` — throws `PlanFeatureError` if not allowed.
  - `assertImportKindAllowed(planHandle, kind)` — free blocked from `xlsx`.
  - `resolveProvider` respects plan: free forced to `leaflet` regardless of widget `provider`.

- [ ] **Step 1: Tests** — free creating `carousel` throws; free `xlsx` import throws; free `google` provider resolves to `leaflet`; premium allows all.
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement** the guards + a `PlanFeatureError` class (mirror `QuotaExceededError`).
- [ ] **Step 4: Run, expect pass + typecheck.**
- [ ] **Step 5: Commit** `feat: server-side plan/feature gating`.

---

## Phase 4 — Admin widget management (full editor + live preview)

> UI tasks: verify via `npm run typecheck && npm run build`, plus a manual/preview check described in each task. Use the frontend-design skill for aesthetics.

### Task 4.1: Widget repository/service for multi-widget CRUD

**Files:**
- Modify: `app/repositories/widget.repository.server.ts`, `app/services/widget.service.server.ts`
- Test: `tests/unit/widget-service.test.ts`

**Interfaces:**
- Produces: `listWidgets(db, shopId)`, `getWidget(db, shopId, id)`, `getWidgetByHandle(db, shopId, handle)`, `saveWidget(db, shopId, input, id?)` (validates handle uniqueness per shop, enforces `assertWidgetTypeAllowed`), `deleteWidget(db, shopId, id)`, `duplicateWidget(db, shopId, id)`.

- [ ] **Step 1: Tests** for create/list/get/duplicate/delete + handle-uniqueness collision (auto-suffix).
- [ ] **Step 2: Run, expect fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** `feat: multi-widget CRUD service`.

### Task 4.2: Widget list route + type gallery

**Files:**
- Modify: `app/routes/app.widgets.tsx`
- Create: `app/features/widgets/WidgetTypeGallery.tsx`
- Modify: `app/routes.ts` (add `app.widgets.new`, `app.widgets.$id`)

**Interfaces:**
- Consumes: `listWidgets`, `WIDGET_TYPES`, active plan.
- Produces: list UI + "Create widget" → gallery → navigates to `app/widgets/new?type=<type>`.

- [ ] **Step 1:** Loader returns `{ widgets, plan }`. Render Polaris `Page` + `ResourceList`/`IndexTable` of widgets (name, type badge, provider, status, handle w/ copy button, edit/duplicate/delete actions). Empty state prompts creating the first widget.
- [ ] **Step 2:** `WidgetTypeGallery` renders 5 cards from `WIDGET_TYPES` (thumbnail/icon, label, description); premium-locked types show an "Upgrade" tag and route to billing.
- [ ] **Step 3:** Delete/duplicate via `action` intents.
- [ ] **Step 4:** Typecheck + build.
- [ ] **Step 5: Commit** `feat(admin): widget list + type gallery`.

### Task 4.3: Widget editor route (create/edit) with grouped controls

**Files:**
- Create: `app/routes/app.widgets.new.tsx`, `app/routes/app.widgets.$id.tsx`, `app/features/widgets/WidgetEditor.tsx`, `app/features/widgets/typeControls/{MapListControls,FinderControls,CarouselControls,ListControls,SingleControls}.tsx`

**Interfaces:**
- Consumes: `getWidget`, `saveWidget`, `WidgetInputSchema`, `WIDGET_TYPES`, locations list (for single-store picker + preview data), settings (provider/key).
- Produces: two-pane editor (`WidgetEditor`), `action` validates with `WidgetInputSchema` and calls `saveWidget`.

- [ ] **Step 1:** Both routes load `{ widget?, locations, plan, settings }` and render `WidgetEditor` with `mode`.
- [ ] **Step 2:** `WidgetEditor` = Polaris two-column layout: left = grouped `Card`s (General: name/handle/published/provider; Map: center via MapPicker + zoom slider + radius; Appearance: color pickers + font select; Behavior: toggles hours/phone/directions/near-me/clustering/filters + categories manager; Type-specific: the matching `typeControls` component). Right = `WidgetPreview` (Task 4.4). All state controlled; serialize to hidden form fields on submit; show inline validation from `useActionData` field errors.
- [ ] **Step 3:** Premium-only controls render disabled with an inline upgrade note when on free.
- [ ] **Step 4:** Typecheck + build; manual check that switching type swaps the type-specific controls.
- [ ] **Step 5: Commit** `feat(admin): full widget editor with grouped controls`.

### Task 4.4: Live preview (sandboxed iframe)

**Files:**
- Create: `app/features/widgets/WidgetPreview.tsx`, `app/routes/app.widgets.preview.tsx`

**Interfaces:**
- Consumes: current editor config (via `postMessage`), the storefront bundle, sample locations.
- Produces: an iframe that renders the actual storefront widget using the in-progress config so the merchant sees live changes.

- [ ] **Step 1:** `app.widgets.preview.tsx` serves a minimal HTML doc that loads the built `store-locator.js` + CSS and initializes a widget from a config passed via `postMessage` (and sample or real locations from the loader). It must NOT require the app-proxy HMAC (it's inside the embedded admin) — read locations directly via `requireAdmin`.
- [ ] **Step 2:** `WidgetPreview` renders `<iframe src="/app/widgets/preview">` and `postMessage`s the debounced config on every change; the preview re-renders. Include a viewport toggle (desktop/mobile) and provider note.
- [ ] **Step 3:** Typecheck + build; manual check preview updates on config change.
- [ ] **Step 4: Commit** `feat(admin): live widget preview iframe`.

---

## Phase 5 — Admin polish: dashboard, locations UX, settings

### Task 5.1: Home dashboard + onboarding checklist

**Files:**
- Modify: `app/routes/app._index.tsx`
- Create: `app/features/dashboard/OnboardingChecklist.tsx`

**Interfaces:**
- Consumes: counts (locations, widgets published), analytics summary, plan.
- Produces: dashboard with checklist (Add locations → Create widget → Add block to theme → Go live) + quick stats + plan card.

- [ ] **Step 1:** Loader returns counts + a `steps` object (each done/undone). Render checklist with progress + CTAs deep-linking to the relevant admin pages and the theme editor.
- [ ] **Step 2:** Quick-stats cards (locations, 30-day views/searches from analytics) + "Manage plan" nudge.
- [ ] **Step 3:** Typecheck + build; manual check.
- [ ] **Step 4: Commit** `feat(admin): home dashboard + onboarding checklist`.

### Task 5.2: Locations map-picker + geocode + hours editor

**Files:**
- Modify: `app/routes/app.locations.$id.tsx`, `app/routes/app.locations.new.tsx`, `app/features/locations/LocationForm.tsx`
- Create: `app/features/locations/MapPicker.tsx`, `app/features/locations/HoursEditor.tsx`

**Interfaces:**
- Consumes: settings (provider/key) for the picker map, `geo` utils.
- Produces: `MapPicker` (Leaflet map; click sets lat/lng; "Geocode from address" button geocodes client-side and drops the pin), `HoursEditor` (per-day open/close + closed toggle producing `LocationHours`).

- [ ] **Step 1:** `MapPicker` — Leaflet map in admin (client-only component; guard SSR). Emits `{lat,lng}`; "Use address" calls client geocoder.
- [ ] **Step 2:** `HoursEditor` — 7 rows, time inputs + closed checkbox → serializes to `LocationHours` JSON.
- [ ] **Step 3:** Wire both into `LocationForm`; ensure bulk actions exist on the locations table (activate/deactivate/delete) in `app.locations.tsx`.
- [ ] **Step 4:** Typecheck + build; manual check pin-drop + geocode + hours save.
- [ ] **Step 5: Commit** `feat(admin): location map picker, geocode, hours editor`.

### Task 5.3: Settings completion

**Files:**
- Modify: `app/routes/app.settings.tsx`
- Create: `app/services/settings.service.server.ts`

**Interfaces:**
- Consumes: `SettingsSchema`, shop repo.
- Produces: `getSettings(db, shopId)`, `saveSettings(db, shopId, input)`; settings form exposing all `SettingsSchema` fields incl. Google key with referrer-restriction guidance, default center/zoom (with a mini MapPicker), branding color + logo, unit system, optional OSM geocoder URL.

- [ ] **Step 1:** Implement service + loader/action with Zod validation.
- [ ] **Step 2:** Build the form with grouped cards + help text.
- [ ] **Step 3:** Typecheck + build; manual save round-trip.
- [ ] **Step 4: Commit** `feat(admin): complete settings (branding, defaults, google key guidance)`.

---

## Phase 6 — Storefront: proxy feeds + 5 views + providers

### Task 6.1: Proxy feed updates + analytics beacon

**Files:**
- Modify: `app/routes/proxy.widget.ts`, `app/routes/proxy.locations.ts`
- Create: `app/routes/proxy.event.ts`
- Modify: `app/routes.ts`, `app/services/analytics.service.server.ts`
- Test: `tests/unit/proxy-event.test.ts`

**Interfaces:**
- Produces: `proxy.widget.json` → `{ type, config, provider, providerMeta, timezone, showPoweredBy, googleMapsApiKey? }` (key only when provider resolves to google + present, subject to plan); `proxy.locations.json` unchanged shape but includes `services`/`categories`/`hours` fields needed client-side, edge-cached; `proxy.event` (POST) validates HMAC + plan, records an analytics event, returns 204.

- [ ] **Step 1:** Test `proxy.event` — valid HMAC + body → 204 and a recorded event (mock repo); invalid HMAC → 401.
- [ ] **Step 2:** Run, expect fail.
- [ ] **Step 3:** Implement feed field additions + `proxy.event` + register route.
- [ ] **Step 4:** Run tests + typecheck.
- [ ] **Step 5: Commit** `feat(proxy): widget/locations feed fields + analytics beacon`.

### Task 6.2: Shared client pure-logic modules (tested)

**Files:**
- Create: `app/lib/utils/hours.ts`, `app/lib/utils/directions.ts`
- Test: `tests/unit/hours.test.ts`, `tests/unit/directions.test.ts`

**Interfaces:**
- Produces: `isOpenNow(hours, nowInTz): { open: boolean; nextChange?: string }`; `directionsUrl(loc, provider: "google"|"apple"): string`. These are imported by both admin (optional) and the extension bundle (copied/aliased at build).

- [ ] **Step 1:** Tests: open/closed across day boundaries, closed day, missing hours; google/apple URL formats.
- [ ] **Step 2:** Run, expect fail.
- [ ] **Step 3:** Implement pure functions (no DOM).
- [ ] **Step 4:** Run, expect pass.
- [ ] **Step 5: Commit** `feat: open-now + directions pure utils`.

### Task 6.3: Storefront bundle — base, providers, core

**Files:**
- Create: `extensions/store-locator-block/src/lib/{geo,geocode,dom,analytics}.js`, `src/providers/{base,leaflet,google}.js`, `src/core.js`
- Create/Modify: `scripts/build-extension.mjs`, `package.json` build script, `extensions/store-locator-block/blocks/store-locator.liquid`

**Interfaces:**
- Produces: a common provider interface `createProvider(kind, {el, config, apiKey}) → { setView, addMarkers(locations,{cluster}), clearMarkers, fitBounds, on(evt,cb) }`; `core.js` boots a widget: reads `data-*`, fetches `widget.json` + `locations.json`, picks provider (google if config.provider==="google" && key else leaflet), picks view module, wires search/near-me/filters/analytics.

- [ ] **Step 1:** Implement `lib/geo.js` (haversine, bbox, sort-by-distance), `lib/geocode.js` (google geocoder if key else Nominatim/Photon w/ debounce + min length), `lib/dom.js` (escapeHtml, el helpers), `lib/analytics.js` (debounced beacon POST to `proxy.event`).
- [ ] **Step 2:** Implement `providers/base.js` (interface + shared), `providers/leaflet.js` (Leaflet + markercluster, dynamic CDN load), `providers/google.js` (dynamic SDK load with key + MarkerClusterer).
- [ ] **Step 3:** Implement `core.js` orchestration (no view rendering yet — delegates to a view module registry).
- [ ] **Step 4:** Add `scripts/build-extension.mjs` (esbuild bundling `src/core.js` → `assets/store-locator.js`, IIFE, minified) and hook it into `npm run build`. Update `.liquid` to load the bundle + pass `data-*` (handle, proxy base).
- [ ] **Step 5:** Build; verify bundle emits. Commit `feat(storefront): provider interface + core bootstrap + bundler`.

### Task 6.4: The 5 view modules

**Files:**
- Create: `extensions/store-locator-block/src/views/{mapList,finder,carousel,list,single}.js`
- Modify: `extensions/store-locator-block/assets/store-locator.css`

**Interfaces:**
- Consumes: provider instance, locations, config, `lib/*`.
- Produces: each view exports `render(root, ctx)` where `ctx = { provider, locations, config, onSearch, onNearMe, onFilter, track }`. Registered in `core.js` by `config.type`.

- [ ] **Step 1: `mapList`** — split map + sidebar list, search box, filter chips, near-me button, distance + open-now + directions per card; click card → center/pin.
- [ ] **Step 2: `finder`** — hero search bar over full-width map, results overlay/drawer, near-me.
- [ ] **Step 3: `carousel`** — horizontal scroll cards (cardsPerView, autoplay) + optional mini-map synced to active card.
- [ ] **Step 4: `list`** — responsive grid (columns), no map, optional "view on map" link (deep link).
- [ ] **Step 5: `single`** — one location (config.locationId): map + hours w/ open-now + phone/call + directions; used by the app-block variant too.
- [ ] **Step 6:** CSS for all views (responsive, container queries, theme variables from config colors/font, focus states, skeletons, "Powered by" footer when `showPoweredBy`). Build.
- [ ] **Step 7: Commit** `feat(storefront): 5 widget view types`.

### Task 6.5: Theme extension blocks + settings

**Files:**
- Modify: `extensions/store-locator-block/blocks/store-locator.liquid`, `extensions/store-locator-block/shopify.extension.toml`
- Create: `extensions/store-locator-block/blocks/store-single.liquid`

**Interfaces:**
- Produces: section block "Store Locator" (settings: `widget_handle`, `height`, cosmetic overrides) that renders whatever type the referenced widget declares; an app-block "Store — Single Location" for product/contact pages bound to a `single` widget handle.

- [ ] **Step 1:** Update `store-locator.liquid` schema + container `data-*`.
- [ ] **Step 2:** Add `store-single.liquid` (app block target) referencing a single widget handle.
- [ ] **Step 3:** Build + `shopify app deploy --dry-run`-style validation via CLI config check (or `npm run shopify:app -- ...` availability permitting). Commit `feat(storefront): theme blocks for locator + single store`.

---

## Phase 7 — Tests, docs, deploy

### Task 7.1: Integration tests for new flows

**Files:**
- Create: `tests/integration/{widget-crud,billing-activation,gdpr-purge}.test.ts`

- [ ] **Step 1:** Widget CRUD end-to-end via service against a test DB (create map_list on free ok; create carousel on free rejected; premium ok).
- [ ] **Step 2:** Billing activation: pending → active flips shop plan; cancel → free.
- [ ] **Step 3:** GDPR purge: seed shop w/ children → `shop/redact` action → all gone.
- [ ] **Step 4:** Run full suite `npm test`; fix failures.
- [ ] **Step 5: Commit** `test: integration coverage for widgets, billing, gdpr`.

### Task 7.2: Full verification pass

- [ ] **Step 1:** `npm run lint` — fix issues (or run the `fix` skill).
- [ ] **Step 2:** `npm run typecheck` — zero errors.
- [ ] **Step 3:** `npm run build` — worker + extension bundle emit.
- [ ] **Step 4:** `npm test` — all green.
- [ ] **Step 5: Commit** any fixes `chore: lint/typecheck/build/test green`.

### Task 7.3: Docs — README runbook + publishing checklist

**Files:**
- Modify: `README.md`
- Create: `docs/publishing-checklist.md`

- [ ] **Step 1:** Update README: new 2-plan pricing, widget types, client-side architecture, Google key setup + referrer restriction, deploy runbook (create D1/R2/queues → secrets → migrate:remote → deploy → shopify:deploy → set URLs), env vars.
- [ ] **Step 2:** `docs/publishing-checklist.md`: least-privilege scopes justification, GDPR webhooks confirmed, billing test steps, privacy policy URL placeholder, listing assets (screenshots of each widget type + admin), demo-store notes.
- [ ] **Step 3: Commit** `docs: deploy runbook + App Store publishing checklist`.

---

## Self-Review (author checklist — completed)

**Spec coverage:** §3A→Phase 0; §7 GDPR→Phase 1; §4.1-4.2 model→Phase 2; §6 pricing/billing→Phase 3; §4.3/§10A.2 editor+preview→Phase 4; §10A.1/§7 settings/dashboard/locations→Phase 5; §4.4/§4.5/§4.6/§5 storefront→Phase 6; §8 tests/deploy→Phase 7. All spec sections map to at least one task.

**Placeholder scan:** No "TBD/handle edge cases" left; test bodies and migration SQL are concrete; UI tasks specify controls + verification. (Test helper `tests/helpers/db.ts` is created in Task 1.1 if the repo lacks one — the executor must confirm the existing test DB pattern first and reuse it.)

**Type consistency:** `WidgetType` union identical across schema/metadata/gating; `WidgetInput` from `WidgetInputSchema`; provider interface method names (`setView/addMarkers/clearMarkers/fitBounds/on`) used consistently in providers + views; billing `getActivePlanHandle`/`syncSubscriptionFromShopify` names stable across tasks.

**Open executor notes:** (1) Confirm the existing DB test pattern before adding a helper. (2) Confirm the exact Shopify webhook auth pattern from `webhooks.app.uninstalled.ts` before writing GDPR routes. (3) Confirm `@shopify/shopify-api` `ApiVersion` enum member for 2026-04, else pass the string.
