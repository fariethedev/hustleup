-- ============================================================================
--  V13 — the Fulfilment embeddable's columns on bookings and shop_orders.
-- ============================================================================
--
--  Fulfilment is an @Embeddable shared by Booking and ShopOrder, so each of its
--  fields becomes a column on BOTH tables. V12 missed all of them: it was built
--  by scanning entity classes for @Column declarations, and an embeddable lives
--  outside the model package, so nothing pointed at it.
--
--  Marketplace crash-looped on the first of them:
--      Schema-validation: missing column [tracking_carrier] in table [bookings]
--
--  Guarded through INFORMATION_SCHEMA for the same reasons as V12 — MySQL has no
--  ADD COLUMN IF NOT EXISTS, and shop_orders was created by hand recently so it
--  may already carry some of these.

-- ── bookings ───────────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipping_method') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipping_method VARCHAR(32) NULL COMMENT ''ShippingMethod enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipping_price') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipping_price DECIMAL(12,2) NULL COMMENT ''Postage on top of the item price''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'fulfilment_status') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN fulfilment_status VARCHAR(32) NULL COMMENT ''FulfilmentStatus enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tracking_carrier') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN tracking_carrier VARCHAR(80) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tracking_number') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN tracking_number VARCHAR(120) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tracking_url') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN tracking_url VARCHAR(512) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'dropoff_point') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN dropoff_point VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipping_note') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipping_note TEXT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'estimated_delivery') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN estimated_delivery DATE NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipped_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipped_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'delivered_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN delivered_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'fulfilment_updated_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN fulfilment_updated_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'buyer_confirmed_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN buyer_confirmed_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── shop_orders ───────────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipping_method') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipping_method VARCHAR(32) NULL COMMENT ''ShippingMethod enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipping_price') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipping_price DECIMAL(12,2) NULL COMMENT ''Postage on top of the item price''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'fulfilment_status') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN fulfilment_status VARCHAR(32) NULL COMMENT ''FulfilmentStatus enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'tracking_carrier') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN tracking_carrier VARCHAR(80) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'tracking_number') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN tracking_number VARCHAR(120) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'tracking_url') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN tracking_url VARCHAR(512) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'dropoff_point') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN dropoff_point VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipping_note') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipping_note TEXT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'estimated_delivery') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN estimated_delivery DATE NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipped_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipped_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'delivered_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN delivered_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'fulfilment_updated_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN fulfilment_updated_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'buyer_confirmed_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN buyer_confirmed_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
