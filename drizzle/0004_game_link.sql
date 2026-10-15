CREATE TABLE `game_links` (
	`device_hash` text PRIMARY KEY NOT NULL,
	`user_code` text NOT NULL,
	`player_name` text DEFAULT '' NOT NULL,
	`approved_by` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_links_user_code_unique` ON `game_links` (`user_code`);--> statement-breakpoint
CREATE TABLE `game_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`player_name` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_tokens_token_hash_unique` ON `game_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `game_tokens_user_idx` ON `game_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `level_maps` (
	`level` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`nodes` integer NOT NULL,
	`edges` integer NOT NULL,
	`bounds` text NOT NULL,
	`uploaded_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`server_key` text NOT NULL,
	`server_name` text NOT NULL,
	`level` text NOT NULL,
	`map_name` text NOT NULL,
	`reporter_id` text,
	`players` text DEFAULT '[]' NOT NULL,
	`player_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_sessions_slug_unique` ON `live_sessions` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_sessions_server_key_unique` ON `live_sessions` (`server_key`);--> statement-breakpoint
CREATE INDEX `live_sessions_updated_idx` ON `live_sessions` (`updated_at`);--> statement-breakpoint
CREATE TABLE `route_records` (
	`route_id` text NOT NULL,
	`user_id` text NOT NULL,
	`player_name` text DEFAULT '' NOT NULL,
	`best_lap_ms` integer NOT NULL,
	`best_lap_vehicle` text DEFAULT '' NOT NULL,
	`best_lap_sectors` text,
	`best_lap_at` integer NOT NULL,
	`best_sectors` text,
	`theoretical_ms` integer,
	`laps` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`route_id`, `user_id`),
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `route_records_lap_idx` ON `route_records` (`route_id`,`best_lap_ms`);--> statement-breakpoint
CREATE INDEX `route_records_theory_idx` ON `route_records` (`route_id`,`theoretical_ms`);--> statement-breakpoint
CREATE INDEX `route_records_user_idx` ON `route_records` (`user_id`);--> statement-breakpoint
ALTER TABLE `routes` ADD `prop_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `routes` ADD `level_id` text;--> statement-breakpoint
ALTER TABLE `routes` ADD `aerial_url` text;--> statement-breakpoint
ALTER TABLE `routes` ADD `aerial_key` text;--> statement-breakpoint
ALTER TABLE `routes` ADD `aerial_bounds` text;--> statement-breakpoint
CREATE INDEX `routes_course_idx` ON `routes` (`map_key`,`checkpoints`);