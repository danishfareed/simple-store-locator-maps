-- ───────────────────────────────────────────────────────────────────────
-- Reprice to a 2-plan model: `free` + `premium`.
--
-- Legacy tiers (starter/pro/unlimited) are DEACTIVATED (is_active=0), not
-- deleted, so historical subscription rows keep their FK to plans.handle.
--
-- The two live plans are upserted so this migration is idempotent and also
-- corrects the free-plan caps seeded in 0001 (was 5 locations → now 3).
-- ───────────────────────────────────────────────────────────────────────

UPDATE `plans` SET `is_active` = 0 WHERE `handle` IN ('starter','pro','unlimited');

INSERT INTO `plans`
  (`handle`, `name`, `price_cents`, `currency`, `interval`, `trial_days`,
   `max_locations`, `max_imports_per_month`, `max_storefront_requests_per_day`,
   `features`, `sort_order`, `is_active`)
VALUES
  ('free',    'Free',    0,    'USD', 'every_30_days', 0, 3,   1,    20000,
   '["osm","map_list_widget","csv_import","basic_analytics"]', 1, 1),
  ('premium', 'Premium', 1499, 'USD', 'every_30_days', 7, 100, 1000, 500000,
   '["osm","google_maps","all_widgets","csv_import","xlsx_import","full_analytics","custom_theme","clustering","filters","near_me","remove_branding"]', 2, 1)
ON CONFLICT(`handle`) DO UPDATE SET
  `name`                            = excluded.`name`,
  `price_cents`                     = excluded.`price_cents`,
  `trial_days`                      = excluded.`trial_days`,
  `max_locations`                   = excluded.`max_locations`,
  `max_imports_per_month`           = excluded.`max_imports_per_month`,
  `max_storefront_requests_per_day` = excluded.`max_storefront_requests_per_day`,
  `features`                        = excluded.`features`,
  `sort_order`                      = excluded.`sort_order`,
  `is_active`                       = 1;
