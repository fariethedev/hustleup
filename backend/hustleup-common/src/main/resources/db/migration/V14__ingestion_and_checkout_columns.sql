-- ============================================================================
--  V14 — job/news ingestion columns, and the Stripe checkout idempotency column.
-- ============================================================================
--
--  Three entity fields were added in code without a migration to match, which
--  crash-looped every service on Railway: Hibernate's schema VALIDATOR (not
--  auto-DDL — this stack moved to ddl-auto: validate under Flyway) refused to
--  start rather than alter the live schema itself.
--
--      Schema-validation: missing column [external_id] in table [jobs]
--      Schema-validation: missing column [external_id] in table [news_articles]
--      Schema-validation: missing column [last_checkout_session_id] in table [subscriptions]
--
--  jobs/news_articles: source_name, source_url and external_id were all added
--  together for the scheduled ingestion feature (dedup by external_id via
--  existsByExternalId, "not ours" adverts routed to source_url instead of an
--  Apply button) — Hibernate only reports the first missing column it reaches
--  per table, so all three were absent even though just one was reported.
--
--  subscriptions.last_checkout_session_id: Stripe webhook replay guard in
--  StripeService — compares the incoming session id against the one already
--  recorded before reapplying a checkout.
--
--  Guarded through INFORMATION_SCHEMA, same as V12/V13: MySQL has no portable
--  ADD COLUMN IF NOT EXISTS across the versions this might run against, and
--  this needs to be safe to re-run.

-- ── jobs ───────────────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'source_name') > 0,
  'DO 0', 'ALTER TABLE jobs ADD COLUMN source_name VARCHAR(255) NULL COMMENT ''Board this advert was imported from, e.g. "Pracuj.pl"''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'source_url') > 0,
  'DO 0', 'ALTER TABLE jobs ADD COLUMN source_url VARCHAR(1024) NULL COMMENT ''Where a candidate actually applies for an imported advert''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'external_id') > 0,
  'DO 0', 'ALTER TABLE jobs ADD COLUMN external_id VARCHAR(512) NULL COMMENT ''Source board''''s own id for this advert; the dedupe key across repeated imports''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- existsByExternalId runs once per imported item on every ingestion cycle —
-- worth an index rather than a full scan as the table grows.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND INDEX_NAME = 'idx_jobs_external_id') > 0,
  'DO 0', 'CREATE INDEX idx_jobs_external_id ON jobs (external_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── news_articles ──────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'source_name') > 0,
  'DO 0', 'ALTER TABLE news_articles ADD COLUMN source_name VARCHAR(255) NULL COMMENT ''Outlet this article was imported from''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'source_url') > 0,
  'DO 0', 'ALTER TABLE news_articles ADD COLUMN source_url VARCHAR(1024) NULL COMMENT ''Original article URL for an imported story''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND COLUMN_NAME = 'external_id') > 0,
  'DO 0', 'ALTER TABLE news_articles ADD COLUMN external_id VARCHAR(512) NULL COMMENT ''Source outlet''''s own id; the dedupe key across repeated imports''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news_articles' AND INDEX_NAME = 'idx_news_articles_external_id') > 0,
  'DO 0', 'CREATE INDEX idx_news_articles_external_id ON news_articles (external_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── subscriptions ──────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'last_checkout_session_id') > 0,
  'DO 0', 'ALTER TABLE subscriptions ADD COLUMN last_checkout_session_id VARCHAR(255) NULL COMMENT ''Stripe session id already applied - replay guard for the webhook''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
