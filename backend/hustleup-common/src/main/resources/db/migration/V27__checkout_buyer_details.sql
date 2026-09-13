-- The buyer's contact details on a booking, and the seller's own checkout questions.
--
-- WHAT WAS WRONG
-- The cart checkout asked for a name, an email and a phone number, and then threw all three
-- away: only listingId and quantity were ever sent to the server. A seller received an order
-- with no way to contact anyone about it — no phone, no email, no address — and the buyer
-- had filled in a form that did nothing. Storefront orders (shop_orders) had carried these
-- columns since they were built; bookings never did.
--
-- WHAT THIS ADDS
--   bookings.customer_name / customer_email / customer_phone
--       Snapshotted at checkout, not read back through buyer_id. An order is a record of
--       what was agreed at the time, and someone who moves house after ordering must not
--       have last month's delivery silently re-addressed.
--   bookings.delivery_address
--       For anything shipped. NULL for collection and for services performed in person.
--   bookings.checkout_answers
--       JSON of prompt -> answer: what the buyer told this seller in reply to the seller's
--       own questions.
--   listings.checkout_fields
--       The questions themselves, one per line, in the seller's own words — "Your shoe
--       size", "Name to print on the cake", "Gate code for delivery".
--
-- WHY NOT A CHILD TABLE FOR THE QUESTIONS
-- They are a handful of short prompts owned entirely by one listing, never queried across
-- listings and never joined to. A table would buy nothing and cost a join on every listing
-- read. The answers are stored the same way for the same reason, and because the keys are
-- the seller's free text rather than anything this schema can name in advance.
--
-- SAFETY
-- Guarded adds only, so this is safe to run repeatedly. Every column is nullable and every
-- existing row keeps NULL, which is exactly what those rows are: orders placed before any of
-- this was captured. No backfill — inventing a phone number for a past order would be worse
-- than admitting there isn't one.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN table_name_in  VARCHAR(64),
  IN column_name_in VARCHAR(64),
  IN definition_in  VARCHAR(255))
BEGIN
  IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = table_name_in
           AND COLUMN_NAME  = column_name_in)
  THEN
    SET @ddl = CONCAT('ALTER TABLE `', table_name_in,
                      '` ADD COLUMN `', column_name_in, '` ', definition_in);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- ── Who the buyer is ────────────────────────────────────────────────────────
-- VARCHAR(255) to match the equivalent columns already on shop_orders, so the two order
-- types stay the same shape and a report across both does not need casting.
CALL add_column_if_missing('bookings', 'customer_name',    'VARCHAR(255) NULL');
CALL add_column_if_missing('bookings', 'customer_email',   'VARCHAR(255) NULL');
CALL add_column_if_missing('bookings', 'customer_phone',   'VARCHAR(255) NULL');
CALL add_column_if_missing('bookings', 'delivery_address', 'TEXT NULL');
CALL add_column_if_missing('bookings', 'checkout_answers', 'TEXT NULL');

-- ── What the seller needs before they can start ─────────────────────────────
CALL add_column_if_missing('listings', 'checkout_fields', 'TEXT NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
--      AND COLUMN_NAME IN ('customer_name','customer_email','customer_phone',
--                          'delivery_address','checkout_answers');
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings'
--      AND COLUMN_NAME = 'checkout_fields';
--
-- Expect five rows then one. Then restart hustleup-marketplace.
