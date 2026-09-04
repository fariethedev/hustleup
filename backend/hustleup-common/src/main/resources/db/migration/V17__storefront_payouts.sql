-- Payout tracking on storefront orders.
--
-- Promoted out of db/manual/2026-08-31_storefront_payouts.sql, which never ran anywhere.
-- Manual files stopped being applied the moment Flyway was wired up, so the ShopOrder
-- entity shipped with three fields the production table did not have and marketplace
-- crash-looped on startup:
--
--   Schema-validation: missing column [payout_status] in table [shop_orders]
--
-- Production runs ddl-auto: validate, so Hibernate refuses to build the SessionFactory at
-- all rather than adding the column itself. One missing column takes down shops, listings,
-- jobs and the leaderboard together, because they share the service.
--
-- WHY EVERY STATEMENT IS GUARDED
-- Flyway guarantees a migration runs once per database, which normally makes a plain ALTER
-- correct. It is not correct here. Flyway was introduced against databases that already had
-- years of schema built by ddl-auto: update, and it was baselined at version 11 — so every
-- environment starts from a different shape. These three columns already exist on the
-- development database (Hibernate added them when ddl-auto was still `update`) and are
-- absent on Railway. An unguarded ALTER would fix production and fail locally with
-- "duplicate column name", leaving a failed migration recorded in flyway_schema_history
-- that blocks every later one until someone repairs it by hand.
--
-- The PREPARE/EXECUTE form is used rather than a stored procedure so no DELIMITER handling
-- is involved: Flyway's MySQL parser sees ordinary statements and nothing else.

-- ── transfer_id: the Stripe Transfer that moved the money to the seller ──────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'transfer_id');
SET @s := IF(@c = 0,
             'ALTER TABLE shop_orders ADD COLUMN transfer_id VARCHAR(255) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── payout_status: HELD until the order completes, then RELEASED ─────────────
-- NOT NULL with a default so existing rows land on HELD rather than NULL, which is the
-- honest starting state: money for an order placed before payouts existed has not been
-- sent to the seller.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'payout_status');
SET @s := IF(@c = 0,
             'ALTER TABLE shop_orders ADD COLUMN payout_status VARCHAR(20) NOT NULL DEFAULT ''HELD''',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── released_at: when the payout actually went out, for reconciliation ───────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'released_at');
SET @s := IF(@c = 0,
             'ALTER TABLE shop_orders ADD COLUMN released_at DATETIME(6) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── The index the payout sweep reads ────────────────────────────────────────
-- The job that releases due payouts filters on (payout_status, status); without this it
-- scans every storefront order the platform has ever taken, on every run.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND INDEX_NAME = 'idx_shop_orders_payout');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_shop_orders_payout ON shop_orders (payout_status, status)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders'
--      AND COLUMN_NAME IN ('transfer_id','payout_status','released_at');
