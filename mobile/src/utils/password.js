/**
 * The password rules, in one place.
 *
 * <h3>Why this is a module and not a regex at each call site</h3>
 * The policy previously existed as three separate copies of the same regex — one in
 * `AuthDtos`, one in `AuthController`, one inline in `Register.jsx` — which is three things
 * to remember to change and two chances to forget. The two Java copies still have to be kept
 * in step by hand, but everything the client does now reads from here.
 *
 * <h3>Why rules are a list rather than one pattern</h3>
 * A single regex can only answer pass or fail. A signup form that says "password must be at
 * least 10 characters and include an uppercase letter, a lowercase letter, a number and a
 * symbol" after you press submit is telling you the rules at the exact moment they stopped
 * being useful. Broken into named checks, the form can show which ones you have already met
 * while you type, so the requirement arrives before the mistake rather than after it.
 */

/** Minimum length. Raised from 8: eight is a decade out of date for an account holding money. */
export const MIN_LENGTH = 10;

/**
 * Each rule is checked independently so the UI can tick them off live.
 *
 * <p>Ordered the way a password is usually built — length first, because it is the one that
 * actually matters most and the one people under-do.
 */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `At least ${MIN_LENGTH} characters`,
    test: (value) => value.length >= MIN_LENGTH,
  },
  {
    id: 'lower',
    label: 'A lowercase letter',
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: 'upper',
    label: 'An uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: 'digit',
    label: 'A number',
    test: (value) => /\d/.test(value),
  },
  {
    id: 'symbol',
    // Newly required. The old policy deliberately left symbols out on the grounds that they
    // push people toward "Password1!" — true, but the answer to a predictable pattern is not
    // to drop the character class, it is to also reject the predictable passwords, which the
    // common-password check below now does.
    label: 'A symbol (!@#$…)',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

/**
 * Passwords that satisfy every rule above and are still worthless.
 *
 * <p>A character-class policy cannot tell "Password1!" from a real password — it meets every
 * requirement and is among the first things anyone tries. Compared case-insensitively and
 * against the whole value, so this rejects the exact strings rather than any password that
 * happens to contain "abc".
 */
const COMMON = new Set([
  'password1!', 'password123', 'password1234', 'passw0rd123', 'qwerty12345',
  'welcome123!', 'admin12345', 'letmein123!', 'iloveyou123', 'hustleup123',
]);

/** True when the value is one of the obvious ones. */
export function isCommonPassword(value) {
  return COMMON.has(String(value || '').trim().toLowerCase());
}

/** Which rules the value currently satisfies, as an id → boolean map. */
export function checkRules(value) {
  const password = String(value || '');
  return Object.fromEntries(PASSWORD_RULES.map((rule) => [rule.id, rule.test(password)]));
}

/** Whether the value is acceptable — every rule met, and not an obvious one. */
export function isValidPassword(value) {
  const password = String(value || '');
  return PASSWORD_RULES.every((rule) => rule.test(password)) && !isCommonPassword(password);
}

/**
 * A 0–4 strength score, for the meter.
 *
 * <p>Deliberately not just "how many rules passed". Meeting the five minimums is the floor,
 * not a strong password, so the bar only reaches the top when the password is meaningfully
 * longer than the minimum — otherwise a ten-character password scores full marks and tells
 * the user they are done when they have only just started.
 *
 * @returns {{score: number, label: string, tone: string}}
 */
export function passwordStrength(value) {
  const password = String(value || '');
  if (!password) return { score: 0, label: '', tone: 'idle' };

  if (isCommonPassword(password)) {
    return { score: 1, label: 'Too common', tone: 'weak' };
  }

  const met = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  if (met < PASSWORD_RULES.length) {
    // Still missing a requirement. Cap at 2 so the meter never looks encouraging while the
    // form would still reject it.
    return { score: met >= 3 ? 2 : 1, label: met >= 3 ? 'Getting there' : 'Weak', tone: 'weak' };
  }

  // Every rule met. Length is what separates fine from good from here on.
  if (password.length >= 16) return { score: 4, label: 'Excellent', tone: 'excellent' };
  if (password.length >= 13) return { score: 3, label: 'Strong', tone: 'strong' };
  return { score: 3, label: 'Good', tone: 'good' };
}

/**
 * The sentence to show when a password is rejected on submit.
 *
 * <p>Names the specific failure rather than reciting the whole policy: someone who is only
 * missing a symbol does not need to be told about uppercase letters again.
 */
export function passwordError(value) {
  const password = String(value || '');
  if (!password) return 'Choose a password.';
  if (isCommonPassword(password)) {
    return 'That password is too common — pick something less guessable.';
  }
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password));
  if (missing.length === 0) return null;
  if (missing.length === 1) return `Your password still needs: ${missing[0].label.toLowerCase()}.`;
  return `Your password still needs: ${missing.map((r) => r.label.toLowerCase()).join(', ')}.`;
}
