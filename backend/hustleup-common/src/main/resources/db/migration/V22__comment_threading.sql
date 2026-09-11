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
