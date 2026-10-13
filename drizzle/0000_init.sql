CREATE TABLE `route_images` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`url` text NOT NULL,
	`storage_key` text NOT NULL,
	`position` integer NOT NULL,
	`aspect` real,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `route_images_route_idx` ON `route_images` (`route_id`);--> statement-breakpoint
CREATE TABLE `route_tags` (
	`route_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`route_id`, `tag`),
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `route_tags_tag_idx` ON `route_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `routes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`author_id` text NOT NULL,
	`activity_type` text DEFAULT 'race' NOT NULL,
	`share_code` text NOT NULL,
	`map_kind` text NOT NULL,
	`map_key` text NOT NULL,
	`map_name` text NOT NULL,
	`map_download_url` text,
	`surface` text DEFAULT 'asphalt' NOT NULL,
	`video_url` text,
	`distance_m` integer NOT NULL,
	`max_distance_m` integer NOT NULL,
	`checkpoints` integer NOT NULL,
	`steps` integer NOT NULL,
	`corners` integer NOT NULL,
	`corners_auto` integer NOT NULL,
	`hairpins` integer NOT NULL,
	`grid_slots` integer NOT NULL,
	`loopable` integer NOT NULL,
	`branching` integer NOT NULL,
	`sectors` integer NOT NULL,
	`default_laps` integer,
	`race_mode` text NOT NULL,
	`elevation_gain_m` integer NOT NULL,
	`elevation_range_m` integer NOT NULL,
	`geometry` text NOT NULL,
	`copy_count` integer DEFAULT 0 NOT NULL,
	`cover_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routes_map_idx` ON `routes` (`map_key`);--> statement-breakpoint
CREATE INDEX `routes_author_idx` ON `routes` (`author_id`);--> statement-breakpoint
CREATE INDEX `routes_created_idx` ON `routes` (`created_at`);--> statement-breakpoint
CREATE INDEX `routes_distance_idx` ON `routes` (`distance_m`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
