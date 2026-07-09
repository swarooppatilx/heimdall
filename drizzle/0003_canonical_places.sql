ALTER TABLE `jobs` ADD `city` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `country` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `norm_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_jobs_city_country` ON `jobs` (`city`,`country`);
