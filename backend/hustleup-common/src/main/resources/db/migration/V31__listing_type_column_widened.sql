-- listings.listing_type was a native MySQL ENUM left over from before Flyway existed —
-- the original table was built by Hibernate ddl-auto, which (on this column only) was
-- backed by a real SQL ENUM constrained to whatever ListingType constants existed at the
-- time. Every category added since then has silently depended on already being in that
-- list. LUGGAGE was not, and the very first real attempt to create one failed in
-- production with "Data truncated for column 'listing_type'" — MySQL's error for a value
-- outside an ENUM's defined set. RENTAL was very likely in the same position: it existed
-- as a Java enum constant for a while but was never reachable from the create-listing
-- form, so nothing had ever actually tried to insert it either.
--
-- The entity has always mapped this column with @Enumerated(EnumType.STRING) and no
-- explicit @Column length — Hibernate's own default for that is VARCHAR(255), which is
-- the width used below so `ddl-auto: validate` finds exactly the column it expects rather
-- than trading one mismatch for another.
--
-- Guarded like every migration here — skip if this has already been converted.
SET @t := (SELECT DATA_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'listing_type');
SET @s := IF(@t = 'enum',
             'ALTER TABLE listings MODIFY COLUMN listing_type VARCHAR(255) NOT NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'listing_type';
