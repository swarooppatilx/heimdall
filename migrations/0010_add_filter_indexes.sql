CREATE INDEX IF NOT EXISTS `idx_jobs_source` ON `jobs` (`source`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_department` ON `jobs` (`department`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_experience_level` ON `jobs` (`experience_level`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_employment_type` ON `jobs` (`employment_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_jobs_is_remote` ON `jobs` (`is_remote`);
