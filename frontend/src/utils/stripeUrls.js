const STRIPE_HOSTS = {
  connect: ['connect.stripe.com'],
  checkout: ['checkout.stripe.com'],
  // Stripe documents both Express login-link formats.
  dashboard: ['connect.stripe.com', 'stripe.com'],
};

export function stripeHostedUrl(value, kind = 'connect') {
  const invalid = () => new Error('Stripe did not return a valid secure link. Please try again.');
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || !STRIPE_HOSTS[kind]?.includes(url.hostname)
      || url.port || url.username || url.password
      || (kind === 'dashboard' && !url.pathname.startsWith('/express/'))) {
    throw invalid();
  }
  return url.href;
}
