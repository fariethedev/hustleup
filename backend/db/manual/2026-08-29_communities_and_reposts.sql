-- Communities (member-created groups with their own feed) and reposts.
--
-- RUN THIS BY HAND against every environment that uses ddl-auto: validate (Railway),
-- BEFORE deploying the build that adds them.
--
-- WHY BY HAND
-- Local development runs ddl-auto: update and creates all of this silently on first start,
-- which is exactly why a missing migration stays invisible until deploy. Railway runs
-- ddl-auto: validate: Hibernate refuses to build the SessionFactory when a mapped entity
-- has no table or a mapped field has no column, and hustleup-social then fails to start —
-- taking the feed, stories, follows, Bond and the news desk down with it. See
-- 2026-08-28_create_shop_orders.sql for the last time that happened.
--
-- WHAT IT ADDS
--   communities          one row per group, e.g. "Cars in Lublin"
--   community_members    who is in which group; the pair is the primary key
--   posts.community_id   which group a post was written into, NULL for the open feed
--   posts.repost_of_id   the post this one shares, NULL for original content
--   posts.repost_count   denormalised share count, mirroring likes_count
--
-- SAFETY
-- CREATE TABLE IF NOT EXISTS, and every ALTER wrapped in add_column_if_missing — MySQL has
-- no ADD COLUMN IF NOT EXISTS, which is why the procedure exists. Safe to run repeatedly
-- and safe against a database where some of this already exists (a local box that ran with
-- ddl-auto: update). Nothing here drops, renames or rewrites anything.
--
-- Existing posts get NULL for community_id and repost_of_id, which is precisely what they
-- are: open-feed posts that are nobody's repost. No backfill is needed or wanted.
--
-- Note VARCHAR(36) for ids: social entities use String UUIDs stored as text.

-- ── Communities ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id            VARCHAR(36)   NOT NULL,
  creator_id    VARCHAR(36)   NOT NULL,
  name          VARCHAR(80)   NOT NULL,
  slug          VARCHAR(100)  NOT NULL,
  description   TEXT          NULL,
  city          VARCHAR(80)   NULL,
  category      VARCHAR(60)   NULL,
  image_url     VARCHAR(512)  NULL,
  member_count  INT           NOT NULL DEFAULT 0,
  created_at    DATETIME(6)   NOT NULL,
  PRIMARY KEY (id),
  -- Communities are addressed by slug in URLs, and the slug generator relies on this
  -- uniqueness to decide when to suffix ("cars-in-lublin-2").
  UNIQUE KEY idx_communities_slug (slug),
  KEY idx_communities_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Membership ───────────────────────────────────────────────────────────────
-- The (community, member) pair is the primary key rather than a generated id: that is what
-- makes joining idempotent in the database itself, so a double-tapped Join button rewrites
-- one row instead of creating a second membership and inflating member_count.
CREATE TABLE IF NOT EXISTS community_members (
  community_id  VARCHAR(36)  NOT NULL,
  member_id     VARCHAR(36)  NOT NULL,
  role          VARCHAR(16)  NOT NULL,
  joined_at     DATETIME(6)  NOT NULL,
  PRIMARY KEY (community_id, member_id),
  -- "which communities am I in?" is the hot query — it builds the Communities feed on
  -- every load. Without this it is a full scan of the membership table.
  KEY idx_community_members_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Post columns ─────────────────────────────────────────────────────────────
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

CALL add_column_if_missing('posts', 'community_id',  'VARCHAR(36) NULL');
CALL add_column_if_missing('posts', 'repost_of_id',  'VARCHAR(36) NULL');
CALL add_column_if_missing('posts', 'repost_count',  'INT NULL DEFAULT 0');

-- Both feeds filter on these columns on every load, and the repost toggle looks up
-- (author, original) per card. Unindexed, each of those is a scan of the whole posts table.
CALL add_index_if_missing('posts', 'idx_posts_community',    '`community_id`, `created_at`');
CALL add_index_if_missing('posts', 'idx_posts_repost_of',    '`repost_of_id`');
CALL add_index_if_missing('posts', 'idx_posts_author_repost', '`author_id`, `repost_of_id`');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Verify:
--   SELECT TABLE_NAME FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME IN ('communities', 'community_members');
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts'
--      AND COLUMN_NAME IN ('community_id', 'repost_of_id', 'repost_count');
--
-- Expect two tables and three columns. Then restart hustleup-social.
