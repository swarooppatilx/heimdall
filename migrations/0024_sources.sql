-- The boards we crawl, moved out of registry.json so adding or retiring one is
-- a row change, not a deploy. `degraded` is set by the cron from crawl drift;
-- `dead` only by hand.
CREATE TABLE `sources` (
  `board` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `name` text NOT NULL,
  `label` text,
  `status` text DEFAULT 'active' NOT NULL,
  `added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_sources_status` ON `sources` (`status`);
