DROP INDEX `idx_jobs_company_slug`;--> statement-breakpoint
ALTER TABLE `jobs` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `jobs` DROP COLUMN `norm_version`;