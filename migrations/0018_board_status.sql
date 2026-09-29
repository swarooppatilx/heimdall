CREATE TABLE `board_status` (
	`board` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`jobs_found` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`error` text,
	`last_modified` text,
	`consecutive_empty` integer DEFAULT 0 NOT NULL,
	`changed_at` text,
	`crawled_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_crawls_company_id`;
--> statement-breakpoint
ALTER TABLE `crawls` DROP COLUMN `last_modified`;
--> statement-breakpoint
DELETE FROM `jobs_fts`;
--> statement-breakpoint
INSERT INTO `jobs_fts` (`title`, `company`, `location`, `department`, `job_id`)
SELECT `title`, `company`, `location`, `department`, `id` FROM `jobs`;
