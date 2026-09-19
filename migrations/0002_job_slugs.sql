ALTER TABLE `jobs` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_jobs_company_slug` ON `jobs` (`company`,`slug`);
