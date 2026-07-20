UPDATE `jobs` SET `company` = lower(`company`) WHERE `company` != lower(`company`);--> statement-breakpoint
UPDATE `jobs`
SET `location` = lower(`location`),
    `city` = lower(`city`),
    `country` = lower(`country`)
WHERE `location` != lower(`location`)
   OR (`city` IS NOT NULL AND `city` != lower(`city`))
   OR (`country` IS NOT NULL AND `country` != lower(`country`));--> statement-breakpoint
UPDATE `jobs`
SET `employment_type` = replace(lower(`employment_type`), '_', ' ')
WHERE `employment_type` LIKE '%\_%' ESCAPE '\'
   OR `employment_type` != lower(`employment_type`);--> statement-breakpoint
UPDATE `job_locations`
SET `city` = lower(`city`),
    `country` = lower(`country`)
WHERE `city` != lower(`city`)
   OR `country` != lower(`country`);--> statement-breakpoint
DELETE FROM `job_locations` WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM `job_locations` GROUP BY `job_id`, `city`, `country`
);
