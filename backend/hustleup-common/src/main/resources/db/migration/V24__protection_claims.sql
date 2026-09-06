-- Buyer protection claims: the record that an order is disputed, and the thing that stops
-- its money releasing while somebody looks at it.
--
-- Money for both bookings and storefront orders is held on the platform's Stripe balance
-- until the buyer confirms receipt or the hold period expires after delivery. The hold
-- protects a buyer who never presses anything, but it is also a deadline — and a buyer whose
-- parcel never arrived should not have to beat a clock to be heard. An OPEN row here stops
-- that clock for the order it names, for as long as the claim stays open.
--
-- ONE TABLE FOR BOTH ORDER KINDS
-- Bookings and shop_orders are separate tables with separate lifecycles, but a claim says the
-- same thing about either. order_type says which side, order_id which row. Soft reference on
-- purpose: no foreign key, because a claim that outlives a deleted order is a record worth
-- keeping rather than a constraint to trip over.
--
-- CREATE TABLE IF NOT EXISTS, like V20's comment_likes: nothing is dropped or altered, and
-- re-running is a no-op. Guarded index creation for the same reason as V18 and V22 — Flyway
-- was baselined over databases ddl-auto had already shaped, so environments genuinely differ.

CREATE TABLE IF NOT EXISTS protection_claims (
  id              VARCHAR(36)  NOT NULL,
  order_type      VARCHAR(20)  NOT NULL COMMENT 'BOOKING or SHOP_ORDER',
  order_id        VARCHAR(36)  NOT NULL,
  buyer_id        VARCHAR(36)  NOT NULL,
  seller_id       VARCHAR(36)  NOT NULL,
  reason          VARCHAR(30)  NOT NULL COMMENT 'NOT_RECEIVED | DAMAGED | NOT_AS_DESCRIBED | OTHER',
  detail          TEXT         NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN | REFUNDED | REJECTED',
  resolution_note TEXT         NULL,
  resolved_by     VARCHAR(36)  NULL,
  resolved_at     DATETIME     NULL,
  created_at      DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── the freeze lookup ───────────────────────────────────────────────────────
-- "Is there an open claim against this order?" runs on every release attempt and on every
-- pass of the hourly payout sweep, once per due order. Without this it is a full scan each
-- time, on the one query standing between a seller and money that is not theirs yet.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'protection_claims'
              AND INDEX_NAME = 'idx_claim_order');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_claim_order ON protection_claims (order_type, order_id, status)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── the admin queue ─────────────────────────────────────────────────────────
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'protection_claims'
              AND INDEX_NAME = 'idx_claim_status');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_claim_status ON protection_claims (status)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── a buyer's own claims ────────────────────────────────────────────────────
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'protection_claims'
              AND INDEX_NAME = 'idx_claim_buyer');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_claim_buyer ON protection_claims (buyer_id)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'protection_claims';
