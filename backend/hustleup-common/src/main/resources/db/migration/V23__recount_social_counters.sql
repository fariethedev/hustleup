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
