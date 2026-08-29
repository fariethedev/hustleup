-- Let a storefront order earn a review, the way a booking already can.
--
-- RUN THIS BY HAND against every environment. Flyway is not a dependency of this project —
-- the db/migration folders under the service modules are decoration and nothing executes
-- them. Schema comes from Hibernate's `ddl-auto: update`, which will add the new nullable
-- column on its own but will NOT relax an existing NOT NULL, and Railway runs
-- `ddl-auto: validate`, which only checks. Both statements below are needed there.
--
-- WHY
-- Reviews were reachable only through a completed booking: reviews.booking_id was NOT NULL.
-- Buying from a storefront creates a shop_orders row and never a booking, so a customer who
-- paid a seller had no way to review them — the shop page showed a rating its own buyers
-- could not contribute to.
--
-- The review still targets the seller, not the shop. One person, one reputation: that same
-- average already feeds the shop card, the public profile and the Hustle Score, and splitting
-- it per-storefront would let one seller carry two different reputations.
--
-- Exactly one of booking_id / shop_order_id is set on any row; ReviewController refuses a
-- request that names both or neither.
--
-- SAFETY
-- Additive. Relaxing NOT NULL rejects nothing that was valid before, and no existing row has
-- a NULL booking_id to be affected. Safe to re-run: the ADD COLUMN and CREATE INDEX are
-- guarded, so a second run is a no-op rather than an error.

-- 1. booking_id becomes optional — a review may now come from the other source.
ALTER TABLE reviews
  MODIFY COLUMN booking_id VARCHAR(36) NULL;

-- 2. The storefront order a review came from, mirroring booking_id as a soft FK.
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'
                AND COLUMN_NAME = 'shop_order_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE reviews ADD COLUMN shop_order_id VARCHAR(36) NULL',
  'SELECT "shop_order_id already present"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. One review per person per order — the storefront counterpart of
--    uk_reviews_booking_reviewer. Scoped to the reviewer, not the order alone: the constraint
--    exists to stop one person reviewing twice, not to stop an order collecting more than one
--    review. MySQL treats NULLs as distinct in a unique index, so booking-sourced rows (which
--    have shop_order_id NULL) never collide with each other here.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'
                AND INDEX_NAME = 'uk_reviews_shop_order_reviewer');
SET @sql := IF(@idx = 0,
  'CREATE UNIQUE INDEX uk_reviews_shop_order_reviewer ON reviews (shop_order_id, reviewer_id)',
  'SELECT "uk_reviews_shop_order_reviewer already present"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify:
--   SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
--    WHERE TABLE_NAME = 'reviews' AND COLUMN_NAME IN ('booking_id','shop_order_id');
-- Expect: booking_id YES, shop_order_id YES
