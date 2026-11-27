-- Trust & safety, phases 2-3 and legal reporting.
--
--   * listings.status gains PENDING_REVIEW (held for a moderator: risky price/keywords from a
--     new seller) and REMOVED (taken down by a moderator, with a statement of reasons).
--   * marketplace_reports: buyers report a listing, shop or seller (DSA notice-and-action).
--   * seller_profiles: private vs business seller, trader details (DSA Art. 30 traceability)
--     and the identity fields DAC7 reporting needs, plus strikes and the payout bank
--     fingerprint used to link repeat offenders.
--   * protection_claims: seller response with a deadline, decisions incl. partial refunds,
--     and a single appeal per side.
--   * direct_messages.safety_flag: chat messages that steer payment off the platform.
--
-- Written idempotently (information_schema checks) like V40-V42, so a partially applied run
-- can be repeated.

ALTER TABLE listings MODIFY COLUMN status
  ENUM('ACTIVE','DELETED','PAUSED','SOLD_OUT','PENDING_REVIEW','REMOVED') DEFAULT NULL;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='listings' AND COLUMN_NAME='review_reason');
SET @s := IF(@c=0, 'ALTER TABLE listings ADD COLUMN review_reason VARCHAR(500) NULL, ADD COLUMN reviewed_at DATETIME(6) NULL, ADD COLUMN reviewed_by VARCHAR(36) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS marketplace_reports (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  target_type     VARCHAR(20)  NOT NULL COMMENT 'LISTING | SHOP | SELLER',
  target_id       VARCHAR(36)  NOT NULL,
  seller_id       VARCHAR(36)  NULL,
  reporter_id     VARCHAR(36)  NOT NULL,
  reason          VARCHAR(40)  NOT NULL,
  detail          TEXT         NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN | ACTIONED | DISMISSED',
  action_taken    VARCHAR(40)  NULL,
  resolution_note TEXT         NULL,
  resolved_by     VARCHAR(36)  NULL,
  resolved_at     DATETIME(6)  NULL,
  created_at      DATETIME(6)  NULL,
  INDEX idx_reports_status (status, created_at),
  INDEX idx_reports_seller (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  seller_type      VARCHAR(10)  NOT NULL DEFAULT 'PRIVATE' COMMENT 'PRIVATE | BUSINESS',
  legal_name       VARCHAR(200) NULL,
  business_name    VARCHAR(200) NULL,
  tax_id           VARCHAR(40)  NULL COMMENT 'PESEL / NIP / foreign TIN',
  vat_number       VARCHAR(40)  NULL,
  registration_no  VARCHAR(60)  NULL COMMENT 'KRS / CEIDG entry',
  date_of_birth    DATE         NULL,
  address_line1    VARCHAR(200) NULL,
  city             VARCHAR(100) NULL,
  postal_code      VARCHAR(20)  NULL,
  country          VARCHAR(2)   NULL,
  contact_email    VARCHAR(200) NULL,
  contact_phone    VARCHAR(40)  NULL,
  strikes          INT          NOT NULL DEFAULT 0,
  bank_fingerprint VARCHAR(64)  NULL,
  linked_to        VARCHAR(36)  NULL COMMENT 'suspended seller this account was linked to',
  created_at       DATETIME(6)  NULL,
  updated_at       DATETIME(6)  NULL,
  INDEX idx_seller_profiles_bank (bank_fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='protection_claims' AND COLUMN_NAME='seller_response');
SET @s := IF(@c=0, 'ALTER TABLE protection_claims ADD COLUMN seller_response TEXT NULL, ADD COLUMN seller_responded_at DATETIME(6) NULL, ADD COLUMN respond_by DATETIME(6) NULL, ADD COLUMN decision VARCHAR(20) NULL, ADD COLUMN refund_amount DECIMAL(19,4) NULL, ADD COLUMN appeal_by VARCHAR(10) NULL, ADD COLUMN appeal_text TEXT NULL, ADD COLUMN appealed_at DATETIME(6) NULL, ADD COLUMN appeal_note TEXT NULL, ADD COLUMN appeal_resolved_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='direct_messages' AND COLUMN_NAME='safety_flag');
SET @s := IF(@c=0, 'ALTER TABLE direct_messages ADD COLUMN safety_flag VARCHAR(40) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
