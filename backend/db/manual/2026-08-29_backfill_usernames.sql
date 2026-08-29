-- Give every account a username.
--
-- RUN THIS BY HAND on each environment, before or with the deploy that switches display
-- names over to the handle.
--
-- WHY
-- The app now shows a person's username wherever it used to show their full name
-- (User.displayName(), and the frontend helper of the same name). Username was optional
-- for most of this project's life, so most existing accounts have none: 56 of 73 locally
-- at the time of writing. displayName() falls back to the full name so nobody renders
-- blank, but leaving it there means the platform shows real names for old accounts and
-- handles for new ones — the inconsistency looks like a bug, and the accounts that keep
-- showing a real name are exactly the ones that never got to choose.
--
-- HOW THE HANDLE IS DERIVED
-- Same rule as AuthController.deriveUsername(), so a backfilled handle is indistinguishable
-- from one the server would have generated at signup:
--   * take the local part of the email (before the @)
--   * drop anything outside [A-Za-z0-9._]
--   * trim leading/trailing dots and underscores
--   * pad to at least 3 characters, truncate to at most 16
-- Collisions are then resolved by appending a number, lowest free wins.
--
-- SAFETY
-- Only touches rows where username IS NULL or ''. An account that already has a handle is
-- never rewritten — that handle may be in links, mentions and screenshots.
-- Re-runnable: a second run finds nothing left to do.

SET NAMES utf8mb4;

-- ── 1. Seed each empty username from the email local part ───────────────────
-- Uniqueness is not attempted here; step 2 resolves collisions. The temporary value can
-- collide with an existing handle, which is why the unique index on username is added
-- only after step 2 (and is not part of this script).
UPDATE users
   SET username = LEFT(
         GREATEST(
           -- strip to the allowed alphabet, then trim edge dots/underscores
           TRIM(BOTH '.' FROM TRIM(BOTH '_' FROM
             REGEXP_REPLACE(SUBSTRING_INDEX(email, '@', 1), '[^A-Za-z0-9._]', '')
           )),
           ''
         ), 16)
 WHERE username IS NULL OR username = '';

-- Anything that reduced to fewer than 3 characters gets the same "user" prefix the
-- server applies.
UPDATE users
   SET username = CONCAT('user', username)
 WHERE CHAR_LENGTH(username) < 3;

-- ── 2. Resolve collisions ───────────────────────────────────────────────────
-- Oldest account keeps the bare handle; later ones get 2, 3, ... appended, matching the
-- server's "lowest free number wins" behaviour. Compared case-insensitively because the
-- application checks with existsByUsernameIgnoreCase — leaving "Sarah" and "sarah" as
-- distinct rows here would let one impersonate the other.
UPDATE users u
  JOIN (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY created_at, id) AS rn
      FROM users
  ) ranked ON ranked.id = u.id
   SET u.username = CONCAT(u.username, ranked.rn)
 WHERE ranked.rn > 1;

-- ── Verify ──────────────────────────────────────────────────────────────────
--   SELECT COUNT(*) AS still_missing FROM users WHERE username IS NULL OR username = '';
--   SELECT LOWER(username) h, COUNT(*) c FROM users GROUP BY h HAVING c > 1;   -- expect empty
