-- ───────────────────────────────────────────────────────────────────────
-- Simple Store Locator — initial schema (matches app/lib/db/schema.ts).
-- Apply with `wrangler d1 migrations apply DB --local` (or --remote).
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE `plans` (
  `handle` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `price_cents` integer NOT NULL DEFAULT 0,
  `currency` text NOT NULL DEFAULT 'USD',
  `interval` text NOT NULL DEFAULT 'every_30_days',
  `trial_days` integer NOT NULL DEFAULT 0,
  `max_locations` integer NOT NULL DEFAULT 5,
  `max_imports_per_month` integer NOT NULL DEFAULT 1,
  `max_storefront_requests_per_day` integer NOT NULL DEFAULT 1000,
  `features` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `is_active` integer NOT NULL DEFAULT 1
);
--> statement-breakpoint

CREATE TABLE `shops` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_domain` text NOT NULL,
  `owner_email` text,
  `locale` text,
  `timezone` text,
  `plan_handle` text NOT NULL DEFAULT 'free' REFERENCES `plans`(`handle`) ON DELETE SET DEFAULT,
  `settings` text,
  `installed_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `uninstalled_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_shop_domain_uniq` ON `shops`(`shop_domain`);
--> statement-breakpoint

CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `shop` text NOT NULL,
  `state` text NOT NULL,
  `is_online` integer NOT NULL DEFAULT 0,
  `scope` text,
  `expires` integer,
  `access_token` text,
  `user_id` text,
  `first_name` text,
  `last_name` text,
  `email` text,
  `account_owner` integer DEFAULT 0,
  `locale` text,
  `collaborator` integer DEFAULT 0,
  `email_verified` integer DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `sessions_shop_idx` ON `sessions`(`shop`);
--> statement-breakpoint

CREATE TABLE `subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `plan_handle` text NOT NULL REFERENCES `plans`(`handle`),
  `shopify_charge_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `confirmation_url` text,
  `trial_ends_at` integer,
  `current_period_ends_at` integer,
  `cancelled_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `subscriptions_shop_idx` ON `subscriptions`(`shop_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_active_uniq` ON `subscriptions`(`shop_id`) WHERE `status` = 'active';
--> statement-breakpoint

CREATE TABLE `locations` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `address_line1` text,
  `address_line2` text,
  `city` text,
  `region` text,
  `postal_code` text,
  `country_code` text,
  `latitude` real,
  `longitude` real,
  `phone` text,
  `email` text,
  `website` text,
  `description` text,
  `image_url` text,
  `hours` text,
  `services` text,
  `custom_fields` text,
  `external_id` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `locations_shop_idx` ON `locations`(`shop_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_shop_slug_uniq` ON `locations`(`shop_id`, `slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_shop_external_uniq` ON `locations`(`shop_id`, `external_id`);
--> statement-breakpoint
CREATE INDEX `locations_lat_lng_idx` ON `locations`(`latitude`, `longitude`);
--> statement-breakpoint
CREATE INDEX `locations_status_idx` ON `locations`(`shop_id`, `status`);
--> statement-breakpoint

CREATE TABLE `widgets` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `handle` text NOT NULL,
  `name` text NOT NULL,
  `provider` text NOT NULL DEFAULT 'leaflet',
  `config` text NOT NULL,
  `is_published` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `widgets_shop_handle_uniq` ON `widgets`(`shop_id`, `handle`);
--> statement-breakpoint

CREATE TABLE `imports` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `filename` text NOT NULL,
  `r2_key` text NOT NULL,
  `kind` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `total_rows` integer NOT NULL DEFAULT 0,
  `processed_rows` integer NOT NULL DEFAULT 0,
  `failed_rows` integer NOT NULL DEFAULT 0,
  `error_summary` text,
  `started_at` integer,
  `completed_at` integer,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `imports_shop_idx` ON `imports`(`shop_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `imports_status_idx` ON `imports`(`status`);
--> statement-breakpoint

CREATE TABLE `analytics_events` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `event_type` text NOT NULL,
  `location_id` text REFERENCES `locations`(`id`) ON DELETE SET NULL,
  `widget_id` text REFERENCES `widgets`(`id`) ON DELETE SET NULL,
  `query` text,
  `country_code` text,
  `ip_hash` text,
  `user_agent` text,
  `referer` text,
  `properties` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `analytics_shop_time_idx` ON `analytics_events`(`shop_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `analytics_type_idx` ON `analytics_events`(`shop_id`, `event_type`, `created_at`);
--> statement-breakpoint

CREATE TABLE `quota_usage` (
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `period` text NOT NULL,
  `kind` text NOT NULL,
  `value` integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY(`shop_id`, `period`, `kind`)
);
--> statement-breakpoint

CREATE TABLE `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `shop_id` text NOT NULL REFERENCES `shops`(`id`) ON DELETE CASCADE,
  `actor` text,
  `action` text NOT NULL,
  `entity_type` text,
  `entity_id` text,
  `metadata` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE INDEX `audit_shop_time_idx` ON `audit_log`(`shop_id`, `created_at`);
