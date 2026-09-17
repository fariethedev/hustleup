-- Two listing categories that existed only as stubs get their real fields.
--
-- LUGGAGE is brand new: a traveller sells spare luggage allowance by weight (price is per
-- kg), so it needs where it's collected from (already locationCity), where it's going
-- (destination_city), and how much weight is on offer (luggage_capacity_kg).
--
-- RENTAL existed as an enum value and a bare "agentFee applies?" boolean, but was never
-- reachable from the create-listing form — an agent had no way to state a deposit, the
-- actual fee amount, or bills, and no choice between taking payment on the platform or just
-- collecting enquiries. These columns are what that form now writes.
--
-- Guarded like every migration in this file since Flyway was baselined over a database
-- ddl-auto had already been shaping, so environments differ and this must be re-runnable.

-- ── destination_city (LUGGAGE) ──────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'destination_city');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN destination_city VARCHAR(255) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── luggage_capacity_kg (LUGGAGE) ───────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'luggage_capacity_kg');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN luggage_capacity_kg INT NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── deposit_amount (RENTAL) ──────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'deposit_amount');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN deposit_amount DECIMAL(12,2) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── agent_fee_amount (RENTAL) ────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'agent_fee_amount');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN agent_fee_amount DECIMAL(12,2) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── bills_amount (RENTAL) ────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'bills_amount');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN bills_amount DECIMAL(12,2) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── pay_on_platform (RENTAL) ─────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'listings'
              AND COLUMN_NAME = 'pay_on_platform');
SET @s := IF(@c = 0,
             'ALTER TABLE listings ADD COLUMN pay_on_platform TINYINT(1) NOT NULL DEFAULT 0',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings'
--      AND COLUMN_NAME IN ('destination_city', 'luggage_capacity_kg', 'deposit_amount',
--                           'agent_fee_amount', 'bills_amount', 'pay_on_platform');
