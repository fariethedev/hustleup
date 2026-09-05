-- ============================================================================
--  V15 — likes on comments.
-- ============================================================================
--
--  Replies needed no schema: comments.parent_id already exists and the POST
--  endpoint already stored it. What was missing was the assembly and the UI —
--  the API returned a flat list, so a reply rendered as a top-level comment.
--
--  Likes are new. Same shape as post_likes: the composite (comment_id, user_id)
--  key IS the fact, so liking twice is impossible in the database rather than
--  depending on a check-then-insert two concurrent taps can both pass.
--
--  Guarded through INFORMATION_SCHEMA like V12-V14: MySQL has no ADD COLUMN IF
--  NOT EXISTS, and a laptop that ran ddl-auto=update may already have both.

CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id VARCHAR(36) NOT NULL,
    user_id    VARCHAR(36) NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (comment_id, user_id),
    -- "Which of these comments did I like?" is asked once per thread load with the
    -- viewer's id and a list of comment ids; without this it scans the table.
    KEY idx_comment_likes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Denormalised counter, mirroring posts.likes_count. NOT NULL DEFAULT 0 so existing
-- comments read as zero rather than null, which the entity would otherwise have to
-- defend against on every read.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'likes_count') > 0,
  'DO 0', 'ALTER TABLE comments ADD COLUMN likes_count INT NOT NULL DEFAULT 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- parent_id is expected to exist already — the entity maps it and the services run with
-- ddl-auto=validate, so social could not be starting without it. Added here anyway for a
-- database built from migrations alone, where nothing else would create it.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND COLUMN_NAME = 'parent_id') > 0,
  'DO 0', 'ALTER TABLE comments ADD COLUMN parent_id VARCHAR(36) NULL');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Threads are assembled by filtering on parent_id, so it is indexed.
SET @ddl = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comments' AND INDEX_NAME = 'idx_comments_parent') > 0,
  'DO 0', 'CREATE INDEX idx_comments_parent ON comments (parent_id)');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
