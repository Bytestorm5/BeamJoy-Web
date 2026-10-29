-- Edited by hand: drizzle-kit's copy selected the new columns from the old table, and D1 wants
-- `defer_foreign_keys` rather than `foreign_keys=OFF` (which it ignores inside a migration).
-- Records from before this kept no start: circuits' go on the flying board (their laps are mostly
-- flying), point-to-point routes' on the standing one (grid runs, the most common kind).
PRAGMA defer_foreign_keys = true;--> statement-breakpoint
CREATE TABLE `__new_route_records` (
	`route_id` text NOT NULL,
	`user_id` text NOT NULL,
	`start` text DEFAULT 'standing' NOT NULL,
	`player_name` text DEFAULT '' NOT NULL,
	`best_lap_ms` integer NOT NULL,
	`best_lap_vehicle` text DEFAULT '' NOT NULL,
	`best_lap_sectors` text,
	`best_lap_at` integer NOT NULL,
	`best_sectors` text,
	`theoretical_ms` integer,
	`laps` integer DEFAULT 0 NOT NULL,
	`run` text,
	`run_lap` integer,
	`before_run` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`route_id`, `user_id`, `start`),
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_route_records`("route_id", "user_id", "start", "player_name", "best_lap_ms", "best_lap_vehicle", "best_lap_sectors", "best_lap_at", "best_sectors", "theoretical_ms", "laps", "updated_at") SELECT r."route_id", r."user_id", CASE WHEN routes."loopable" THEN 'flying' ELSE 'standing' END, r."player_name", r."best_lap_ms", r."best_lap_vehicle", r."best_lap_sectors", r."best_lap_at", r."best_sectors", r."theoretical_ms", r."laps", r."updated_at" FROM `route_records` r JOIN `routes` ON routes."id" = r."route_id";--> statement-breakpoint
DROP TABLE `route_records`;--> statement-breakpoint
ALTER TABLE `__new_route_records` RENAME TO `route_records`;--> statement-breakpoint
CREATE INDEX `route_records_lap_idx` ON `route_records` (`route_id`,`start`,`best_lap_ms`);--> statement-breakpoint
CREATE INDEX `route_records_theory_idx` ON `route_records` (`route_id`,`start`,`theoretical_ms`);--> statement-breakpoint
CREATE INDEX `route_records_user_idx` ON `route_records` (`user_id`);
