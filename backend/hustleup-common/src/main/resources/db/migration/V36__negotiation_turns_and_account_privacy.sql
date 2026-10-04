SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'last_offer_by');
SET @s := IF(@c = 0, 'ALTER TABLE bookings ADD COLUMN last_offer_by VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'negotiation_history');
SET @s := IF(@c = 0, 'ALTER TABLE bookings ADD COLUMN negotiation_history JSON NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE bookings SET negotiation_history = JSON_ARRAY() WHERE negotiation_history IS NULL;
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'private_account');
SET @s := IF(@c = 0, 'ALTER TABLE users ADD COLUMN private_account BOOLEAN NOT NULL DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS follow_requests (
  follower_id VARCHAR(36) NOT NULL,
  following_id VARCHAR(36) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE TABLE IF NOT EXISTS message_email_gates (
  recipient_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (recipient_id, sender_id)
);
