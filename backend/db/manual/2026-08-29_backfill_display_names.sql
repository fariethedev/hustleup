-- Re-point the denormalised author names at the user's handle.
--
-- RUN THIS BY HAND, after 2026-08-29_backfill_usernames.sql (it depends on every account
-- having a handle) and with the deploy that switches display names over.
--
-- WHY THIS IS NEEDED SEPARATELY
-- Most name fields are resolved per request from the users table, so
-- User.displayName() fixed them the moment it shipped: listing sellerName, shop ownerName,
-- review reviewerName, leaderboard userName, DM sender names.
--
-- Posts, comments and stories are different. They copy the author's name into their own row
-- when the row is written, so the controller change only affects content created from now
-- on. Without this, the feed shows handles for new posts and real names for old ones — the
-- exact half-migrated look that reads as a bug.
--
-- THE STALENESS THIS DOES NOT FIX
-- A stored copy is wrong by design: change your handle tomorrow and every post you have
-- ever written still carries the old one. The real fix is to resolve the name at read time
-- like the other surfaces do, and drop these columns. That is a bigger change than this
-- one, and it is worth doing — treat this backfill as buying time, not as the answer.
--
-- SAFETY
-- Only rewrites rows whose author still exists and now has a handle. An author_name whose
-- author_id no longer resolves is left exactly as it is: it is the only record of who wrote
-- that post. Re-runnable; a second run rewrites the same values.

SET NAMES utf8mb4;

-- ── Posts ───────────────────────────────────────────────────────────────────
-- Anonymous posts are skipped: their author_name is a deliberate pseudonym, not a copy of
-- the user's name, and overwriting it would unmask the author.
UPDATE posts p
  JOIN users u ON u.id = p.author_id
   SET p.author_name = u.username
 WHERE u.username IS NOT NULL AND u.username <> ''
   AND (p.anonymous IS NULL OR p.anonymous = 0);

-- ── Comments ────────────────────────────────────────────────────────────────
UPDATE comments c
  JOIN users u ON u.id = c.author_id
   SET c.author_name = u.username
 WHERE u.username IS NOT NULL AND u.username <> '';

-- ── Stories ─────────────────────────────────────────────────────────────────
UPDATE stories s
  JOIN users u ON u.id = s.author_id
   SET s.author_name = u.username
 WHERE u.username IS NOT NULL AND u.username <> '';

-- ── Shared post/story cards inside direct messages ──────────────────────────
-- These snapshot the original author's name so a shared card still renders after the
-- source is deleted. Same treatment, same reason.
UPDATE direct_messages dm
  JOIN posts p ON p.id = dm.shared_post_id
   SET dm.shared_post_author_name = p.author_name
 WHERE dm.shared_post_id IS NOT NULL;

UPDATE direct_messages dm
  JOIN stories s ON s.id = dm.shared_story_id
   SET dm.shared_story_author_name = s.author_name
 WHERE dm.shared_story_id IS NOT NULL;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   SELECT p.author_name, u.username, u.full_name
--     FROM posts p JOIN users u ON u.id = p.author_id
--    WHERE p.author_name <> u.username;      -- expect only anonymous posts
