-- idx_jobs_source_company already serves source-only lookups through its prefix.
DROP INDEX IF EXISTS `idx_jobs_source`;--> statement-breakpoint
-- The column has always held board keys ("greenhouse/stripe"), not company names.
ALTER TABLE `crawls` RENAME COLUMN `company` TO `board`;
