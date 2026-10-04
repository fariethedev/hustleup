SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'highlights');
SET @s := IF(@c = 0, 'ALTER TABLE shops ADD COLUMN highlights JSON NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE shops SET highlights = JSON_ARRAY() WHERE highlights IS NULL;
