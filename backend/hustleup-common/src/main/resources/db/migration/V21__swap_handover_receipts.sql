-- Handover receipts on swap offers.
--
-- An accepted swap put two parcels in flight and then recorded nothing further: ACCEPTED
-- was the last state, and whether either item actually arrived lived only in the two
-- people's messages. These four columns are where each side confirms its own arrival.
--
-- Deliberately NOT folded into swap_offers.status. That column answers a commercial
-- question (was this trade agreed), and a swap has two arrivals rather than one, so there
-- is no single value it could take that means "delivered" without picking a side. Same
-- separation bookings already draw between booking status and fulfilment status.
--
-- SHAPES
-- *_received_at  DATETIME, null until that side confirms. Null is the normal state, and is
--                what every swap accepted before this feature existed will keep.
-- *_proof_url    VARCHAR(1024), matching @Column(length = 1024) and the width the other
--                media URL columns in this schema use — an S3 key plus a bucket prefix runs
--                well past 255. Holds the raw key; presigning happens on read.
--
-- Guarded like the other migrations here because Flyway was baselined over databases that
-- ddl-auto had already been shaping, so environments differ and this must be re-runnable.

-- ── proposer_received_at ────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'proposer_received_at');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN proposer_received_at DATETIME NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── proposer_proof_url ──────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'proposer_proof_url');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN proposer_proof_url VARCHAR(1024) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── owner_received_at ───────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'owner_received_at');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN owner_received_at DATETIME NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── owner_proof_url ─────────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'owner_proof_url');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN owner_proof_url VARCHAR(1024) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'swap_offers'
--      AND (COLUMN_NAME LIKE '%received_at' OR COLUMN_NAME LIKE '%proof_url');
