ALTER TABLE `jobs` ADD `is_remote` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `job_locations` (
	`job_id` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_job_locations_country_city` ON `job_locations` (`country`,`city`);--> statement-breakpoint
CREATE INDEX `idx_job_locations_job` ON `job_locations` (`job_id`);
