-- Structured shop category (shops.business_type) plus the tables an appointment-based shop
-- (a salon, a barber, a spa) needs that a catalogue shop (grocery, clothing) does not: a
-- menu of bookable services, the time slots against them, and the appointments customers
-- make against those slots.
--
-- WHY SEPARATE TABLES RATHER THAN REUSING availability_slots/bookings
-- Those are keyed to a marketplace listing (availability_slots.listing_id, NOT NULL), and a
-- shop service is not a listing — a shop and a listing are different entities with different
-- lifecycles even when owned by the same seller. Retrofitting the shared tables to accept
-- either kind of id would mean every existing read of them has to branch on which kind it
-- got, for the sake of two tables that are otherwise a near-identical shape to their new
-- counterparts here.
--
-- WHY business_type IS A NEW COLUMN AND NOT A REPURPOSED category
-- shops.category is free text sellers already type today ("Hair & Beauty", "Beauty Salon",
-- two spellings of the same business) — see its own column comment. Nothing that decides
-- which features a shop's owner gets can be driven by parsing that string. business_type is
-- the fixed list the owner instead picks from, existing purely to answer "does this shop take
-- appointments" (see ShopBusinessType.isAppointmentBased() on the Java side).
--
-- SAFETY
-- Guarded like V26/V28's column additions, since Flyway here was baselined over databases
-- ddl-auto had already shaped and environments genuinely differ — re-running this file is a
-- no-op. The three new tables use CREATE TABLE IF NOT EXISTS for the same reason.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops'
              AND COLUMN_NAME = 'business_type');
SET @s := IF(@c = 0,
  'ALTER TABLE shops ADD COLUMN business_type VARCHAR(32) NOT NULL DEFAULT ''GENERAL''',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS shop_services (
  id                VARCHAR(36)   NOT NULL,
  shop_id           VARCHAR(36)   NOT NULL,
  name              VARCHAR(120)  NOT NULL,
  description       VARCHAR(1000) NULL,
  duration_minutes  INT           NOT NULL,
  price             DECIMAL(12,2) NOT NULL,
  currency          VARCHAR(3)    NOT NULL DEFAULT 'PLN',
  active            TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order        INT           NOT NULL DEFAULT 0,
  created_at        DATETIME      NOT NULL,
  updated_at        DATETIME      NULL,
  PRIMARY KEY (id),
  KEY idx_shop_services_shop (shop_id)
);

CREATE TABLE IF NOT EXISTS shop_service_slots (
  id                VARCHAR(36) NOT NULL,
  shop_service_id   VARCHAR(36) NOT NULL,
  shop_id           VARCHAR(36) NOT NULL,
  start_time        DATETIME    NOT NULL,
  end_time          DATETIME    NOT NULL,
  booked            TINYINT(1)  NOT NULL DEFAULT 0,
  created_at        DATETIME    NOT NULL,
  PRIMARY KEY (id),
  KEY idx_shop_slots_service (shop_service_id),
  KEY idx_shop_slots_shop (shop_id)
);

CREATE TABLE IF NOT EXISTS shop_appointments (
  id                VARCHAR(36)   NOT NULL,
  shop_service_id   VARCHAR(36)   NOT NULL,
  shop_id           VARCHAR(36)   NOT NULL,
  slot_id           VARCHAR(36)   NOT NULL,
  buyer_id          VARCHAR(36)   NOT NULL,
  customer_name     VARCHAR(120)  NULL,
  customer_email    VARCHAR(255)  NULL,
  customer_phone    VARCHAR(40)   NULL,
  notes             VARCHAR(1000) NULL,
  -- Snapshotted from the service at booking time — a seller changing a price or duration
  -- tomorrow must not rewrite what a customer already booked at today's terms.
  service_name      VARCHAR(120)  NULL,
  price             DECIMAL(12,2) NULL,
  currency          VARCHAR(3)    NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'CONFIRMED' COMMENT 'CONFIRMED | COMPLETED | CANCELLED | NO_SHOW',
  created_at        DATETIME      NOT NULL,
  updated_at        DATETIME      NULL,
  PRIMARY KEY (id),
  KEY idx_shop_appts_shop (shop_id),
  KEY idx_shop_appts_buyer (buyer_id)
);
