-- ============================================================================
--  V16 — direct_messages.offer_booking_id, for chat-embedded negotiation.
-- ============================================================================
--
--  New messageType = "OFFER" on DirectMessage. Unlike the LISTING/POST/STORY
--  share types (which snapshot title/price/image at send time), an offer
--  message stores only a reference to the live Booking — the card fetches
--  current price/status by id so accept/decline/counter show up in both
--  parties' chat without editing old messages.
--
--  Guarded through INFORMATION_SCHEMA, same pattern as V12-V15: MySQL has no
--  portable ADD COLUMN IF NOT EXISTS, and this needs to be safe to re-run.

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'offer_booking_id') > 0,
  'DO 0', 'ALTER TABLE direct_messages ADD COLUMN offer_booking_id VARCHAR(36) NULL COMMENT ''Booking this OFFER message renders live, by id''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
