CREATE TABLE `crawls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company` text NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`jobs_found` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text NOT NULL,
	`department` text NOT NULL,
	`url` text NOT NULL,
	`posted_at` text NOT NULL,
	`source` text NOT NULL,
	`experience_level` text DEFAULT 'mid' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_posted_at` ON `jobs` (`posted_at`);--> statement-breakpoint
CREATE INDEX `idx_jobs_company_posted_at` ON `jobs` (`company`,`posted_at`);