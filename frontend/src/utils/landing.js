/**
 * Where a signed-in account belongs on arrival.
 *
 * <p>One place, because three callers decide it: the login form, the social sign-in
 * callbacks beside it, and the guard that catches an already-signed-in visitor opening
 * /login. They drifted once already — the guard sent everyone to /feed while login had its
 * own rule — and a landing rule that disagrees with itself is only noticed by whoever it
 * sends to the wrong place.
 *
 * <h3>Admins land on the console</h3>
 * There is no link to /admin anywhere in the app, by design: it is not a destination for
 * the people the navigation is built for. That left the console reachable only by typing
 * the URL, which is a poor thing to rely on in production. An admin signing in is almost
 * always signing in to moderate something, so that is where signing in takes them.
 *
 * <p>This is a redirect, not a restriction — an admin is still a normal user of the app and
 * can navigate anywhere they could before. The console is simply the first screen rather
 * than a URL they have to remember.
 *
 * <h3>Why this keys on the role and not on a set of credentials</h3>
 * "Admin credentials" are whichever account carries {@code role = 'ADMIN'} — the same thing
 * the server checks, in the JWT, on every /api/v1/admin/** request. Matching a specific
 * email or password here instead would put a working credential in the source, give it a
 * second meaning the server does not honour, and break the moment the account is renamed.
 * Promoting or demoting an admin is a role change and nothing else.
 *
 * @param {{role?: string, onboardingCompleted?: boolean}|null|undefined} user
 * @returns {string} a route path
 */
export function landingRoute(user) {
  if (user?.role === 'ADMIN') return '/admin';
  // Onboarding still wins while it is unfinished — that is a step, not a destination.
  //
  // Otherwise the feed, not the dashboard. The dashboard is a workspace for the subset of
  // people who sell something — it answers "what do I owe my customers", which is not a
  // question most people have on opening the app. Landing there meant the first screen
  // after every login was an empty panel with no route into the feed, news or jobs; the
  // feed is the live surface everything else is reachable from.
  return user?.onboardingCompleted ? '/feed' : '/onboarding';
}
