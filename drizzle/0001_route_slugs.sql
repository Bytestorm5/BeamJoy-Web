-- Public slugs for routes. Existing rows (none in production when this shipped) get their id as
-- a placeholder slug so the unique index can be built.
ALTER TABLE `routes` ADD `slug` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `routes` SET `slug` = `id` WHERE `slug` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `routes_slug_unique` ON `routes` (`slug`);--> statement-breakpoint
-- Map keys become slugs too: base-game level folders -> hyphenated slugs, `custom:x` -> `x`.
UPDATE `routes` SET `map_key` = CASE `map_key`
  WHEN 'west_coast_usa' THEN 'west-coast-usa'
  WHEN 'east_coast_usa' THEN 'east-coast-usa'
  WHEN 'jungle_rock_island' THEN 'jungle-rock-island'
  WHEN 'johnson_valley' THEN 'johnson-valley'
  WHEN 'hirochi_raceway' THEN 'hirochi-raceway'
  WHEN 'automation_test_track' THEN 'automation-test-track'
  WHEN 'small_island' THEN 'small-island'
  WHEN 'driver_training' THEN 'driver-training'
  WHEN 'gridmap_v2' THEN 'gridmap-v2'
  ELSE `map_key` END WHERE `map_kind` = 'vanilla';--> statement-breakpoint
UPDATE `routes` SET `map_key` = substr(`map_key`, 8) WHERE `map_key` LIKE 'custom:%';
