-- Record which Stripe Checkout Session last extended a subscription.
--
-- RUN THIS BY HAND on Railway. Locally `ddl-auto: update` adds a new nullable column on its
-- own, so this is only strictly needed where Hibernate runs in `validate` mode — which is
-- Railway, where a missing column stops the service starting altogether.
--
-- WHY
-- Premium used to be granted from exactly one place: the Stripe webhook. That made a paid
-- upgrade depend on the webhook being registered in the Stripe dashboard AND able to reach
-- the server, and where it was not, money was taken and the buyer's account never changed —
-- which is what "stripe is paying everything but then the user doesn't get access" was.
--
-- Premium is now also granted when the buyer lands back on /payment/success, driven by their
-- own browser, so it works in any environment Stripe can redirect to. Both paths observe the
-- same completed payment, and the grant STACKS months onto whatever time is left — so without
-- somewhere to record which session has already been honoured, a buyer whose webhook fired
-- normally would be granted the term a second time simply for returning to the page.
--
-- Both paths check this column first and skip a session they have already seen.
--
-- SAFETY
-- Additive and nullable. Existing rows get NULL, which no session id can equal, so the first
-- grant after this runs behaves exactly as before. Guarded, so re-running is a no-op.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions'
                AND COLUMN_NAME = 'last_checkout_session_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE subscriptions ADD COLUMN last_checkout_session_id VARCHAR(255) NULL',
  'SELECT "last_checkout_session_id already present"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify:
--   SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
--    WHERE TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'last_checkout_session_id';
