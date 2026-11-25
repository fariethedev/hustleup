-- WhatsApp-style messaging, chat/status privacy and Tinder-style Bond photos.
-- Every statement is guarded (same pattern as V36) so a re-run or a partially applied
-- schema never fails startup.

-- ── direct_messages: replies, edits, delete-for-everyone, reactions ─────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'reply_to_id');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN reply_to_id VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'reply_preview');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN reply_preview VARCHAR(300) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'reply_sender_id');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN reply_sender_id VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'edited_at');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN edited_at DATETIME(6) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'deleted_at');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN deleted_at DATETIME(6) NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'reactions');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN reactions TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'media_duration_ms');
SET @s := IF(@c = 0, 'ALTER TABLE direct_messages ADD COLUMN media_duration_ms INT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── users: WhatsApp-style privacy ───────────────────────────────────────────────
-- last_seen_visibility / status_audience: EVERYONE | FOLLOWERS | MUTUALS | NOBODY
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_seen_visibility');
SET @s := IF(@c = 0, 'ALTER TABLE users ADD COLUMN last_seen_visibility VARCHAR(16) NOT NULL DEFAULT ''EVERYONE''', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'read_receipts');
SET @s := IF(@c = 0, 'ALTER TABLE users ADD COLUMN read_receipts BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status_audience');
SET @s := IF(@c = 0, 'ALTER TABLE users ADD COLUMN status_audience VARCHAR(16) NOT NULL DEFAULT ''EVERYONE''', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── dating_profiles: up to six photos (JSON array of URLs), Tinder-style ────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dating_profiles' AND COLUMN_NAME = 'photos');
SET @s := IF(@c = 0, 'ALTER TABLE dating_profiles ADD COLUMN photos TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
