-- Two-sided reviews: one review per person per booking, not one per booking.
--
-- WHY THIS FILE EXISTS
-- The `reviews` table was created with `booking_id` marked UNIQUE, which meant a booking
-- could only ever hold a single review. In a two-sided marketplace that is a silent data
-- bug: whichever party rated first permanently locked the other one out, so a seller
-- rating their buyer destroyed the buyer's ability to rate the seller — and the
-- buyer→seller rating is exactly what a shop page displays.
--
-- WHY IT IS NOT AUTOMATIC
-- Every service runs with `spring.jpa.hibernate.ddl-auto: update`, which only ADDS schema
-- objects. It will happily create the new composite constraint, but it will never drop the
-- old single-column one — so without running this, inserts still fail with a duplicate key
-- error on the second review and the feature appears broken for no visible reason.
--
-- RUN THIS ONCE per environment (local, staging, Railway) BEFORE deploying the change.
--
-- The index name below is Hibernate-generated and differs per database. Find yours with:
--     SHOW INDEX FROM reviews WHERE Non_unique = 0;
-- and substitute it. Local dev at the time of writing had UK3p9j9vyr1qofbcxju65es206r.

-- 1. Confirm what you are about to drop, and how much data is at stake.
SELECT COUNT(*) AS existing_reviews FROM reviews;
SHOW INDEX FROM reviews WHERE Non_unique = 0;

-- 2. Drop the single-column unique index.
ALTER TABLE reviews DROP INDEX UK3p9j9vyr1qofbcxju65es206r;

-- 3. Add the composite: a person may review a booking once, both parties may review it.
ALTER TABLE reviews ADD CONSTRAINT uk_reviews_booking_reviewer UNIQUE (booking_id, reviewer_id);

-- 4. Verify: you should see PRIMARY plus uk_reviews_booking_reviewer over two columns.
SHOW INDEX FROM reviews WHERE Non_unique = 0;
