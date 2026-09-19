-- Frozen derived-field rows: legacy ingests predate isRemote derivation and
-- diffJobs never rewrites unchanged rows, so location='remote' rows kept
-- is_remote=0 forever.
UPDATE `jobs` SET `is_remote` = 1 WHERE `location` = 'remote' AND `is_remote` = 0;

-- Korea split buckets: both spellings were canonical in the gazetteer set.
UPDATE `jobs` SET `country` = 'south korea' WHERE `country` = 'korea';
UPDATE `job_locations` SET `country` = 'south korea' WHERE `country` = 'korea';

-- Facet orphans from dedupeCrossSourceJobs deleting jobs without cleanup.
DELETE FROM `job_locations` WHERE `job_id` NOT IN (SELECT `id` FROM `jobs`);
