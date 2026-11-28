-- Comments can carry a photo or be a sticker (one glyph from the shared pack).
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='comments' AND COLUMN_NAME='media_url');
SET @s := IF(@c=0, 'ALTER TABLE comments ADD COLUMN media_url VARCHAR(1024) NULL, ADD COLUMN sticker VARCHAR(32) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
