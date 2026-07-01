-- ───────────────────────────────────────────────────────────────────────
-- Add widget `type` column (map_list | finder | carousel | list | single).
-- Existing rows default to `map_list` (the free-plan widget type).
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE `widgets` ADD `type` text NOT NULL DEFAULT 'map_list';
