-- Payout tracking for storefront orders.
--
-- RUN THIS BY HAND on every environment, local included — hustleup-marketplace runs
-- ddl-auto: validate, so a missing column here stops the service starting.
--
-- WHY
-- Bookings have transferred to the seller's connected Stripe account since Connect was added.
-- Storefront orders never did: there was no transfer call, no payout-account lookup and
-- nowhere to record one. Every shop sale charged the buyer, landed the money on the platform's
-- Stripe balance, and left it there — which is why the Stripe dashboard showed nothing
-- arriving for sellers.
--
-- payout_status is deliberately separate from status. That one tracks the sale, this tracks
-- the money, and they are not the same thing: an order can be FULFILLED with the payout still
-- HELD because the seller has not finished Connect onboarding and has nowhere to receive it.
-- Collapsing them would hide money the platform still owes.
--
-- Existing rows default to HELD, which is accurate — they were charged and never paid out.
-- Once a seller completes onboarding the hourly sweep picks them up and pays them.
--
-- SAFETY
-- Additive, nullable except for the defaulted status column. Guarded, so re-running is a
-- no-op.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='shop_orders' AND COLUMN_NAME='transfer_id');
SET @s := IF(@c=0, 'ALTER TABLE shop_orders ADD COLUMN transfer_id VARCHAR(255) NULL',
             'SELECT "transfer_id present"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='shop_orders' AND COLUMN_NAME='payout_status');
SET @s := IF(@c=0, 'ALTER TABLE shop_orders ADD COLUMN payout_status VARCHAR(20) NOT NULL DEFAULT ''HELD''',
             'SELECT "payout_status present"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='shop_orders' AND COLUMN_NAME='released_at');
SET @s := IF(@c=0, 'ALTER TABLE shop_orders ADD COLUMN released_at DATETIME(6) NULL',
             'SELECT "released_at present"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- The sweep filters on these two on every pass.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='shop_orders' AND INDEX_NAME='idx_shop_orders_payout');
SET @s := IF(@i=0, 'CREATE INDEX idx_shop_orders_payout ON shop_orders (payout_status, status)',
             'SELECT "idx_shop_orders_payout present"');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
