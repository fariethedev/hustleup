-- Apply before marketplace deployment. Existing orders keep the safer receipt requirement.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'buyer_confirmation_required');
SET @s := IF(@c = 0, 'ALTER TABLE bookings ADD COLUMN buyer_confirmation_required BIT NOT NULL DEFAULT 1', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'buyer_confirmation_required');
SET @s := IF(@c = 0, 'ALTER TABLE shop_orders ADD COLUMN buyer_confirmation_required BIT NOT NULL DEFAULT 1', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
