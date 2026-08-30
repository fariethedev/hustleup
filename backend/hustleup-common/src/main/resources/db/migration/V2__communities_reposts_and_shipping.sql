-- ============================================================================
--  V2 — communities, reposts, and per-item shipping.
--
--  The first real migration. V1 is a baseline marker for the schema Hibernate
--  built before migrations existed — see V1__baseline.sql.
-- ============================================================================
--
--  WHY EVERY STATEMENT IS GUARDED
--  MySQL has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — that is a MariaDB
--  extension, and Railway runs mysql:9.4. Nor is there `CREATE INDEX IF NOT
--  EXISTS`. So conditionality has to go through INFORMATION_SCHEMA and a
--  prepared statement, which is what the blocks below do.
--
--  It would be simpler to write bare DDL and let Flyway's history table stop it
--  running twice. That is fine for the production database, which does not have
--  these columns. It is not fine for a developer's laptop: local runs use
--  ddl-auto=update, so Hibernate has very likely already created some of this,
--  and bare DDL would fail with "duplicate column" and stop the service from
--  starting. Guarding costs verbosity and buys a migration that converges any
--  database to the same shape.

-- ── Communities ─────────────────────────────────────────────────────────────
-- CREATE TABLE does support IF NOT EXISTS, so these two need no guard.

CREATE TABLE IF NOT EXISTS communities (
    id           VARCHAR(36)  NOT NULL,
    creator_id   VARCHAR(36)  NOT NULL,
    name         VARCHAR(80)  NOT NULL,
    slug         VARCHAR(100) NOT NULL,
    description  TEXT         NULL,
    city         VARCHAR(80)  NULL,
    category     VARCHAR(60)  NULL,
    image_url    VARCHAR(512) NULL,
    member_count INT          NOT NULL DEFAULT 0,
    created_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    -- The slug is the public URL segment, so a duplicate makes one of the two
    -- communities unreachable. Enforced here, not only in application code.
    UNIQUE KEY uk_communities_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_members (
    community_id VARCHAR(36) NOT NULL,
    member_id    VARCHAR(36) NOT NULL,
    role         VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    joined_at    DATETIME(6) NOT NULL,
    -- Composite key: one row per person per community, so joining twice is
    -- impossible at the database level rather than via check-then-insert.
    PRIMARY KEY (community_id, member_id),
    -- Matches @Index on the entity. Without it, "which communities am I in?"
    -- scans the table, and that runs on every feed load.
    KEY idx_community_members_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── posts.community_id ──────────────────────────────────────────────────────
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'community_id') > 0,
  'DO 0',
  'ALTER TABLE posts ADD COLUMN community_id VARCHAR(36) NULL COMMENT ''Community this was posted into; NULL for the open feed''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── posts.repost_of_id ──────────────────────────────────────────────────────
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'repost_of_id') > 0,
  'DO 0',
  'ALTER TABLE posts ADD COLUMN repost_of_id VARCHAR(36) NULL COMMENT ''The post this reposts; NULL for original content''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── posts.repost_count ──────────────────────────────────────────────────────
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'repost_count') > 0,
  'DO 0',
  'ALTER TABLE posts ADD COLUMN repost_count INT NOT NULL DEFAULT 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Both new post columns are read as feed filters, so they are indexed. Not foreign
-- keys: author_id is not one either, deliberately — these ids cross service
-- boundaries and are resolved at read time.
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_community') > 0,
  'DO 0',
  'CREATE INDEX idx_posts_community ON posts (community_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_repost_of') > 0,
  'DO 0',
  'CREATE INDEX idx_posts_repost_of ON posts (repost_of_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── listings shipping ───────────────────────────────────────────────────────
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'shipping_method') > 0,
  'DO 0',
  'ALTER TABLE listings ADD COLUMN shipping_method VARCHAR(32) NULL DEFAULT ''NONE'' COMMENT ''ShippingMethod enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listings' AND COLUMN_NAME = 'shipping_price') > 0,
  'DO 0',
  'ALTER TABLE listings ADD COLUMN shipping_price DECIMAL(12,2) NULL DEFAULT 0.00 COMMENT ''Postage on top of price; 0 for free delivery and collection''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── shop_products shipping ──────────────────────────────────────────────────
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_products' AND COLUMN_NAME = 'shipping_method') > 0,
  'DO 0',
  'ALTER TABLE shop_products ADD COLUMN shipping_method VARCHAR(32) NULL DEFAULT ''NONE''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_products' AND COLUMN_NAME = 'shipping_price') > 0,
  'DO 0',
  'ALTER TABLE shop_products ADD COLUMN shipping_price DECIMAL(12,2) NULL DEFAULT 0.00');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── reviews.shop_order_id ───────────────────────────────────────────────────
SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'shop_order_id') > 0,
  'DO 0',
  'ALTER TABLE reviews ADD COLUMN shop_order_id VARCHAR(36) NULL COMMENT ''The ShopOrder this review is about; NULL for booking reviews''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND INDEX_NAME = 'idx_reviews_shop_order') > 0,
  'DO 0',
  'CREATE INDEX idx_reviews_shop_order ON reviews (shop_order_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
