/**
 * Every notification type the backend sends, with an icon, a filter group, a hint of what a
 * tap does, and where it goes. Unknown types still render (as "Update") and open nothing.
 */
/** Opens Orders focused on one booking (the notification's reference), or just the tab. */
const toBooking = (n, view) => n.referenceId
  ? { pathname: '/profile/orders', params: { bookingId: String(n.referenceId) } }
  : view ? { pathname: '/profile/orders', params: { view } } : '/profile/orders';

export const TYPES = {
  DIRECT_MESSAGE: { icon: 'message-circle', color: '#8B5CF6', group: 'messages', hint: 'Open chat', go: n => ({ pathname: '/(tabs)/messages', params: { partnerId: n.referenceId } }) },
  DATING_MATCH: { icon: 'heart', color: '#F472B6', group: 'bond', hint: 'Say hi to your match', go: n => ({ pathname: '/(tabs)/messages', params: { partnerId: n.referenceId } }) },
  DATING_SUPER_LIKE: { icon: 'star', color: '#38BDF8', group: 'bond', hint: 'See who likes you', go: () => '/bond' },
  FOLLOW: { icon: 'user-plus', color: '#60A5FA', group: 'social', hint: 'View profile', go: n => `/profile/${n.referenceId}` },
  FOLLOW_REQUEST: { icon: 'user-check', color: '#60A5FA', group: 'social', hint: 'Review request', go: () => '/profile/settings' },
  POST: { icon: 'image', color: '#A3E635', group: 'social', hint: 'Open feed', go: () => '/(tabs)/feed' },
  REPOST: { icon: 'repeat', color: '#A3E635', group: 'social', hint: 'Open feed', go: () => '/(tabs)/feed' },
  LISTING: { icon: 'tag', color: '#34D399', group: 'orders', hint: 'View listing', go: n => ({ pathname: '/listing/[id]', params: { id: n.referenceId } }) },
  BOOKING: { icon: 'package', color: '#CDFF00', group: 'orders', hint: 'Open the booking', go: n => toBooking(n) },
  BOOKING_REQUEST: { icon: 'inbox', color: '#CDFF00', group: 'orders', hint: 'Reply to the request', go: n => toBooking(n, 'selling') },
  BOOKING_ACCEPTED: { icon: 'check-circle', color: '#22C55E', group: 'orders', hint: 'Pay to confirm', go: n => toBooking(n) },
  BOOKING_COUNTER: { icon: 'refresh-cw', color: '#F59E0B', group: 'orders', hint: 'Respond to the counter offer', go: n => toBooking(n) },
  OFFER: { icon: 'tag', color: '#F59E0B', group: 'orders', hint: 'Open the offer', go: n => toBooking(n) },
  ORDER: { icon: 'shopping-bag', color: '#CDFF00', group: 'orders', hint: 'Track your order', go: () => '/profile/orders' },
  APPOINTMENT: { icon: 'calendar', color: '#38BDF8', group: 'orders', hint: 'View appointment', go: () => '/dashboard' },
  PAYOUT: { icon: 'credit-card', color: '#22C55E', group: 'orders', hint: 'View payouts', go: () => '/profile/wallet' },
  PROTECTION_CLAIM: { icon: 'shield', color: '#EF4444', group: 'orders', hint: 'View the claim', go: () => '/profile/orders' },
};
export const FALLBACK = { icon: 'bell', color: '#9CA3AF', group: 'other', hint: '', go: null };

/** Display + routing info for a notification or a push payload ({ type, referenceId }). */
export const typeOf = n => TYPES[(n?.notificationType || n?.type || '').toUpperCase()] || FALLBACK;

/** Where tapping this notification should go, or null when it has no destination. */
export const notificationTarget = n => typeOf(n).go?.(n) || null;
