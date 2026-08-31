-- ============================================================================
--  V14 — source attribution on aggregated news and jobs.
--
--  Promoted from backend/db/manual/2026-08-30_news_and_job_aggregation.sql,
--  which carried the same DDL but had to be run by hand.
-- ============================================================================
--
--  WHY IT MOVED
--  The manual file opened with "RUN THIS BY HAND against every environment
--  BEFORE deploying". On Railway that is not possible: MySQL has no public
--  endpoint, so there is no hand to run it by. The build shipped, ddl-auto is
--  validate, and all five services failed to start:
--
--      Schema-validation: missing column [external_id] in table [news_articles]
--
--  Anything a deploy depends on has to be a migration. That is the whole reason
--  Flyway went in.
--
--  WHAT IT DOES  (unchanged from the manual version)
--    news_articles / jobs  += source_name, source_url, external_id
--        Non-null only on rows fetched from an outside source. source_name
--        doubles as the "this is not ours" flag, so the client credits the
--        outlet and links out rather than presenting someone else's work as
--        HustleSpace's.
--    publisher_user_id     NOT NULL -> NULL on both
--        An imported article or advert has no HustleSpace publisher. The
--        alternative was a synthetic "system" account, which would put a fake
--        byline on real reporting.
--
--  Rewritten without the DELIMITER/stored-procedure helpers the manual file
--  used. DELIMITER is a mysql-client directive rather than SQL, and the inline
--  INFORMATION_SCHEMA guard below is the form already proven against this
--  Flyway build and MySQL 9.4 in V12 and V13. Same idempotency, fewer moving
--  parts on the one path that has to work first time.

-- ── news_articles: source columns ───────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'source_name') > 0,
  'DO 0', 'ALTER TABLE news_articles ADD COLUMN source_name VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'source_url') > 0,
  'DO 0', 'ALTER TABLE news_articles ADD COLUMN source_url VARCHAR(1024) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'external_id') > 0,
  'DO 0', 'ALTER TABLE news_articles ADD COLUMN external_id VARCHAR(512) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- external_id is checked once per feed entry on every poll, across every source.
-- Unindexed that is a full scan of the articles table per entry. Deliberately a plain
-- index rather than UNIQUE: two outlets syndicating the same wire story can legitimately
-- share a guid, and a constraint violation there would abort a whole import run over a
-- duplicate the dedupe check already handles.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND INDEX_NAME = 'idx_news_external_id') > 0,
  'DO 0', 'CREATE INDEX idx_news_external_id ON news_articles (external_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND INDEX_NAME = 'idx_news_source') > 0,
  'DO 0', 'CREATE INDEX idx_news_source ON news_articles (source_name, published_at)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Relaxes a constraint only. Every existing row already has a publisher, so nothing is
-- rewritten and nothing can fail afterwards. Guarded so a re-run is a no-op rather than a
-- pointless table rebuild.
SET @ddl = IF((SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'publisher_user_id') = 'YES',
  'DO 0', 'ALTER TABLE news_articles MODIFY COLUMN publisher_user_id VARCHAR(36) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── jobs: source columns ────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'source_name') > 0,
  'DO 0', 'ALTER TABLE jobs ADD COLUMN source_name VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'source_url') > 0,
  'DO 0', 'ALTER TABLE jobs ADD COLUMN source_url VARCHAR(1024) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'external_id') > 0,
  'DO 0', 'ALTER TABLE jobs ADD COLUMN external_id VARCHAR(512) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND INDEX_NAME = 'idx_jobs_external_id') > 0,
  'DO 0', 'CREATE INDEX idx_jobs_external_id ON jobs (external_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND INDEX_NAME = 'idx_jobs_source') > 0,
  'DO 0', 'CREATE INDEX idx_jobs_source ON jobs (source_name, created_at)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'publisher_user_id') = 'YES',
  'DO 0', 'ALTER TABLE jobs MODIFY COLUMN publisher_user_id VARCHAR(36) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── subscriptions.last_checkout_session_id ──────────────────────────────────
-- Promoted from backend/db/manual/2026-08-30_subscription_session_idempotency.sql for the
-- same reason as everything above. Folded into this migration rather than left for a V15:
-- Subscription maps the field, so the subscription service would fail validation on its
-- very next boot — fixing news and jobs alone would have moved the outage rather than
-- ended it.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'last_checkout_session_id') > 0,
  'DO 0', 'ALTER TABLE subscriptions ADD COLUMN last_checkout_session_id VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
