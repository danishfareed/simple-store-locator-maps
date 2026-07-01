## 12) Final tech stack

Build Simple Store Locator with the following production stack:

### Core stack
- Framework: React Router 7 (framework mode)
- Shopify package: `@shopify/shopify-app-react-router`
- Admin UI: Shopify App Bridge + Polaris
- Runtime: Cloudflare Workers
- Database: Cloudflare D1
- File storage: Cloudflare R2
- Background jobs: Cloudflare Queues
- Language: TypeScript everywhere
- Validation: Zod
- ORM/query layer: Drizzle ORM preferred
- Forms: native React Router actions/forms first, minimal client-side form libs
- Maps frontend:
  - Default: Leaflet with OpenStreetMap-compatible tiles/provider
  - Optional: Google Maps only when merchant adds their own API key
- Tables/grids: lightweight server-driven tables for admin
- Charts: small lightweight charting library only for analytics pages if needed

### Why this stack
- Use Shopify’s official React Router stack for embedded app compatibility.
- Keep server logic on Cloudflare Workers for speed and simple deployment.
- Keep the codebase modular and future-ready for React Router 8.
- Avoid framework churn and avoid overengineering.

## 13) React Router 7, future-ready for v8

This app must be built on React Router 7, but the architecture should intentionally prepare for React Router 8 adoption later.

### Rules for future-ready React Router usage
- Use current React Router 7 framework conventions cleanly.
- Keep route modules isolated and small.
- Avoid custom hacks around the router internals.
- Prefer server-first data loading with loaders/actions.
- Keep mutations in route actions or clearly defined server handlers.
- Do not tightly couple business logic to UI components.
- Centralize request context and auth utilities.
- Use typed helpers for loader/action return values.
- Keep route config and file structure clean and explicit.
- Avoid legacy Remix-specific naming or packages unless required by migration compatibility.
- Keep package versions current within the React Router 7 line.

### Future flags strategy
Adopt React Router future flags progressively where stable and safe.

Target these React Router future flags where applicable:
- `future.v8_middleware`
- `future.v8_splitRouteModules`
- `future.v8_viteEnvironmentApi`

Only enable a future flag after verifying compatibility with the Shopify app package and build environment.

### Code organization rules
- Route files should mostly orchestrate data loading and rendering.
- Business logic must live in services.
- DB access must live in repositories/data modules.
- Shopify auth/session utilities must live in dedicated server modules.
- Billing logic must be isolated from UI.
- Storefront API logic must be isolated from admin route logic.
- Import pipeline logic must be isolated from route handlers.
- Analytics tracking must be isolated into service modules.
- Map-provider adapters must be abstracted behind a shared interface.

## 14) Folder architecture

Use a clean structure similar to:

```txt
/app
  /components
  /features
    /locations
    /imports
    /widgets
    /analytics
    /billing
    /settings
    /providers
  /routes
    app._index.tsx
    app.locations.tsx
    app.locations.new.tsx
    app.locations.$id.tsx
    app.imports.tsx
    app.widgets.tsx
    app.analytics.tsx
    app.settings.tsx
    app.billing.tsx
    auth.login.tsx
    auth.callback.tsx
    proxy.locations.ts
    proxy.search.ts
    proxy.widget.ts
    webhooks.app.uninstalled.ts
  /lib
    /shopify
    /db
    /auth
    /billing
    /cache
    /security
    /utils
  /services
    location.service.ts
    import.service.ts
    widget.service.ts
    analytics.service.ts
    quota.service.ts
    provider.service.ts
  /repositories
  /schemas
  /types
  root.tsx
  entry.server.tsx
  shopify.server.ts
```

## 15) Shopify-specific requirements

- Scaffold from Shopify’s official React Router template.
- Use `@shopify/shopify-app-react-router`.
- Use Shopify App Bridge for embedding in admin.
- Use Shopify billing flows officially supported by the package/runtime.
- Use Shopify webhooks for uninstall cleanup and app lifecycle.
- Use Theme App Extensions for storefront blocks.
- Use app proxy routes for storefront JSON/data endpoints.

## 16) Cloudflare-specific requirements

- App must run on Cloudflare Workers.
- Database access must support D1.
- Large imports and heavy processing must go through Queues.
- Images and uploaded files must go to R2.
- Public storefront data should be cacheable where appropriate.
- Secrets must remain server-side.
- Per-shop quotas must be enforced on the server.

## 17) Architecture constraints

Do not use:
- Remix-branded starter templates
- unnecessary monorepo complexity
- Prisma if it adds friction with D1 compared to a lighter D1-friendly ORM
- heavy client state libraries unless clearly required
- server logic inside client components
- direct trust of storefront requests for plan enforcement

## 18) Claude coding instructions

Claude must:
- generate production-grade TypeScript code,
- use Shopify’s React Router app structure,
- keep all core business logic framework-agnostic where possible,
- prepare code for future React Router 8 migration,
- avoid deprecated or legacy patterns,
- include clear env setup and Cloudflare deployment steps,
- include migrations and seed data,
- include sample CSV/XLSX files,
- include billing guards and quota guards,
- include app proxy validation,
- include theme app extension blocks,
- include tests for auth, billing guards, imports, and storefront endpoints.