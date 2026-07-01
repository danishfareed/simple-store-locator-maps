import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/*
 * D1 / SQLite notes:
 *  - Booleans stored as integer (0/1), surfaced via `mode: "boolean"`.
 *  - Timestamps stored as integer unix-ms for fast sort + indexable range.
 *  - JSON stored as text, surfaced via `mode: "json"` so callers get typed objects.
 *  - UUIDs are 16-byte text (crypto.randomUUID()) at insert time; cheap on D1.
 */

export const shops = sqliteTable(
  "shops",
  {
    id: text("id").primaryKey(), // shop myshopify domain
    shopDomain: text("shop_domain").notNull(),
    ownerEmail: text("owner_email"),
    locale: text("locale"),
    timezone: text("timezone"),
    planHandle: text("plan_handle")
      .notNull()
      .default("free")
      .references(() => plans.handle, { onDelete: "set default" }),
    settings: text("settings", { mode: "json" }).$type<ShopSettings>(),
    installedAt: integer("installed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    uninstalledAt: integer("uninstalled_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byShopDomain: uniqueIndex("shops_shop_domain_uniq").on(t.shopDomain),
  }),
);

export interface ShopSettings {
  mapProvider?: "leaflet" | "google";
  googleMapsApiKey?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultZoom?: number;
  unitSystem?: "metric" | "imperial";
  branding?: { primaryColor?: string; logoUrl?: string };
}

/* ───────────── Shopify OAuth sessions ───────────── */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    shop: text("shop").notNull(),
    state: text("state").notNull(),
    isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
    scope: text("scope"),
    expires: integer("expires", { mode: "timestamp_ms" }),
    accessToken: text("access_token"),
    userId: text("user_id"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    accountOwner: integer("account_owner", { mode: "boolean" }).default(false),
    locale: text("locale"),
    collaborator: integer("collaborator", { mode: "boolean" }).default(false),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  },
  (t) => ({
    byShop: index("sessions_shop_idx").on(t.shop),
  }),
);

/* ───────────── Billing ───────────── */
export const plans = sqliteTable("plans", {
  handle: text("handle").primaryKey(), // free | starter | pro | unlimited
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  interval: text("interval").notNull().default("every_30_days"), // or "annual"
  trialDays: integer("trial_days").notNull().default(0),
  maxLocations: integer("max_locations").notNull().default(5),
  maxImportsPerMonth: integer("max_imports_per_month").notNull().default(1),
  maxStorefrontRequestsPerDay: integer("max_storefront_requests_per_day")
    .notNull()
    .default(1000),
  features: text("features", { mode: "json" }).$type<string[]>(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    planHandle: text("plan_handle")
      .notNull()
      .references(() => plans.handle),
    shopifyChargeId: text("shopify_charge_id"),
    status: text("status", {
      enum: ["pending", "active", "cancelled", "expired", "declined", "frozen"],
    })
      .notNull()
      .default("pending"),
    confirmationUrl: text("confirmation_url"),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp_ms" }),
    currentPeriodEndsAt: integer("current_period_ends_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byShop: index("subscriptions_shop_idx").on(t.shopId),
    activeByShop: uniqueIndex("subscriptions_active_uniq")
      .on(t.shopId)
      .where(sql`${t.status} = 'active'`),
  }),
);

/* ───────────── Locations ───────────── */
export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["active", "inactive", "draft"] })
      .notNull()
      .default("active"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    countryCode: text("country_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    description: text("description"),
    imageUrl: text("image_url"),
    hours: text("hours", { mode: "json" }).$type<LocationHours>(),
    services: text("services", { mode: "json" }).$type<string[]>(),
    customFields: text("custom_fields", { mode: "json" }).$type<
      Record<string, string | number | boolean | null>
    >(),
    externalId: text("external_id"), // merchant-provided ref for import idempotency
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byShop: index("locations_shop_idx").on(t.shopId),
    shopSlugUniq: uniqueIndex("locations_shop_slug_uniq").on(t.shopId, t.slug),
    shopExternalUniq: uniqueIndex("locations_shop_external_uniq").on(
      t.shopId,
      t.externalId,
    ),
    byLatLng: index("locations_lat_lng_idx").on(t.latitude, t.longitude),
    byStatus: index("locations_status_idx").on(t.shopId, t.status),
  }),
);

export interface LocationHours {
  // ISO weekday 1=Monday … 7=Sunday
  [day: string]: { open: string; close: string; closed?: boolean }[] | undefined;
}

/* ───────────── Widgets ───────────── */
export const widgets = sqliteTable(
  "widgets",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    provider: text("provider", { enum: ["leaflet", "google"] })
      .notNull()
      .default("leaflet"),
    config: text("config", { mode: "json" }).$type<WidgetConfig>().notNull(),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    shopHandleUniq: uniqueIndex("widgets_shop_handle_uniq").on(t.shopId, t.handle),
  }),
);

export interface WidgetConfig {
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  searchRadiusKm?: number;
  showHours?: boolean;
  showPhone?: boolean;
  showDirections?: boolean;
  filters?: { services?: string[]; countries?: string[] };
  theme?: {
    primaryColor?: string;
    markerColor?: string;
    fontFamily?: string;
  };
}

/* ───────────── Imports ───────────── */
export const imports = sqliteTable(
  "imports",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    r2Key: text("r2_key").notNull(),
    kind: text("kind", { enum: ["csv", "xlsx"] }).notNull(),
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    totalRows: integer("total_rows").notNull().default(0),
    processedRows: integer("processed_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    errorSummary: text("error_summary", { mode: "json" }).$type<ImportError[]>(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byShop: index("imports_shop_idx").on(t.shopId, t.createdAt),
    byStatus: index("imports_status_idx").on(t.status),
  }),
);

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

/* ───────────── Analytics ───────────── */
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: ["search", "view", "click", "directions", "call", "impression"],
    }).notNull(),
    locationId: text("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    widgetId: text("widget_id").references(() => widgets.id, {
      onDelete: "set null",
    }),
    query: text("query"),
    countryCode: text("country_code"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    referer: text("referer"),
    properties: text("properties", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byShopTime: index("analytics_shop_time_idx").on(t.shopId, t.createdAt),
    byType: index("analytics_type_idx").on(t.shopId, t.eventType, t.createdAt),
  }),
);

/* ───────────── Quotas (rolling counters per shop per period) ───────────── */
export const quotaUsage = sqliteTable(
  "quota_usage",
  {
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // "2026-04" month or "2026-04-15" day
    kind: text("kind", {
      enum: ["locations", "imports", "storefront_requests"],
    }).notNull(),
    value: integer("value").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.shopId, t.period, t.kind] }),
  }),
);

/* ───────────── Audit log ───────────── */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    actor: text("actor"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byShopTime: index("audit_shop_time_idx").on(t.shopId, t.createdAt),
  }),
);

/* ───────────── Inferred row types ───────────── */
export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type Widget = typeof widgets.$inferSelect;
export type NewWidget = typeof widgets.$inferInsert;
export type ImportJob = typeof imports.$inferSelect;
export type NewImportJob = typeof imports.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type QuotaUsage = typeof quotaUsage.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
