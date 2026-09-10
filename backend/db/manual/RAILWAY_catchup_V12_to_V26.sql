-- ============================================================================
-- Railway catch-up: every schema change from V12 to V26, in order.
--
-- WHY THIS FILE EXISTS
-- Flyway is not a dependency of this project, so nothing applies the migrations
-- under db/migration automatically. Meanwhile hustleup-marketplace and
-- hustleup-social run `ddl-auto: validate` in their committed application.yml,
-- which means a missing column does not degrade a feature — it stops the whole
-- service starting. Production is behind local by fifteen migrations.
--
-- SAFE TO RUN WHOLESALE
-- Every statement below is guarded: each ALTER/CREATE checks
-- information_schema first and does nothing when the column, table or index is
-- already there. V23 is a set of recount UPDATEs, which recompute counters from
-- the rows themselves and so are safe to repeat. Running this against a
-- database that is already partly migrated is therefore a no-op for the parts
-- it already has.
--
-- HOW TO RUN
-- Railway → your MySQL service → Data / Query, paste the whole file, run it.
-- Then redeploy (or restart) hustleup-marketplace and hustleup-social so they
-- re-validate against the new schema.
--
-- WHAT IT UNBLOCKS, in the order you are likely to notice
--   V17, V26  storefront payouts and the "connect your payouts" notice
--   V20, V22  comment likes and threading  (social will not start without these)
--   V24       protection claims, which the payout release consults
--   V25       event capacity and the ticket sales window
-- ============================================================================


-- ===========================================================================
-- V12__communities_reposts_and_shipping.sql
-- ===========================================================================
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


-- ===========================================================================
-- V13__fulfilment_columns.sql
-- ===========================================================================
-- ============================================================================
--  V13 — the Fulfilment embeddable's columns on bookings and shop_orders.
-- ============================================================================
--
--  Fulfilment is an @Embeddable shared by Booking and ShopOrder, so each of its
--  fields becomes a column on BOTH tables. V12 missed all of them: it was built
--  by scanning entity classes for @Column declarations, and an embeddable lives
--  outside the model package, so nothing pointed at it.
--
--  Marketplace crash-looped on the first of them:
--      Schema-validation: missing column [tracking_carrier] in table [bookings]
--
--  Guarded through INFORMATION_SCHEMA for the same reasons as V12 — MySQL has no
--  ADD COLUMN IF NOT EXISTS, and shop_orders was created by hand recently so it
--  may already carry some of these.

-- ── bookings ───────────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipping_method') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipping_method VARCHAR(32) NULL COMMENT ''ShippingMethod enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipping_price') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipping_price DECIMAL(12,2) NULL COMMENT ''Postage on top of the item price''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'fulfilment_status') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN fulfilment_status VARCHAR(32) NULL COMMENT ''FulfilmentStatus enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tracking_carrier') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN tracking_carrier VARCHAR(80) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tracking_number') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN tracking_number VARCHAR(120) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'tracking_url') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN tracking_url VARCHAR(512) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'dropoff_point') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN dropoff_point VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipping_note') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipping_note TEXT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'estimated_delivery') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN estimated_delivery DATE NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'shipped_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN shipped_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'delivered_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN delivered_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'fulfilment_updated_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN fulfilment_updated_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'buyer_confirmed_at') > 0,
  'DO 0', 'ALTER TABLE bookings ADD COLUMN buyer_confirmed_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── shop_orders ───────────────────────────────────────────────────────────
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipping_method') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipping_method VARCHAR(32) NULL COMMENT ''ShippingMethod enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipping_price') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipping_price DECIMAL(12,2) NULL COMMENT ''Postage on top of the item price''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'fulfilment_status') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN fulfilment_status VARCHAR(32) NULL COMMENT ''FulfilmentStatus enum, stored by name''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'tracking_carrier') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN tracking_carrier VARCHAR(80) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'tracking_number') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN tracking_number VARCHAR(120) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'tracking_url') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN tracking_url VARCHAR(512) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'dropoff_point') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN dropoff_point VARCHAR(255) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipping_note') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipping_note TEXT NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'estimated_delivery') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN estimated_delivery DATE NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'shipped_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN shipped_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'delivered_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN delivered_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'fulfilment_updated_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN fulfilment_updated_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'buyer_confirmed_at') > 0,
  'DO 0', 'ALTER TABLE shop_orders ADD COLUMN buyer_confirmed_at DATETIME(6) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;


-- ===========================================================================
-- V14__news_and_job_aggregation.sql
-- ===========================================================================
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


-- ===========================================================================
-- V15__ingestion_and_checkout_columns.sql
-- ===========================================================================
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


-- ===========================================================================
-- V16__direct_message_offers.sql
-- ===========================================================================
-- ============================================================================
--  V16 — direct_messages.offer_booking_id, for chat-embedded negotiation.
-- ============================================================================
--
--  New messageType = "OFFER" on DirectMessage. Unlike the LISTING/POST/STORY
--  share types (which snapshot title/price/image at send time), an offer
--  message stores only a reference to the live Booking — the card fetches
--  current price/status by id so accept/decline/counter show up in both
--  parties' chat without editing old messages.
--
--  Guarded through INFORMATION_SCHEMA, same pattern as V12-V15: MySQL has no
--  portable ADD COLUMN IF NOT EXISTS, and this needs to be safe to re-run.

SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_messages' AND COLUMN_NAME = 'offer_booking_id') > 0,
  'DO 0', 'ALTER TABLE direct_messages ADD COLUMN offer_booking_id VARCHAR(36) NULL COMMENT ''Booking this OFFER message renders live, by id''');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;


-- ===========================================================================
-- V17__storefront_payouts.sql
-- ===========================================================================
-- Payout tracking on storefront orders.
--
-- Promoted out of db/manual/2026-08-31_storefront_payouts.sql, which never ran anywhere.
-- Manual files stopped being applied the moment Flyway was wired up, so the ShopOrder
-- entity shipped with three fields the production table did not have and marketplace
-- crash-looped on startup:
--
--   Schema-validation: missing column [payout_status] in table [shop_orders]
--
-- Production runs ddl-auto: validate, so Hibernate refuses to build the SessionFactory at
-- all rather than adding the column itself. One missing column takes down shops, listings,
-- jobs and the leaderboard together, because they share the service.
--
-- WHY EVERY STATEMENT IS GUARDED
-- Flyway guarantees a migration runs once per database, which normally makes a plain ALTER
-- correct. It is not correct here. Flyway was introduced against databases that already had
-- years of schema built by ddl-auto: update, and it was baselined at version 11 — so every
-- environment starts from a different shape. These three columns already exist on the
-- development database (Hibernate added them when ddl-auto was still `update`) and are
-- absent on Railway. An unguarded ALTER would fix production and fail locally with
-- "duplicate column name", leaving a failed migration recorded in flyway_schema_history
-- that blocks every later one until someone repairs it by hand.
--
-- The PREPARE/EXECUTE form is used rather than a stored procedure so no DELIMITER handling
-- is involved: Flyway's MySQL parser sees ordinary statements and nothing else.

-- ── transfer_id: the Stripe Transfer that moved the money to the seller ──────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'transfer_id');
SET @s := IF(@c = 0,
             'ALTER TABLE shop_orders ADD COLUMN transfer_id VARCHAR(255) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── payout_status: HELD until the order completes, then RELEASED ─────────────
-- NOT NULL with a default so existing rows land on HELD rather than NULL, which is the
-- honest starting state: money for an order placed before payouts existed has not been
-- sent to the seller.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'payout_status');
SET @s := IF(@c = 0,
             'ALTER TABLE shop_orders ADD COLUMN payout_status VARCHAR(20) NOT NULL DEFAULT ''HELD''',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── released_at: when the payout actually went out, for reconciliation ───────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'released_at');
SET @s := IF(@c = 0,
             'ALTER TABLE shop_orders ADD COLUMN released_at DATETIME(6) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── The index the payout sweep reads ────────────────────────────────────────
-- The job that releases due payouts filters on (payout_status, status); without this it
-- scans every storefront order the platform has ever taken, on every run.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'shop_orders'
              AND INDEX_NAME = 'idx_shop_orders_payout');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_shop_orders_payout ON shop_orders (payout_status, status)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders'
--      AND COLUMN_NAME IN ('transfer_id','payout_status','released_at');


-- ===========================================================================
-- V18__swap_cash_topup.sql
-- ===========================================================================
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


-- ===========================================================================
-- V19__platform_feedback.sql
-- ===========================================================================
-- What sellers think of HustleSpace, asked when a sale completes.
--
-- Replaces the review the seller used to be forced to leave about the buyer in order to
-- mark a booking complete. That gate collected the wrong thing: the stars on a shop card,
-- the leaderboard and the storefront average all come from the BUYER's review of the
-- SELLER, which the buyer leaves separately. What the gate produced was a seller's opinion
-- of a buyer -- surfaced almost nowhere -- and it produced it by holding the seller's own
-- payout behind an opinion they had no reason to hold.
--
-- Finishing a sale is still a good moment to ask a seller something. It is the point at
-- which they have been all the way round the product: listed, negotiated, shipped, been
-- paid. So they are asked about the product instead of about the buyer.
--
-- Deliberately NOT the reviews table. A review is public, attributed, and moves somebody's
-- rating. This is private to admins, moves nothing, and is honest for exactly that reason:
-- a seller writing "payouts take too long" would not write it if it were going on their
-- shop page.
--
-- booking_id is nullable so the same table can later take feedback that is not tied to a
-- sale -- a prompt from the dashboard, an exit survey -- without another migration.
-- It is a soft reference: a deleted booking must not take the feedback with it, because
-- the score still counts once the transaction it came from is gone.

CREATE TABLE IF NOT EXISTS platform_feedback (
  id           VARCHAR(36)  NOT NULL,
  user_id      VARCHAR(36)  NOT NULL,
  booking_id   VARCHAR(36)  NULL,
  -- Which side they were on when asked. Stored rather than derived from the user, because
  -- somebody who sold today may buy tomorrow, and "what sellers say about us" has to keep
  -- meaning that when the same person shows up in both roles.
  author_role  VARCHAR(16)  NOT NULL DEFAULT 'SELLER',
  rating       INT          NOT NULL,
  improvement  TEXT         NULL,
  created_at   DATETIME(6)  NULL,
  PRIMARY KEY (id),
  -- One answer per person per sale. The client fires this and navigates away, so a retry,
  -- a second device or a reload mid-submit would otherwise leave two answers about the same
  -- order and quietly skew the average.
  UNIQUE KEY uk_platform_feedback_user_booking (user_id, booking_id),
  -- The admin view reads newest-first and nothing else.
  KEY idx_platform_feedback_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify:
--   SELECT COUNT(*) FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platform_feedback';


-- ===========================================================================
-- V20__comment_likes.sql
-- ===========================================================================
-- Likes on comments.
--
-- CommentLike shipped with the comment-threading work and no migration behind it, so
-- hustleup-social failed validation on startup the moment the entity was on the classpath:
--
--   Schema-validation: missing table [comment_likes]
--
-- comments.parent_id, the other half of that feature, was already present — this was the only
-- drift.
--
-- SHAPE
-- The entity uses an @EmbeddedId of (comment_id, user_id), which is the constraint as well as
-- the key: one row per person per comment is what makes a like idempotent, so a double tap
-- cannot count twice. Both are VARCHAR(36) because ids are UUIDs stored as text
-- (preferred_uuid_jdbc_type: VARCHAR), matching every other id column here.
--
-- The index on user_id exists for the reverse lookup — "everything this person liked" —
-- which the composite primary key cannot serve, since it leads on comment_id.
--
-- SAFETY
-- CREATE TABLE IF NOT EXISTS. Nothing is dropped or altered, and re-running is a no-op.

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id  VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NOT NULL,
  created_at  DATETIME(6)  NULL,
  PRIMARY KEY (comment_id, user_id),
  KEY idx_comment_likes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify:
--   SELECT TABLE_NAME FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comment_likes';

-- ── comments.likes_count ────────────────────────────────────────────────────
-- The denormalised counter the comment list reads, so rendering a thread does not mean a
-- COUNT(*) against comment_likes per comment. NOT NULL DEFAULT 0 rather than nullable: every
-- existing comment genuinely has zero likes, and a null would force every reader to decide
-- what that meant.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments'
              AND COLUMN_NAME = 'likes_count');
SET @s := IF(@c = 0,
             'ALTER TABLE comments ADD COLUMN likes_count INT NOT NULL DEFAULT 0',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- ===========================================================================
-- V21__swap_handover_receipts.sql
-- ===========================================================================
-- Handover receipts on swap offers.
--
-- An accepted swap put two parcels in flight and then recorded nothing further: ACCEPTED
-- was the last state, and whether either item actually arrived lived only in the two
-- people's messages. These four columns are where each side confirms its own arrival.
--
-- Deliberately NOT folded into swap_offers.status. That column answers a commercial
-- question (was this trade agreed), and a swap has two arrivals rather than one, so there
-- is no single value it could take that means "delivered" without picking a side. Same
-- separation bookings already draw between booking status and fulfilment status.
--
-- SHAPES
-- *_received_at  DATETIME, null until that side confirms. Null is the normal state, and is
--                what every swap accepted before this feature existed will keep.
-- *_proof_url    VARCHAR(1024), matching @Column(length = 1024) and the width the other
--                media URL columns in this schema use — an S3 key plus a bucket prefix runs
--                well past 255. Holds the raw key; presigning happens on read.
--
-- Guarded like the other migrations here because Flyway was baselined over databases that
-- ddl-auto had already been shaping, so environments differ and this must be re-runnable.

-- ── proposer_received_at ────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'proposer_received_at');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN proposer_received_at DATETIME NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── proposer_proof_url ──────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'proposer_proof_url');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN proposer_proof_url VARCHAR(1024) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── owner_received_at ───────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'owner_received_at');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN owner_received_at DATETIME NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── owner_proof_url ─────────────────────────────────────────────────────────
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'swap_offers'
              AND COLUMN_NAME = 'owner_proof_url');
SET @s := IF(@c = 0,
             'ALTER TABLE swap_offers ADD COLUMN owner_proof_url VARCHAR(1024) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'swap_offers'
--      AND (COLUMN_NAME LIKE '%received_at' OR COLUMN_NAME LIKE '%proof_url');


-- ===========================================================================
-- V22__comment_threading.sql
-- ===========================================================================
-- comments.parent_id and its index — the half of comment threading no migration creates.
--
-- WHY THIS EXISTS
-- The threading work shipped as two migration files with the same version number, V15. One
-- of them collided with V15__ingestion_and_checkout_columns, which production had already
-- applied, and Flyway refuses to resolve a duplicate version at all:
--
--   FlywayException: Found more than one migration with version 15
--
-- That is not a failure of the migration, it is a failure to start: auth, marketplace,
-- notification and subscription all crash-looped on it simultaneously, because every service
-- runs Flyway over this same shared folder.
--
-- The duplicate was deleted, which fixed the crash. But the surviving file
-- (V20__comment_likes) only creates comment_likes and adds comments.likes_count — it notes
-- that parent_id "was already present" and moves on. That was true of the databases that
-- existed at the time, where ddl-auto had added the column years earlier. It is not true of
-- a database built from these migrations alone, which is what a new environment is: there,
-- parent_id and its index simply never get created, and the first startup fails validation
-- on a column nobody can find the migration for.
--
-- So this is not a re-run of the deleted file. It is the part of it that nothing else covers.
--
-- Guarded rather than plain DDL, for the same reason as V17 and V18: Flyway was baselined at
-- 11 over databases already shaped by ddl-auto, so environments genuinely differ. parent_id
-- is present on the development database and absent from a fresh one, and an unguarded ALTER
-- would succeed on one and fail on the other with a recorded failure that blocks every later
-- migration until it is repaired by hand.

-- ── comments.parent_id ──────────────────────────────────────────────────────
-- Null for a top-level comment, the parent's id for a reply. Self-referencing, so no foreign
-- key: a deleted parent must not cascade away the replies underneath it, which are other
-- people's words.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'comments'
              AND COLUMN_NAME = 'parent_id');
SET @s := IF(@c = 0,
             'ALTER TABLE comments ADD COLUMN parent_id VARCHAR(36) NULL',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── the index threads are assembled with ────────────────────────────────────
-- Rendering a thread means "every comment whose parent is this one", once per comment shown.
-- Without this that is a full scan of the comments table per reply rendered.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'comments'
              AND INDEX_NAME = 'idx_comments_parent');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_comments_parent ON comments (parent_id)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id';
--   SELECT INDEX_NAME FROM information_schema.STATISTICS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND INDEX_NAME = 'idx_comments_parent';


-- ===========================================================================
-- V23__recount_social_counters.sql
-- ===========================================================================
-- Recompute the denormalised social counters from the rows they are meant to be counting.
--
-- WHY THEY DRIFTED
-- addComment wrote the post's comments_count and then inserted the comment, as two separate
-- transactions — Spring Data's save() commits on its own, and the counter went first. While
-- comment inserts were failing (a @CreationTimestamp had been orphaned onto an Integer
-- field, so every insert threw), the increment still committed. The counters therefore
-- record how many times someone TRIED to comment, not how many comments exist.
--
-- The like counters share the shape of the bug even though they were never as exposed: a
-- like row and its counter were also two independent commits, so a failure between them
-- leaves the number wrong for good. All three are now written inside one transaction, but
-- that only stops new drift. This corrects what is already stored.
--
-- SAFE TO RE-RUN
-- These are pure recomputations from the join tables, not adjustments — running this twice
-- produces the same numbers as running it once. It is a repair, not a delta.
--
-- The join tables are the source of truth: post_likes and comment_likes each hold one row
-- per (thing, user), and comments holds one row per comment. Nothing here invents a number.

-- ── posts.comments_count ────────────────────────────────────────────────────
UPDATE posts p
SET p.comments_count = (
  SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id
);

-- ── posts.likes_count ───────────────────────────────────────────────────────
UPDATE posts p
SET p.likes_count = (
  SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id
);

-- ── comments.likes_count ────────────────────────────────────────────────────
UPDATE comments c
SET c.likes_count = (
  SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id
);

-- Verify (every row should come back 0):
--   SELECT COUNT(*) FROM posts p
--    WHERE p.comments_count <> (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id);
--   SELECT COUNT(*) FROM posts p
--    WHERE p.likes_count <> (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id);
--   SELECT COUNT(*) FROM comments c
--    WHERE c.likes_count <> (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id);


-- ===========================================================================
-- V24__protection_claims.sql
-- ===========================================================================
-- Buyer protection claims: the record that an order is disputed, and the thing that stops
-- its money releasing while somebody looks at it.
--
-- Money for both bookings and storefront orders is held on the platform's Stripe balance
-- until the buyer confirms receipt or the hold period expires after delivery. The hold
-- protects a buyer who never presses anything, but it is also a deadline — and a buyer whose
-- parcel never arrived should not have to beat a clock to be heard. An OPEN row here stops
-- that clock for the order it names, for as long as the claim stays open.
--
-- ONE TABLE FOR BOTH ORDER KINDS
-- Bookings and shop_orders are separate tables with separate lifecycles, but a claim says the
-- same thing about either. order_type says which side, order_id which row. Soft reference on
-- purpose: no foreign key, because a claim that outlives a deleted order is a record worth
-- keeping rather than a constraint to trip over.
--
-- CREATE TABLE IF NOT EXISTS, like V20's comment_likes: nothing is dropped or altered, and
-- re-running is a no-op. Guarded index creation for the same reason as V18 and V22 — Flyway
-- was baselined over databases ddl-auto had already shaped, so environments genuinely differ.

CREATE TABLE IF NOT EXISTS protection_claims (
  id              VARCHAR(36)  NOT NULL,
  order_type      VARCHAR(20)  NOT NULL COMMENT 'BOOKING or SHOP_ORDER',
  order_id        VARCHAR(36)  NOT NULL,
  buyer_id        VARCHAR(36)  NOT NULL,
  seller_id       VARCHAR(36)  NOT NULL,
  reason          VARCHAR(30)  NOT NULL COMMENT 'NOT_RECEIVED | DAMAGED | NOT_AS_DESCRIBED | OTHER',
  detail          TEXT         NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN | REFUNDED | REJECTED',
  resolution_note TEXT         NULL,
  resolved_by     VARCHAR(36)  NULL,
  resolved_at     DATETIME     NULL,
  created_at      DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── the freeze lookup ───────────────────────────────────────────────────────
-- "Is there an open claim against this order?" runs on every release attempt and on every
-- pass of the hourly payout sweep, once per due order. Without this it is a full scan each
-- time, on the one query standing between a seller and money that is not theirs yet.
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'protection_claims'
              AND INDEX_NAME = 'idx_claim_order');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_claim_order ON protection_claims (order_type, order_id, status)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── the admin queue ─────────────────────────────────────────────────────────
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'protection_claims'
              AND INDEX_NAME = 'idx_claim_status');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_claim_status ON protection_claims (status)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ── a buyer's own claims ────────────────────────────────────────────────────
SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'protection_claims'
              AND INDEX_NAME = 'idx_claim_buyer');
SET @s := IF(@i = 0,
             'CREATE INDEX idx_claim_buyer ON protection_claims (buyer_id)',
             'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Verify:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'protection_claims';


-- ===========================================================================
-- V25__event_capacity_and_sales_window.sql
-- ===========================================================================
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


-- ===========================================================================
-- V26__payout_blocked_notice.sql
-- ===========================================================================
-- Records that a seller has been told their payout is waiting on Connect onboarding.
--
-- RUN THIS BY HAND on every environment, local included — hustleup-marketplace runs
-- ddl-auto: validate, so a missing column stops the service starting.
--
-- WHY
-- A held payout used to be a log line on the server. The seller saw an order they had
-- completed, no money, and no reason given — which is what "there are no payouts even though
-- sellers are completing orders" looks like from the inside. They are now told, once.
--
-- Once is the whole reason this column exists: the sweep revisits every held order every
-- hour, and without somewhere to record that the message went out, a seller who has not
-- finished onboarding would be reminded hourly, forever.
--
-- SAFETY
-- Additive and nullable. Existing held orders have NULL, so each one sends its notice on the
-- next sweep and then stops. Guarded, so re-running is a no-op.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders'
              AND COLUMN_NAME = 'payout_blocked_notified_at');
SET @s := IF(@c = 0,
  'ALTER TABLE shop_orders ADD COLUMN payout_blocked_notified_at DATETIME(6) NULL',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

