-- Create the tables added since the last production schema change.
--
-- RUN THIS BY HAND against every environment that uses ddl-auto: validate (Railway).
--
-- WHY THIS IS URGENT
-- hustleup-marketplace is currently DOWN in production. Railway sets
-- SPRING_JPA_HIBERNATE_DDL_AUTO=validate, so Hibernate refuses to build the
-- SessionFactory when an @Entity has no matching table, and the whole service fails to
-- start:
--
--   Schema-validation: missing table [shop_orders]
--
-- Because the service never starts, the gateway has no upstream for /api/v1/shops,
-- /listings, /jobs and /leaderboard — every one of those requests hangs and surfaces in
-- the browser as a 500. Social and auth are unaffected, which is why only part of the
-- site looks broken.
--
-- Local development sets ddl-auto: update, which creates missing tables silently. That
-- difference is exactly why this was invisible until deploy: the entity worked locally
-- the moment it was written, and production validated it out of existence.
--
-- SAFETY
-- CREATE TABLE IF NOT EXISTS only — nothing here drops, alters or rewrites an existing
-- table, so it is safe to run repeatedly and safe against a database that already has
-- some of these tables. Column types mirror the JPA entities exactly; a mismatch would
-- fail validation just as surely as a missing table.
--
-- Note VARCHAR(36) for id/foreign-key columns: entity ids are UUID with
-- preferred_uuid_jdbc_type: VARCHAR (see application.yml), so they are stored as text
-- rather than BINARY(16).

-- ── Storefront orders (ShopOrder) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_orders (
  id                 VARCHAR(36)    NOT NULL,
  buyer_id           VARCHAR(36)    NOT NULL,
  shop_id            VARCHAR(36)    NOT NULL,
  seller_id          VARCHAR(36)    NOT NULL,
  product_id         VARCHAR(36)    NOT NULL,
  product_name       VARCHAR(255)   NOT NULL,
  product_image_url  VARCHAR(1024)  NULL,
  unit_price         DECIMAL(12,2)  NOT NULL,
  quantity           INT            NOT NULL,
  total_price        DECIMAL(12,2)  NOT NULL,
  currency           VARCHAR(255)   NOT NULL,
  customer_name      VARCHAR(255)   NULL,
  customer_email     VARCHAR(255)   NULL,
  customer_phone     VARCHAR(255)   NULL,
  notes              TEXT           NULL,
  status             VARCHAR(255)   NOT NULL,
  payment_intent_id  VARCHAR(255)   NULL,
  created_at         DATETIME(6)    NOT NULL,
  updated_at         DATETIME(6)    NULL,
  PRIMARY KEY (id),
  -- The webhook resolves a paid order set by PaymentIntent, and both dashboards list by
  -- person; without these every one of those is a full scan.
  KEY idx_shop_orders_payment_intent (payment_intent_id),
  KEY idx_shop_orders_buyer  (buyer_id),
  KEY idx_shop_orders_seller (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify:
--   SELECT TABLE_NAME FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders';
--
-- Then restart hustleup-marketplace. If it still fails, read the new
-- "missing table [...]" name out of the logs — Hibernate reports only the first one it
-- finds, so a second missing table only becomes visible once this one exists.
