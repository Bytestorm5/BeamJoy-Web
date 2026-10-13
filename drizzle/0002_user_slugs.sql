-- Public profile slugs. Existing rows (none in production when this shipped) get a placeholder
-- derived from their rowid so the unique index can be built.
ALTER TABLE `users` ADD `slug` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `users` SET `slug` = 'driver-' || rowid WHERE `slug` = '';--> statement-breakpoint
CREATE UNIQUE INDEX `users_slug_unique` ON `users` (`slug`);
