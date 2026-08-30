-- Record the buyer's own confirmation that an order arrived.
--
-- RUN THIS BY HAND on Railway. Locally `ddl-auto: update` adds these nullable columns itself;
-- Railway runs `ddl-auto: validate`, where a missing column stops the service starting.
--
-- Two tables, because Fulfilment is an @Embeddable and both bookings and shop_orders embed
-- it — the column is created once per embedding table, not in a table of its own.
--
-- WHY
-- Marking an order delivered flipped it straight to FULFILLED, and only the seller could do
-- it. FULFILLED is what releases the seller's payout and what makes the sale reviewable, so
-- the person being paid was also the person certifying that they had earned it — and, since
-- reviewing is gated on FULFILLED, a seller could mark a parcel delivered that never left the
-- house and then write themselves a five-star review of it.
--
-- The seller still says where the parcel is; that is genuinely their knowledge and the
-- tracking states are unchanged. What changed is that their word no longer closes the order.
-- Only the buyer confirming receipt does, and this column records when they did.
--
-- delivered_at is deliberately kept alongside this rather than replaced: one is the sender's
-- account of when they handed it over, the other is the recipient agreeing it arrived. They
-- are different claims and a dispute needs both.
--
-- SAFETY
-- Additive and nullable. Orders already FULFILLED keep that status and simply carry a NULL
-- here, meaning "closed before buyer confirmation existed". Guarded, so re-running is a no-op.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders'
                AND COLUMN_NAME = 'buyer_confirmed_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE shop_orders ADD COLUMN buyer_confirmed_at DATETIME(6) NULL',
  'SELECT "shop_orders.buyer_confirmed_at already present"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
                AND COLUMN_NAME = 'buyer_confirmed_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE bookings ADD COLUMN buyer_confirmed_at DATETIME(6) NULL',
  'SELECT "bookings.buyer_confirmed_at already present"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify:
--   SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE COLUMN_NAME = 'buyer_confirmed_at' AND TABLE_SCHEMA = DATABASE();
-- Expect two rows: bookings, shop_orders
