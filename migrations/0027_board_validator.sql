-- The crawler's conditional requests never worked: it stored Last-Modified,
-- and the ATS APIs send only ETag. The column now holds either, so the old
-- name goes. Existing values are cleared so each board's next fetch is full
-- and records its ETag.
ALTER TABLE `board_status` RENAME COLUMN `last_modified` TO `validator`;--> statement-breakpoint
UPDATE `board_status` SET `validator` = NULL;
