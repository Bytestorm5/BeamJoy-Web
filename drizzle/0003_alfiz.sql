CREATE TABLE `alfiz_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alfiz_audit_at_idx` ON `alfiz_audit` (`at`,`id`);--> statement-breakpoint
CREATE INDEX `alfiz_audit_target_idx` ON `alfiz_audit` (`target`);--> statement-breakpoint
CREATE TABLE `alfiz_catalog` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alfiz_catalog_versions` (
	`version` integer PRIMARY KEY NOT NULL,
	`published_at` integer NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alfiz_event_head` (
	`id` integer PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`pruned_through` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alfiz_events` (
	`seq` integer PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alfiz_events_at_idx` ON `alfiz_events` (`at`);--> statement-breakpoint
CREATE TABLE `alfiz_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`scope` text NOT NULL,
	`role_id` text,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alfiz_grants_subject_idx` ON `alfiz_grants` (`subject`);--> statement-breakpoint
CREATE INDEX `alfiz_grants_scope_idx` ON `alfiz_grants` (`scope`);--> statement-breakpoint
CREATE TABLE `alfiz_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alfiz_imports` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alfiz_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`requester_user_id` text NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alfiz_requests_state_idx` ON `alfiz_requests` (`state`);--> statement-breakpoint
CREATE TABLE `alfiz_revokes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alfiz_revokes_user_idx` ON `alfiz_revokes` (`user_id`);--> statement-breakpoint
CREATE TABLE `alfiz_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alfiz_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`doc` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `alfiz_event_head` (`id`, `seq`, `pruned_through`) VALUES (1, 0, 0);
