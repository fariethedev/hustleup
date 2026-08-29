/**
 * What to call a person on screen.
 *
 * <h3>Handle first, real name only as a fallback</h3>
 * Every card, story ring, chat header and review byline used to render `fullName`, so the
 * platform showed people's real names to anyone browsing. A handle is what a marketplace
 * profile should lead with: it is the thing `/u/{username}` links to, it is chosen rather
 * than given, and it does not hand a stranger someone's legal name.
 *
 * The fallback is not decoration. Username was optional for most of this project's life —
 * 56 of 73 accounts had none before the backfill — and preferring the handle without a
 * fallback would render those people blank, which is worse than the name they already had.
 * `2026-08-29_backfill_usernames.sql` closes that gap, but a client can still be handed an
 * older cached payload, so the fallback stays.
 *
 * This mirrors `User.displayName()` on the backend. Both exist because names arrive two
 * ways: whole user objects (which carry `username`) and denormalised `*Name` strings the
 * server already resolved. Keep the rule identical in both places or the same person reads
 * differently depending on which endpoint fetched them.
 *
 * @param {{username?: string, fullName?: string, name?: string}|null|undefined} person
 * @returns {string} the handle, else the full name, else a neutral placeholder
 */
export function displayName(person) {
  if (!person) return 'Hustler';
  const handle = typeof person.username === 'string' ? person.username.trim() : '';
  if (handle) return handle;
  // `name` covers the DM/story shapes, where the server sends a single resolved string.
  const real = (person.fullName || person.name || '').trim();
  return real || 'Hustler';
}

/**
 * The same name prefixed with `@`, for places that want to read as a handle.
 *
 * <p>Only prefixes when there is a real handle to prefix — putting `@` in front of a
 * fallback full name would invent a mention that resolves to nothing.
 *
 * @param {{username?: string, fullName?: string, name?: string}|null|undefined} person
 * @returns {string}
 */
export function displayHandle(person) {
  const handle = typeof person?.username === 'string' ? person.username.trim() : '';
  return handle ? `@${handle}` : displayName(person);
}

/**
 * Short form for tight spaces — a greeting, a "X liked your post" line.
 *
 * <p>Where this used to take the first word of a full name ("Francis Mahaso" -> "Francis"),
 * a handle is already short and must not be cut: chopping `anna.k` at the dot gives `anna`,
 * which is a different person's handle. So a handle is returned whole and only a fallback
 * full name is shortened to its first word.
 *
 * @param {{username?: string, fullName?: string, name?: string}|null|undefined} person
 * @returns {string}
 */
export function shortName(person) {
  const handle = typeof person?.username === 'string' ? person.username.trim() : '';
  if (handle) return handle;
  const real = (person?.fullName || person?.name || '').trim();
  return real ? real.split(' ')[0] : 'Hustler';
}
