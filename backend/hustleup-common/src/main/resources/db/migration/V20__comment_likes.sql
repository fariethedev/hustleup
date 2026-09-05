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
