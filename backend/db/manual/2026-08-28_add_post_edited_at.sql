-- ============================================================================
--  MIGRATION — adds posts.edited_at, backing Post.editedAt.
--  Already applied to the Railway production database on 2026-08-28.
-- ============================================================================
--
-- WHY THIS FILE EXISTS
-- The column supports the post edit feature: PATCH /api/v1/feed/{postId} stamps
-- it so the UI can mark a post as edited rather than silently presenting changed
-- text as the original.
--
-- It is recorded here because of how it reached production. The services run
-- with spring.jpa.hibernate.ddl-auto=validate, so deploying the new entity field
-- crashed hustleup-social on startup:
--
--     Schema-validation: missing column [edited_at] in table [posts]
--
-- The fix was to flip that service to ddl-auto=update, let Hibernate add the
-- column, then set it back to validate. That works but is not repeatable: any
-- other database — a colleague's laptop, a staging environment, a restored
-- backup — has no column and the service will not boot against it. Running this
-- brings such a database into line without going near ddl-auto.
--
-- THE REAL FIX
-- Adding Flyway to hustleup-common would make this automatic and ordered, rather
-- than a directory of files someone has to remember to run. Worth doing before
-- the next entity change: this is the second schema drift incident, and both
-- presented as a service that simply would not start.
--
-- Safe to re-run: the IF NOT EXISTS guard makes it a no-op on a database that
-- already has the column.

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS edited_at DATETIME(6) NULL
    COMMENT 'When the author last edited the text; NULL means never edited';

-- Verify:
--   SHOW COLUMNS FROM posts LIKE 'edited_at';
-- Existing rows keep NULL, which reads correctly as "never edited" — the API
-- and the UI both treat a null as an unedited post.
