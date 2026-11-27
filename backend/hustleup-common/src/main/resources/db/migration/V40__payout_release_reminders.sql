-- Apply before deploying marketplace (ddl-auto: validate). Safe to rerun.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'release_reminder_at');
SET @s := IF(@c = 0, 'ALTER TABLE bookings ADD COLUMN release_reminder_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'release_reminder_at');
SET @s := IF(@c = 0, 'ALTER TABLE shop_orders ADD COLUMN release_reminder_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
