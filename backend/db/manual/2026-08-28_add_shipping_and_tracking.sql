-- Shipping terms on what sellers list, and delivery tracking on what buyers order.
--
-- RUN THIS BY HAND against every environment that uses ddl-auto: validate (Railway),
-- BEFORE deploying the build that adds them.
--
-- WHY BY HAND
-- Local development runs ddl-auto: update and creates these columns silently on first
-- start, which is exactly why a missing migration stays invisible until deploy. Railway
-- runs ddl-auto: validate: Hibernate refuses to build the SessionFactory when a mapped
-- field has no column, and hustleup-marketplace then fails to start altogether — taking
-- /listings, /jobs, /shops and /leaderboard down with it, since the gateway has no
-- upstream. See 2026-08-28_create_shop_orders.sql for the last time that happened.
--
-- WHAT IT ADDS
--   listings, shop_products   the seller's answer to "how do you send this, and what does
--                             sending it cost" — asked for when the thing is posted
--   bookings, shop_orders     a snapshot of those terms taken at purchase time, plus where
--                             the order has physically got to (see the Fulfilment
--                             embeddable, which both order tables share column-for-column)
--
-- SAFETY
-- Every ALTER is wrapped in add_column_if_missing, so this file is safe to run repeatedly
-- and safe against a database where some columns already exist (a local box that ran with
-- ddl-auto: update, for instance). MySQL has no ADD COLUMN IF NOT EXISTS, which is why the
-- procedure exists rather than a one-line ALTER.
--
-- Nothing here drops, renames or rewrites an existing column. Existing rows get NULL,
-- which every reader is written to handle: a listing with no shipping_method reads as
-- "arrange with the seller", and an order with no fulfilment_status has no delivery track
-- — neither is mistaken for free delivery or for a delivered parcel.

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

-- ── What the seller offers ───────────────────────────────────────────────────
-- ShippingMethod is persisted as its name (@Enumerated(EnumType.STRING)), so VARCHAR(32)
-- rather than an ENUM column: adding a method later must not need a schema change.
CALL add_column_if_missing('listings',      'shipping_method', 'VARCHAR(32) NULL');
CALL add_column_if_missing('listings',      'shipping_price',  'DECIMAL(12,2) NULL');
CALL add_column_if_missing('shop_products', 'shipping_method', 'VARCHAR(32) NULL');
CALL add_column_if_missing('shop_products', 'shipping_price',  'DECIMAL(12,2) NULL');

-- ── Where the order has got to ───────────────────────────────────────────────
-- bookings and shop_orders take an identical set: both embed Fulfilment, and a buyer does
-- not care which of the two they happened to buy through. Any divergence here would show
-- up as one of the two order types failing schema validation.
CALL add_column_if_missing('bookings', 'shipping_method',       'VARCHAR(32) NULL');
CALL add_column_if_missing('bookings', 'shipping_price',        'DECIMAL(12,2) NULL');
CALL add_column_if_missing('bookings', 'fulfilment_status',     'VARCHAR(32) NULL');
CALL add_column_if_missing('bookings', 'tracking_carrier',      'VARCHAR(80) NULL');
CALL add_column_if_missing('bookings', 'tracking_number',       'VARCHAR(120) NULL');
CALL add_column_if_missing('bookings', 'tracking_url',          'VARCHAR(512) NULL');
CALL add_column_if_missing('bookings', 'dropoff_point',         'VARCHAR(255) NULL');
CALL add_column_if_missing('bookings', 'shipping_note',         'TEXT NULL');
CALL add_column_if_missing('bookings', 'estimated_delivery',    'DATE NULL');
CALL add_column_if_missing('bookings', 'shipped_at',            'DATETIME(6) NULL');
CALL add_column_if_missing('bookings', 'delivered_at',          'DATETIME(6) NULL');
CALL add_column_if_missing('bookings', 'fulfilment_updated_at', 'DATETIME(6) NULL');

CALL add_column_if_missing('shop_orders', 'shipping_method',       'VARCHAR(32) NULL');
CALL add_column_if_missing('shop_orders', 'shipping_price',        'DECIMAL(12,2) NULL');
CALL add_column_if_missing('shop_orders', 'fulfilment_status',     'VARCHAR(32) NULL');
CALL add_column_if_missing('shop_orders', 'tracking_carrier',      'VARCHAR(80) NULL');
CALL add_column_if_missing('shop_orders', 'tracking_number',       'VARCHAR(120) NULL');
CALL add_column_if_missing('shop_orders', 'tracking_url',          'VARCHAR(512) NULL');
CALL add_column_if_missing('shop_orders', 'dropoff_point',         'VARCHAR(255) NULL');
CALL add_column_if_missing('shop_orders', 'shipping_note',         'TEXT NULL');
CALL add_column_if_missing('shop_orders', 'estimated_delivery',    'DATE NULL');
CALL add_column_if_missing('shop_orders', 'shipped_at',            'DATETIME(6) NULL');
CALL add_column_if_missing('shop_orders', 'delivered_at',          'DATETIME(6) NULL');
CALL add_column_if_missing('shop_orders', 'fulfilment_updated_at', 'DATETIME(6) NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Orders already paid for predate the delivery track entirely. Opening them at CONFIRMED
-- rather than leaving them NULL means a seller can still tell the buyer where their parcel
-- is, instead of those orders being permanently untrackable. Unpaid ones are deliberately
-- left alone: their track should start when the money does.
UPDATE bookings
   SET fulfilment_status = 'CONFIRMED'
 WHERE fulfilment_status IS NULL
   AND payment_status IN ('PAID', 'TRANSFERRED');

UPDATE shop_orders
   SET fulfilment_status = 'CONFIRMED'
 WHERE fulfilment_status IS NULL
   AND status = 'PAID';

UPDATE shop_orders
   SET fulfilment_status = 'DELIVERED'
 WHERE fulfilment_status IS NULL
   AND status = 'FULFILLED';

-- Verify:
--   SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND COLUMN_NAME IN ('shipping_method', 'fulfilment_status')
--    ORDER BY TABLE_NAME;
--
-- Expect four rows for shipping_method (listings, shop_products, bookings, shop_orders)
-- and two for fulfilment_status (bookings, shop_orders). Then restart
-- hustleup-marketplace.
