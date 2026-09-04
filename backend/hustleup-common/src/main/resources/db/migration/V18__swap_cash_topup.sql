-- Cash top-up on swap offers.
--
-- SwapOffer gained three fields with no migration behind them, so marketplace failed
-- validation on startup the moment the entity shipped:
--
--   Schema-validation: missing column [cash_amount] in table [swap_offers]
--
-- Found by auditing every @Entity against the live schema rather than by reading the log:
-- Hibernate reports the first missing column and stops, so a drift of three columns costs
-- three deploy-and-crash cycles to discover one at a time. These three were the only real
-- drift on the whole schema; everything else the audit flagged was an @ElementCollection
-- living in its own table or an @EmbeddedId, not a missing column.
--
-- SHAPES
-- cash_amount    DECIMAL(12,2), matching @Column(precision = 12, scale = 2), and the same
--                shape the money columns on bookings and shop_orders already use.
-- cash_direction VARCHAR(20). The field is @Enumerated(EnumType.STRING) with an explicit
--                length, so it is stored as the constant's name and not an ordinal — an
--                ordinal would silently change meaning the day someone reorders the enum,
--                and this column decides who pays.
-- cash_currency  VARCHAR(3), an ISO 4217 code. Held per offer rather than assumed
--                platform-wide, because an accepted trade is a record of what two people
--                agreed and must not be reinterpreted by a later change of default.
--
-- All three are nullable: null is a pure barter, which is what every offer made before this
-- feature existed is. Guarded like the other migrations here because Flyway was baselined
-- over databases that ddl-auto had already been shaping, so environments differ.

-- ── cash_amount ─────────────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'cash_amount');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN cash_amount DECIMAL(12,2) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── cash_direction ──────────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'cash_direction');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN cash_direction VARCHAR(20) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── cash_currency ───────────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'cash_currency');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN cash_currency VARCHAR(3) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'swap_offers'
--      AND COLUMN_NAME LIKE 'cash%';
