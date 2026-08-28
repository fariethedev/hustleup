-- ============================================================================
--  DEMO DATA — seeds review rows so shop pages are not empty in a demo/dev DB.
--  NOT a migration. Nothing in the application runs this; you run it by hand.
-- ============================================================================
--
-- READ THIS BEFORE RUNNING IT ANYWHERE REAL
-- These reviews are invented. Once inserted they are indistinguishable from real
-- ones on the page: they set the star rating on every shop card, the average in
-- the shop hero, the distribution bars, and the seller's leaderboard position —
-- and they are attributed by name to real user accounts who never wrote them.
-- That is fine on a laptop and fine for a demo. On a production database it is
-- fabricated buyer feedback shown to real customers, which is a different thing
-- entirely. The decision is yours; this file will not make it for you.
--
-- WHY THE ROWS LOOK LIKE THIS
--   * booking_id is a fresh UUID pointing at no booking. Real reviews are
--     anchored to a COMPLETED booking and ReviewController enforces that on
--     write, but nothing reads back through booking_id — so display works
--     without inventing a matching booking, payment and payout chain.
--     It also doubles as the marker for the undo below: a seeded review is
--     exactly a review whose booking does not exist, and a genuine one can
--     never look like that.
--   * reviewer_id is a real existing user, because ReviewController resolves the
--     display name via userRepository.findById(reviewerId); a made-up id renders
--     as "Buyer" with no name at all.
--   * Test-looking accounts are filtered out of the reviewer pool. A five-star
--     review signed "E2E Test2" is worse than no review.
--   * Ratings are mixed, including a 3. A wall of 5s reads as purchased, and it
--     would leave the rating-distribution bars on the shop page — which exist
--     precisely to show the spread — as one solid row.
--
-- Safe to run twice: the INSERT is guarded, so a second run inserts nothing
-- rather than doubling every shop's review count.

-- The review text below contains Polish diacritics and em dashes, and this file is
-- UTF-8. The mysql client on Windows negotiates cp850, which turns every one of
-- those into box-drawing rubbish on the way in and reports no error at all.
-- Declared here rather than left to a --default-character-set flag so the file is
-- correct however it is invoked.
SET NAMES utf8mb4;

-- ── The seed ────────────────────────────────────────────────────────────────
INSERT INTO reviews (id, booking_id, reviewer_id, reviewed_id, rating, comment, created_at)
WITH
-- Everyone who owns a storefront gets the same set of reviews.
owners AS (
  SELECT DISTINCT owner_id FROM shops
),
-- Real accounts that could plausibly have bought something, numbered so each
-- comment below can claim one. Owners are excluded so nobody reviews themselves,
-- and obvious test accounts are excluded so the names read as customers.
candidates AS (
  SELECT u.id,
         ROW_NUMBER() OVER (ORDER BY u.created_at, u.id) AS rn
  FROM users u
  WHERE u.id NOT IN (SELECT owner_id FROM owners)
    AND u.full_name IS NOT NULL
    AND u.full_name <> ''
    AND LOWER(u.full_name) NOT REGEXP 'test|tester|e2e|qa|probe|nosy|dummy|admin|ops|deploy|onboard|seeker|match |mail|story|security|viewer|seller|buyer|client|user'
),
-- slot -> which candidate writes it. days_ago spreads them over ~2.5 months so
-- the dates on the page are not all the same afternoon.
demo(slot, rating, comment, days_ago) AS (
  SELECT 1, 5, 'Zamówienie dotarło szybciej niż się spodziewałam. Jakość naprawdę dobra jak na tę cenę — polecam!', 4
  UNION ALL SELECT 2, 5, 'Bought here twice now. Packaging is neat, communication is quick, and the price was exactly what was listed — no surprises at checkout.', 11
  UNION ALL SELECT 3, 4, 'Really happy with it overall. Took a couple of days longer than I expected to ship, but the seller messaged me to explain, so no complaints.', 19
  UNION ALL SELECT 4, 5, 'Odbiór osobisty w centrum, wszystko zgodnie z opisem. Miła i konkretna obsługa.', 27
  UNION ALL SELECT 5, 5, 'Student budget approved. Genuinely better than the chain shop version I was looking at, and about half the price.', 38
  UNION ALL SELECT 6, 3, 'The item itself is good quality and matches the photos. Knocking off a couple of stars because it took nearly a week to hear back from my first message.', 46
  UNION ALL SELECT 7, 4, 'Solid. Would have liked a bit more detail in the listing description, but I asked and got a proper answer within the hour.', 58
  UNION ALL SELECT 8, 5, 'Second order from this shop and still no complaints. Easy to deal with, quick to reply, exactly as described.', 73
)
SELECT
  UUID(),                                    -- id
  UUID(),                                    -- booking_id: intentionally unanchored, see above
  c.id,                                      -- reviewer_id
  o.owner_id,                                -- reviewed_id
  d.rating,
  d.comment,
  DATE_SUB(NOW(), INTERVAL d.days_ago DAY)
FROM owners o
JOIN demo d
JOIN candidates c ON c.rn = d.slot
-- Already seeded for this owner? Do nothing. Wrapped in a derived table because
-- MySQL will not let a subquery read the table being written to directly.
WHERE NOT EXISTS (
  SELECT 1
  FROM (SELECT reviewed_id, booking_id FROM reviews) r
  LEFT JOIN bookings b ON b.id = r.booking_id
  WHERE r.reviewed_id = o.owner_id AND b.id IS NULL
);

-- ── Check what landed ───────────────────────────────────────────────────────
--   SELECT s.name, s.slug, ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(*) AS reviews
--     FROM shops s JOIN reviews r ON r.reviewed_id = s.owner_id
--    GROUP BY s.id, s.name, s.slug;

-- ── Undo ────────────────────────────────────────────────────────────────────
-- Removes exactly the rows this file inserted: reviews with no booking behind
-- them. A review written through the API always has one, so this cannot touch a
-- genuine review.
--
--   DELETE r FROM reviews r
--     LEFT JOIN bookings b ON b.id = r.booking_id
--    WHERE b.id IS NULL;
