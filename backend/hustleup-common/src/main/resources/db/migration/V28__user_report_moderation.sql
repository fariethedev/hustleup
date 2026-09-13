-- Moderation state for user safety reports.
--
-- RUN THIS BY HAND on every environment, local included — hustleup-social runs
-- ddl-auto: validate, so the new columns must exist before the service will start.
--
-- WHY
-- user_reports has been write-only since it was added. A report was inserted, the reporter
-- was told it had been submitted, and that was the end of it: no endpoint ever read the
-- table back, so nothing anyone reported was ever seen. The rows are all still there, which
-- is the one piece of luck in this — the backlog is intact and becomes a queue the moment
-- there is somewhere to show it.
--
-- A queue needs somewhere to record that a row has been dealt with. Without it every report
-- is permanently open, the same ones are re-read on every pass, and two moderators cannot
-- tell each other's work apart.
--
-- WHY status DEFAULTS TO 'OPEN'
-- Every existing row predates moderation, so none of them has been actioned. OPEN is
-- therefore the honest value for the backlog, not merely a convenient one — these reports
-- genuinely have never been looked at.
--
-- SAFETY
-- Additive. The three resolution columns are nullable and status carries a default, so
-- existing rows need no backfill. Each ALTER is guarded on information_schema, so re-running
-- is a no-op — and so is running this against an environment ddl-auto had already shaped.

-- ── has this been dealt with ────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_reports'
              AND COLUMN_NAME = 'status');
SET @s := IF(@c = 0,
  "ALTER TABLE user_reports ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN | ACTIONED | DISMISSED'",
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── what the moderator decided, and why ─────────────────────────────────────
-- Free text rather than a reason code: the useful part of a moderation decision is the
-- sentence explaining it to whoever reads the row next, and a dropdown cannot carry that.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_reports'
              AND COLUMN_NAME = 'moderator_note');
SET @s := IF(@c = 0,
  'ALTER TABLE user_reports ADD COLUMN moderator_note TEXT NULL',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── who closed it ───────────────────────────────────────────────────────────
-- Soft reference, no foreign key, matching protection_claims.resolved_by: the audit trail
-- of who made a moderation call should outlive the moderator's own account.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_reports'
              AND COLUMN_NAME = 'resolved_by');
SET @s := IF(@c = 0,
  'ALTER TABLE user_reports ADD COLUMN resolved_by VARCHAR(36) NULL',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── when ────────────────────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_reports'
              AND COLUMN_NAME = 'resolved_at');
SET @s := IF(@c = 0,
  'ALTER TABLE user_reports ADD COLUMN resolved_at DATETIME(6) NULL',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── the queue lookup ────────────────────────────────────────────────────────
-- The console opens on "what is still open", which is this index's only job. Guarded for
-- the same reason as V18, V22 and V24 — Flyway was baselined over databases ddl-auto had
-- already shaped, so environments genuinely differ.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'user_reports'
              AND INDEX_NAME = 'idx_user_report_status');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_user_report_status ON user_reports (status, created_at)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── everything reported against one account ─────────────────────────────────
-- "Has this person been reported before?" is the question that turns a single complaint into
-- a pattern, and it is asked on every row the moderator opens.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'user_reports'
              AND INDEX_NAME = 'idx_user_report_reported');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_user_report_reported ON user_reports (reported_id)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_reports';
