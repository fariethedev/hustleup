-- Records that a seller has been told their payout is waiting on Connect onboarding.
--
-- RUN THIS BY HAND on every environment, local included — hustleup-marketplace runs
-- ddl-auto: validate, so a missing column stops the service starting.
--
-- WHY
-- A held payout used to be a log line on the server. The seller saw an order they had
-- completed, no money, and no reason given — which is what "there are no payouts even though
-- sellers are completing orders" looks like from the inside. They are now told, once.
--
-- Once is the whole reason this column exists: the sweep revisits every held order every
-- hour, and without somewhere to record that the message went out, a seller who has not
-- finished onboarding would be reminded hourly, forever.
--
-- SAFETY
-- Additive and nullable. Existing held orders have NULL, so each one sends its notice on the
-- next sweep and then stops. Guarded, so re-running is a no-op.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'payout_blocked_notified_at');
SET @s := IF(@c = 0,
  'ALTER TABLE shop_orders ADD COLUMN payout_blocked_notified_at DATETIME(6) NULL',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
