CREATE VIRTUAL TABLE `jobs_fts` USING fts5(
  `title`,
  `company`,
  `location`,
  `department`,
  `job_id` UNINDEXED
);--> statement-breakpoint
INSERT INTO `jobs_fts` (`title`, `company`, `location`, `department`, `job_id`)
SELECT `title`, `company`, `location`, `department`, `id` FROM `jobs`;
