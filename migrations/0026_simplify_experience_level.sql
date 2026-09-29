-- Levels shrink to intern, entry, mid, senior and lead, and early career is
-- now just the intern and entry levels. Rows are remapped here; the refetch
-- from 0023 re-derives them under the new title rules on the next sweep.
-- Dropping is_early_career rewrites the jobs table once, about one row write
-- per job.
UPDATE `jobs` SET `experience_level` = CASE
  WHEN `experience_level` IN ('intern', 'entry', 'senior') THEN `experience_level`
  WHEN `experience_level` IN ('staff', 'principal', 'director', 'vp', 'c_suite') THEN 'lead'
  ELSE 'mid'
END;--> statement-breakpoint
ALTER TABLE `jobs` DROP COLUMN `is_early_career`;
