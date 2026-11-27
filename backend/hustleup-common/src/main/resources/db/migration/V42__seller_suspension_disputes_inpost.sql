-- Apply before deploying marketplace. Requires V40 and V41.
CREATE TABLE IF NOT EXISTS seller_safety (
 seller_id VARCHAR(36) NOT NULL PRIMARY KEY,
 suspended BIT NOT NULL DEFAULT 0, reason VARCHAR(1000),
 refund_open_orders BIT NOT NULL DEFAULT 0, bank_payouts_paused BIT NOT NULL DEFAULT 0,
 last_error VARCHAR(2000), suspended_at DATETIME(6)
);
CREATE TABLE IF NOT EXISTS payment_disputes (
 id VARCHAR(100) NOT NULL PRIMARY KEY, payment_intent_id VARCHAR(100), stripe_status VARCHAR(80),
 recovered BIT NOT NULL DEFAULT 0, evidence_submitted BIT NOT NULL DEFAULT 0,
 evidence TEXT, last_error VARCHAR(2000), updated_at DATETIME(6), INDEX idx_disputes_payment(payment_intent_id)
);
CREATE TABLE IF NOT EXISTS carrier_bindings (
 tracking_number VARCHAR(80) NOT NULL PRIMARY KEY, order_reference VARCHAR(80) NOT NULL UNIQUE
);
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='carrier_confirmed_at');
SET @s := IF(@c=0, 'ALTER TABLE bookings ADD COLUMN carrier_confirmed_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='carrier_checked_at');
SET @s := IF(@c=0, 'ALTER TABLE bookings ADD COLUMN carrier_checked_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='carrier_verification_error');
SET @s := IF(@c=0, 'ALTER TABLE bookings ADD COLUMN carrier_verification_error VARCHAR(250) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shop_orders' AND COLUMN_NAME='carrier_confirmed_at');
SET @s := IF(@c=0, 'ALTER TABLE shop_orders ADD COLUMN carrier_confirmed_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shop_orders' AND COLUMN_NAME='carrier_checked_at');
SET @s := IF(@c=0, 'ALTER TABLE shop_orders ADD COLUMN carrier_checked_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='shop_orders' AND COLUMN_NAME='carrier_verification_error');
SET @s := IF(@c=0, 'ALTER TABLE shop_orders ADD COLUMN carrier_verification_error VARCHAR(250) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
