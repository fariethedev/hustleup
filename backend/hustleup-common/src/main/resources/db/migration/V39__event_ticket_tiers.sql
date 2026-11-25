-- Event ticket tiers (Early bird, General, VIP…). The tiers themselves live in the listing's
-- meta JSON; each booking records which tier it bought so per-tier capacity can be enforced.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'ticket_tier');
SET @s := IF(@c = 0, 'ALTER TABLE bookings ADD COLUMN ticket_tier VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
