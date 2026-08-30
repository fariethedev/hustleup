-- Aggregated news and jobs: source attribution on articles and adverts pulled from
-- outside feeds, and the nullable publisher those rows require.
--
-- RUN THIS BY HAND against every environment BEFORE deploying the build that adds them.
--
-- WHY BY HAND, AND WHY THIS ONE MATTERS LOCALLY TOO
-- hustleup-social now runs ddl-auto: validate in its committed application.yml — not just
-- on Railway. Hibernate refuses to build the SessionFactory when a mapped field has no
-- column, so without this the social service fails to start on a developer machine as
-- well, taking the feed, stories, follows, communities and the news desk with it.
-- hustleup-marketplace is the same story for the jobs half.
--
-- WHAT IT ADDS
--   news_articles.source_name / source_url / external_id
--   jobs.source_name / source_url / external_id
--       Non-null only on rows fetched from an outside source. source_name doubles as the
--       "this is not ours" flag: the client credits the outlet or board and links out to
--       the original rather than presenting someone else's work as HustleSpace's.
--
-- WHAT IT CHANGES
--   news_articles.publisher_user_id  NOT NULL -> NULL
--   jobs.publisher_user_id           NOT NULL -> NULL
--       An imported article or advert has no HustleSpace publisher. The alternative was a
--       synthetic "system" account, which would put a fake byline on real reporting and
--       make "everything by this publisher" wrong for every outlet.
--
-- SAFETY
-- Column adds are guarded by add_column_if_missing (MySQL has no ADD COLUMN IF NOT EXISTS),
-- so this is safe to run repeatedly. The two MODIFY statements only relax a constraint:
-- every existing row already has a publisher, so nothing is rewritten and nothing can fail
-- validation afterwards. No data is dropped anywhere in this file.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN table_name_in  VARCHAR(64),
  IN column_name_in VARCHAR(64),
  IN definition_in  VARCHAR(255))
BEGIN
  IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = table_name_in
           AND COLUMN_NAME  = column_name_in)
  THEN
    SET @ddl = CONCAT('ALTER TABLE `', table_name_in,
                      '` ADD COLUMN `', column_name_in, '` ', definition_in);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN table_name_in VARCHAR(64),
  IN index_name_in VARCHAR(64),
  IN columns_in    VARCHAR(255))
BEGIN
  IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = table_name_in
           AND INDEX_NAME   = index_name_in)
  THEN
    SET @ddl = CONCAT('ALTER TABLE `', table_name_in,
                      '` ADD INDEX `', index_name_in, '` (', columns_in, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- ── News ─────────────────────────────────────────────────────────────────────
CALL add_column_if_missing('news_articles', 'source_name', 'VARCHAR(255) NULL');
CALL add_column_if_missing('news_articles', 'source_url',  'VARCHAR(1024) NULL');
CALL add_column_if_missing('news_articles', 'external_id', 'VARCHAR(512) NULL');

-- external_id is checked once per feed entry on every poll — every 30 minutes, across
-- every source. Unindexed that is a full scan of the articles table per entry.
-- Deliberately a plain index rather than UNIQUE: two outlets syndicating the same wire
-- story can legitimately share a guid, and a constraint violation there would abort the
-- whole import run over a duplicate the dedupe check already handles.
CALL add_index_if_missing('news_articles', 'idx_news_external_id', '`external_id`');
CALL add_index_if_missing('news_articles', 'idx_news_source',      '`source_name`, `published_at`');

ALTER TABLE news_articles MODIFY COLUMN publisher_user_id VARCHAR(36) NULL;

-- ── Jobs ─────────────────────────────────────────────────────────────────────
CALL add_column_if_missing('jobs', 'source_name', 'VARCHAR(255) NULL');
CALL add_column_if_missing('jobs', 'source_url',  'VARCHAR(1024) NULL');
CALL add_column_if_missing('jobs', 'external_id', 'VARCHAR(512) NULL');

CALL add_index_if_missing('jobs', 'idx_jobs_external_id', '`external_id`');
CALL add_index_if_missing('jobs', 'idx_jobs_source',      '`source_name`, `created_at`');

ALTER TABLE jobs MODIFY COLUMN publisher_user_id VARCHAR(36) NULL;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verify:
--   SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME IN ('news_articles', 'jobs')
--      AND COLUMN_NAME IN ('source_name', 'source_url', 'external_id', 'publisher_user_id')
--    ORDER BY TABLE_NAME, COLUMN_NAME;
--
-- Expect eight rows, with publisher_user_id showing IS_NULLABLE = YES on both tables.
-- Then restart hustleup-social and hustleup-marketplace.
--
-- Turning the importers on (both are dormant until configured):
--   NEWS_SOURCES="Name|https://outlet.example|lublin,Other|https://other.example|students"
--   ADZUNA_APP_ID / ADZUNA_APP_KEY   (free at https://developer.adzuna.com)
-- Then, as an admin, POST /api/v1/news/import and POST /api/v1/jobs/import to fetch
-- immediately and see per-source success and failure counts.
