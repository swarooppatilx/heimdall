-- Location rules changed (folded names, remote detection, Czechia/Croatia), and
-- stored rows only re-derive when a board is fetched in full. Forgetting each
-- board's Last-Modified makes the next sweep skip the 304 shortcut once.
UPDATE `board_status` SET `last_modified` = NULL;
