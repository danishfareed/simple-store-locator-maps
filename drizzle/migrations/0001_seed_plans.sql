-- Seed default plan tiers. Idempotent via INSERT OR IGNORE.

INSERT OR IGNORE INTO `plans`
  (`handle`, `name`, `price_cents`, `currency`, `interval`, `trial_days`,
   `max_locations`, `max_imports_per_month`, `max_storefront_requests_per_day`,
   `features`, `sort_order`, `is_active`)
VALUES
  ('free',      'Free',      0,    'USD', 'every_30_days', 0,  5,   1,   5000,   '["leaflet","csv_import","basic_analytics"]', 1, 1),
  ('starter',   'Starter',   990,  'USD', 'every_30_days', 14, 50,  5,   25000,  '["leaflet","csv_import","xlsx_import","analytics","custom_theme"]', 2, 1),
  ('pro',       'Pro',       2990, 'USD', 'every_30_days', 14, 500, 30,  100000, '["leaflet","google_maps","csv_import","xlsx_import","analytics","custom_theme","bulk_actions","webhooks"]', 3, 1),
  ('unlimited', 'Unlimited', 7990, 'USD', 'every_30_days', 14, 100000, 1000, 1000000, '["leaflet","google_maps","csv_import","xlsx_import","analytics","custom_theme","bulk_actions","webhooks","priority_support"]', 4, 1);
