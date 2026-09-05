-- What sellers think of HustleSpace, asked when a sale completes.
--
-- Replaces the review the seller used to be forced to leave about the buyer in order to
-- mark a booking complete. That gate collected the wrong thing: the stars on a shop card,
-- the leaderboard and the storefront average all come from the BUYER's review of the
-- SELLER, which the buyer leaves separately. What the gate produced was a seller's opinion
-- of a buyer -- surfaced almost nowhere -- and it produced it by holding the seller's own
-- payout behind an opinion they had no reason to hold.
--
-- Finishing a sale is still a good moment to ask a seller something. It is the point at
-- which they have been all the way round the product: listed, negotiated, shipped, been
-- paid. So they are asked about the product instead of about the buyer.
--
-- Deliberately NOT the reviews table. A review is public, attributed, and moves somebody's
-- rating. This is private to admins, moves nothing, and is honest for exactly that reason:
-- a seller writing "payouts take too long" would not write it if it were going on their
-- shop page.
--
-- booking_id is nullable so the same table can later take feedback that is not tied to a
-- sale -- a prompt from the dashboard, an exit survey -- without another migration.
-- It is a soft reference: a deleted booking must not take the feedback with it, because
-- the score still counts once the transaction it came from is gone.

CREATE TABLE IF NOT EXISTS platform_feedback (
  id           VARCHAR(36)  NOT NULL,
  user_id      VARCHAR(36)  NOT NULL,
  booking_id   VARCHAR(36)  NULL,
  -- Which side they were on when asked. Stored rather than derived from the user, because
  -- somebody who sold today may buy tomorrow, and "what sellers say about us" has to keep
  -- meaning that when the same person shows up in both roles.
  author_role  VARCHAR(16)  NOT NULL DEFAULT 'SELLER',
  rating       INT          NOT NULL,
  improvement  TEXT         NULL,
  created_at   DATETIME(6)  NULL,
  PRIMARY KEY (id),
  -- One answer per person per sale. The client fires this and navigates away, so a retry,
  -- a second device or a reload mid-submit would otherwise leave two answers about the same
  -- order and quietly skew the average.
  UNIQUE KEY uk_platform_feedback_user_booking (user_id, booking_id),
  -- The admin view reads newest-first and nothing else.
  KEY idx_platform_feedback_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify:
--   SELECT COUNT(*) FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_feedback';
