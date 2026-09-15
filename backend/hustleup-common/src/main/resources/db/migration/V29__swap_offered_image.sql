-- A photo for a free-text swap offer.
--
-- WHY
-- A swap offer is either a listing you own (real photos, price, reviews) or free text — but
-- free text was framed and built for skills and favours ("2hrs of calc tutoring"), which
-- have nothing to photograph. That made it the only way to offer a physical item you own
-- but never listed for sale, and it traded on nothing but its own written description while
-- the other side of the deal got real photos. This column lets that offer carry one too.
--
-- SHAPE
-- offered_image_url  VARCHAR(1024), matching @Column(length = 1024) and the width every
--                     other media URL column in this schema uses. Holds the raw storage
--                     key; presigning happens on read, same as proposer_proof_url /
--                     owner_proof_url added in V21. Meaningless (and left null) whenever
--                     offered_listing_id is set instead — that side already has its own
--                     listing photos.
--
-- Guarded like the other migrations here because Flyway was baselined over databases that
-- ddl-auto had already been shaping, so environments differ and this must be re-runnable.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'offered_image_url');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN offered_image_url VARCHAR(1024) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'swap_offers'
--      AND COLUMN_NAME = 'offered_image_url';
