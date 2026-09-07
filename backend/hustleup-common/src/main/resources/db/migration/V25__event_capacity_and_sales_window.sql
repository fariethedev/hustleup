-- Event capacity and the ticket sales window.
--
-- WHAT WAS WRONG
-- An EVENT listing had a price, a start time and a venue, and nothing else. There was no
-- capacity anywhere in the system: nothing stopped selling ten thousand tickets to a
-- hundred-person room, and nothing stopped selling a ticket to a gig that happened last
-- week. Both failures land on a real person standing at a door they paid to get through.
--
-- WHAT THIS ADDS
--   listings.event_capacity   seats the organiser set. NULL means uncapped, which is what
--                             every event created before this is — a listing with no door
--                             limit. NULL and 0 are deliberately different: 0 means the
--                             organiser is selling nothing, and is reported as its own
--                             state rather than as a sell-out.
--   listings.sales_open_at    when tickets may first be bought. NULL means "from the moment
--                             it was posted".
--   listings.sales_close_at   when they stop. NULL means "until the event starts".
--                             Separate from event_starts_at because organisers routinely
--                             close sales early — to print a list, to brief the door on
--                             numbers. Without it the only way to stop selling was to delete
--                             the listing.
--
-- All three nullable, so every existing event keeps behaving exactly as it does today:
-- uncapped, on sale until it starts. No backfill — inventing a capacity for somebody else's
-- event would be inventing a number, and guessing low would break a working listing.
--
-- WHERE IT IS ENFORCED
-- EventAvailabilityService reads the door and BookingService refuses the purchase, so the
-- cap is server-side. A capacity that only existed in the client is one a second browser tab
-- walks straight through. Seats inside a checkout that has not yet paid are counted against
-- the cap for 20 minutes, so the last four seats cannot be sold twice to two people paying
-- at the same moment; after that an abandoned checkout releases them.
--
-- Guarded like the migrations around it: Flyway was baselined over databases that ddl-auto
-- had already been shaping, so environments genuinely differ and an unguarded ALTER would
-- succeed on one and fail on another with a recorded failure that blocks everything after it.

-- ── listings.event_capacity ─────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'event_capacity');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN event_capacity INT NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── listings.sales_open_at ──────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'sales_open_at');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN sales_open_at DATETIME(6) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── listings.sales_close_at ─────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'sales_close_at');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN sales_close_at DATETIME(6) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── the index the seat count is read through ────────────────────────────────
-- Every load of an event listing counts its issued tickets, and the holds query filters
-- bookings by listing. event_tickets already indexes listing_id; bookings does not, and
-- without it the hold count is a full scan of the bookings table per event card rendered.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'bookings'
              AND INDEX_NAME = 'idx_bookings_listing_created');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_bookings_listing_created ON bookings (listing_id, created_at)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings'
--      AND COLUMN_NAME IN ('event_capacity', 'sales_open_at', 'sales_close_at');
--
-- Expect three rows, all nullable.
