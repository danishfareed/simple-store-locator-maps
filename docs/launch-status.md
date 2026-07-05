# Launch Status — Simple Store Locator

_Single source of truth for the live deployment + App Store submission. Last updated during launch._

## TL;DR
- **Live app URL (buyer-facing):** `https://storelocator.vdesignu.com`
- **Cloudflare Worker:** `simple-store-locator` (account `a3749936…`)
- **Shopify app:** linked (client_id `817cac4e2f1d3f929fb87ef43571d6e9`), handle `storelocator-vdesignu`, distribution = **Public**, currently **installed on the `vdesignu-dev` development store** for testing.
- **GitHub:** `github.com/danishfareed/simple-store-locator-maps` (branch `main`).
- **State:** deployed, installed, and (after the routing/Polaris fix) rendering. Remaining work = App Store listing assets + submit.

---

## Infrastructure (Cloudflare) — DONE
| Resource | Value |
|---|---|
| Worker | `simple-store-locator` |
| Custom domain | `storelocator.vdesignu.com` — attached via the Cloudflare **account API** (`Workers → Domains`), **not** a `wrangler.toml routes` entry. See note below. |
| D1 database | `simple-store-locator` (`database_id` in `wrangler.toml`), migrations `0000`–`0003` applied `--remote`, plans seeded (free/premium active). |
| R2 bucket | `simple-store-locator-uploads` (accessed via the `UPLOADS` Worker binding). |
| Queues | `simple-store-locator-imports` (+ `-dlq`). |
| Secrets set | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SESSION_SECRET`. |

**Why the custom domain is not in `wrangler.toml`:** the deploy token is account-scoped (Workers + D1/R2/Queues) and lacks the zone-level **Workers Routes** permission that wrangler's `custom_domain` reconciliation needs (it 403s). So the domain is managed out-of-band via the account API, and `wrangler deploy` just ships the Worker. To manage it via config instead, use a token with **Zone → Workers Routes → Edit** and re-add a `routes` block.

**Deploying the Worker:** `npm run deploy` (build + `wrangler deploy`). Needs `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID`) in the env.

## Shopify app — DONE (config) / IN PROGRESS (listing)
- App created + linked via `shopify app config link` (writes `client_id` to `shopify.app.toml`).
- Config + theme extension pushed via `shopify app deploy` (interactive — needs a fresh CLI login; sessions are short-lived).
- `application_url`, OAuth redirect URLs, and app-proxy URL all point at `storelocator.vdesignu.com`.
- **GDPR/compliance webhooks** are declared under `[webhooks.privacy_compliance]` (the required format — they are NOT topic subscriptions).
- **Distribution:** Public. A public app can only install on **development stores** until Shopify approves it — that's why `vdesignu-dev` can install it now but regular stores show "under review".
- **Install link for a dev store:** `https://storelocator.vdesignu.com/auth/login?shop=<dev-store>.myshopify.com` (open while logged into that store as owner).

## Fixes made during launch (so they don't recur)
1. **Extension layout** — a theme app extension may only contain `assets/blocks/locales/snippets`. The widget source lives OUTSIDE the extension at `extensions-src/store-locator-block/src/`; `scripts/build-extension.mjs` bundles it into the extension's `assets/`. Added `locales/en.default.json`.
2. **GDPR webhooks** — moved from topic subscriptions to `[webhooks.privacy_compliance]` (Shopify rejects those topics as regular subscriptions).
3. **App handle** — must be globally unique → `storelocator-vdesignu`.
4. **URLs** — removed the legacy `/auth/shopify/callback` redirect (App Store rejects "shopify" in app URLs).
5. **Embedded-load crash** (`MissingAppProviderError`) — `app.tsx` now wraps the app in the Polaris React `<AppProvider i18n>` (our pages use `@shopify/polaris` React components, which require it). The Shopify `AppProvider` alone only provides App Bridge + Polaris web components.
6. **Routing** — the admin was mounted pathless (`/`) while all links used `/app/*`. Now nested under `/app` via `route("app", …)`, with a root `index` (`app/routes/_index.tsx`) that redirects `/ → /app` preserving the embedded query params.

## Remaining to submit (Dev Dashboard, no code)
- [ ] Choose primary listing language (English) — unlocks the automated checks.
- [ ] Select **"My app won't use customer data"** (accurate; the app stores its own location data).
- [ ] Upload app icon → `brand/app-icon.png` (1200×1200, committed in repo).
- [ ] Set API contact email (no "shopify" in it) + emergency contact.
- [ ] Interact with the app on `vdesignu-dev` so the automated embedded checks capture session-token data.
- [ ] Fill the listing (name without "Shopify", tagline, description, screenshots of the 5 widget types, pricing Free / Premium $14.99) → **Submit for review**.

## Compliance & quality (already verified)
- App Store self-review (`shopify-app-store-review`): **0 failing.**
- Multi-dimension security + correctness audit: all confirmed findings fixed + re-reviewed.
- `npm run lint` / `typecheck` / `test` (196) / `build` all green.

See also: [publishing-checklist.md](publishing-checklist.md) and [superpowers/specs/2026-07-01-store-locator-completion-design.md](superpowers/specs/2026-07-01-store-locator-completion-design.md).
