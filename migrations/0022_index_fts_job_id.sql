-- job_id was UNINDEXED, so deleting a job's search row scanned the whole
-- index. Indexing it lets writes find rows through FTS; user searches are
-- limited to the text columns, so ids never match a query.
DROP TABLE IF EXISTS `jobs_fts`;--> statement-breakpoint
CREATE VIRTUAL TABLE `jobs_fts` USING fts5(
  `title`,
  `company`,
  `location`,
  `department`,
  `job_id`
);--> statement-breakpoint
INSERT INTO `jobs_fts` (`title`, `company`, `location`, `department`, `job_id`)
SELECT `title`, `company`, `location`, `department`, `id` FROM `jobs`;
