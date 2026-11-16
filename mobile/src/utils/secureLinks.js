export function stripeUrl(value, kind = 'checkout') {
  const url = new URL(value);
  const hosts = kind === 'checkout' ? ['checkout.stripe.com'] : kind === 'dashboard' ? ['connect.stripe.com', 'stripe.com'] : ['connect.stripe.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.port || url.username || url.password || (kind === 'dashboard' && !url.pathname.startsWith('/express/')))
    throw new Error('A secure Stripe link was not returned. Please retry.');
  return url.toString();
}
