import axios from 'axios';
import { clearStoredSession } from '../utils/session';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Helper for non-React code to trigger toasts
export const dispatchToast = (message, type = 'error') => {
  const event = new CustomEvent('hustleup-toast', { detail: { message, type } });
  window.dispatchEvent(event);
};

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hustleup_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Flattens one error field into a string, or null when there is nothing readable in it.
//
// Every call site reads `err.response?.data?.error || 'fallback'` and renders the result,
// so a nested object in that field reaches React as a child and takes the whole page down
// with "Objects are not valid as a React child". That is not hypothetical: a request that
// misses the gateway entirely is answered by the static host, and Vercel answers an
// unrouted /api/* path with {"error":{"code","message"}}. Normalising here means no call
// site can hit it.
const asMessage = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const nested = value.message ?? value.error ?? value.code;
    return typeof nested === 'string' ? nested : null;
  }
  return null;
};

// Handle 401 — attempt token refresh, then logout. 403 is passed through.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Before anything downstream reads the payload.
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if ('error' in data) data.error = asMessage(data.error);
      if ('message' in data) data.message = asMessage(data.message);
    }

    // Skip toast for auth errors — they'll be handled by redirect/refresh
    if (status !== 401 && status !== 403) {
      const msg = error.response?.data?.message || error.message || "An unexpected error occurred";
      console.error('API Error:', msg);
    }

    // On 401 only. 401 means "we do not know who you are", which a fresh access token can
    // fix; 403 means "we know, and you may not", which it cannot.
    //
    // This used to refresh on both, because the API answered every unauthenticated request
    // with 403 and the two were indistinguishable from here. The cost was real: the dashboard
    // calls seller-only endpoints, so a buyer opening it collected legitimate 403s, each of
    // which forced a token refresh — and a refresh that failed logged them out and bounced
    // them to the login screen. The API now returns 401 for authentication and 403 for
    // authorisation, so this can tell them apart.
    const hasStoredToken = !!localStorage.getItem('hustleup_token') || !!localStorage.getItem('hustleup_refresh');
    if (status === 401 && !original._retry && hasStoredToken) {
      original._retry = true;
      const refreshToken = localStorage.getItem('hustleup_refresh');
      if (refreshToken) {
        try {
          // Raw axios (not the `api` instance) to avoid recursing through this same
          // interceptor — so it needs the absolute base spelled out, since it does not
          // inherit baseURL.
          const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const newToken = res.data.accessToken;
          localStorage.setItem('hustleup_token', newToken);
          // The server now ROTATES the refresh token: the one just sent has been deleted
          // server-side. Failing to store the replacement would leave the stored token
          // pointing at a row that no longer exists, so the next refresh 400s and the user
          // is signed out — worse than the problem rotation was added to fix.
          if (res.data.refreshToken) {
            localStorage.setItem('hustleup_refresh', res.data.refreshToken);
          }
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch {
          // Refresh failed — clear session and redirect to login
          clearStoredSession();
          window.location.href = '/login';
        }
      } else {
        // No refresh token either — clear and redirect
        clearStoredSession();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  verifyEmail: (token) => api.get('/auth/verify', { params: { token } }),
  // Six-digit code flow used by onboarding. The code is matched against this specific
  // address server-side, so the email must be sent alongside it.
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }),
  resendCode: (email) => api.post('/auth/resend-code', { email }),
  usernameAvailable: (username) => api.get('/auth/username-available', { params: { username } }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  // Both send an OAuth access token (implicit flow) — verified server-side against each
  // provider's own userinfo/Graph endpoint, not a signed ID token.
  googleLogin: (accessToken) => api.post('/auth/oauth/google', { accessToken }),
  facebookLogin: (accessToken) => api.post('/auth/oauth/facebook', { accessToken }),
};

// Listings
export const listingsApi = {
  browse: (params) => api.get('/listings', { params }),
  recommended: () => api.get('/listings/recommended'),
  getById: (id) => api.get(`/listings/${id}`),
  create: (formData) =>
    api.post('/listings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, data) => api.patch(`/listings/${id}`, data),
  my: () => api.get('/listings/my'),
  delete: (id) => api.delete(`/listings/${id}`),
  save: (id) => api.post(`/listings/${id}/save`),
  unsave: (id) => api.delete(`/listings/${id}/save`),
  mySaved: () => api.get('/listings/saved/me'),
};

// Seller storefronts. Every field on a shop card and shop page is owned by the seller who
// created it — these endpoints are the only way shops exist, there is no static shop data.
// Reads are public; every write is ownership-checked server-side in ShopController.
export const shopsApi = {
  browse: () => api.get('/shops'),
  // Accepts a UUID or the readable slug.
  getById: (idOrSlug) => api.get(`/shops/${idOrSlug}`),
  // 204 (res.data === '') when the seller hasn't created a shop yet — a normal state.
  mine: () => api.get('/shops/me'),
  create: (data) => api.post('/shops', data),
  update: (id, data) => api.patch(`/shops/${id}`, data),
  remove: (id) => api.delete(`/shops/${id}`),
  /**
   * Buy from a storefront. Creates one order per line and returns a single Stripe
   * Checkout URL covering them all.
   * items: [{ productId, quantity }]
   * → { url, orderIds }
   */
  checkout: (idOrSlug, { items, customer, notes } = {}) =>
    api.post(`/shops/${idOrSlug}/checkout`, { items, customer, notes }),
  // The caller's storefront purchases, and the orders placed with their own shop.
  myOrders: () => api.get('/shops/orders/mine'),
  receivedOrders: () => api.get('/shops/orders/received'),
  updateOrder: (id, status) => api.patch(`/shops/orders/${id}`, { status }),
  /**
   * Seller's delivery update on a storefront order. Only `status` is required; keys you
   * leave out are kept as they were, so adding a tracking number tomorrow doesn't wipe
   * today's note. Every accepted status change notifies the buyer.
   * update: { status, carrier?, trackingNumber?, trackingUrl?, dropoffPoint?,
   *           estimatedDelivery?, note? }
   */
  updateFulfilment: (id, update) => api.patch(`/shops/orders/${id}/fulfilment`, update),
  // Shared by the banner and product photos; returns { url }.
  uploadMedia: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/shops/${id}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  addProduct: (id, data) => api.post(`/shops/${id}/products`, data),
  updateProduct: (id, productId, data) => api.patch(`/shops/${id}/products/${productId}`, data),
  removeProduct: (id, productId) => api.delete(`/shops/${id}/products/${productId}`),
};

// Bookings
export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  // Single booking by id, role-tagged for the caller. Powers the live offer card embedded
  // in a DM thread — the card polls this instead of trusting a point-in-time snapshot.
  getById: (id) => api.get(`/bookings/${id}`),
  counterOffer: (id, counterPrice) =>
    api.patch(`/bookings/${id}/counter`, { counterPrice }),
  accept: (id) => api.patch(`/bookings/${id}/accept`),
  cancel: (id, reason) => api.patch(`/bookings/${id}/cancel`, { reason }),
  // Completing takes no body. It used to require the seller's review of the buyer, which
  // held their own payout behind an opinion they had no reason to hold; they are asked for
  // platform feedback afterwards instead, which gates nothing. See BookingService#complete.
  complete: (id) => api.patch(`/bookings/${id}/complete`),
  my: () => api.get('/bookings/my'),
  // Verifies a Stripe checkout session on the buyer's return and applies the same update
  // the webhook would. The webhook stays the authority; this exists because the buyer's
  // browser cannot wait for it — locally it never arrives at all.
  confirmPayment: (sessionId) => api.post('/bookings/confirm-payment', { sessionId }),
  // Returns a Stripe-hosted checkout URL for the buyer to pay for a BOOKED booking.
  checkoutSession: (id) => api.post(`/bookings/${id}/checkout-session`),
  /**
   * Cart checkout: creates a booking per line and returns ONE Stripe Checkout URL
   * covering all instantly-purchasable items.
   * items: [{ listingId, quantity?, scheduledAt? }]
   * → { url, paidBookingIds, awaitingApproval }
   * `url` is null when every item needs seller approval first.
   */
  cartCheckout: (items) => api.post('/bookings/checkout', { items }),
  // Seller's outstanding sales (INQUIRED / NEGOTIATING / BOOKED) — powers the pending
  // badge and panel. Seller side only; a seller's own purchases are not included.
  pendingSales: () => api.get('/bookings/pending-sales'),
  // Same delivery-update contract as shopsApi.updateFulfilment — one tracker component
  // drives both, because a buyer doesn't care which kind of order they placed.
  updateFulfilment: (id, update) => api.patch(`/bookings/${id}/fulfilment`, update),
};

// Digital event tickets. There is no create() here on purpose — tickets are issued by the
// backend when an EVENT booking is confirmed (instant purchase, or an organiser approving a
// request to join), so the only way to hold one is to actually have a booking.
export const ticketsApi = {
  // Attendee side.
  my: () => api.get('/tickets/my'),
  getById: (id) => api.get(`/tickets/${id}`),
  forEventMine: (listingId) => api.get(`/tickets/event/${listingId}/mine`),
  // Self-admission, for events run without anyone on a door.
  checkInSelf: (id) => api.post(`/tickets/${id}/check-in`),

  // Organiser side — all of these 403 unless you own the event.
  forEvent: (listingId) => api.get(`/tickets/event/${listingId}`),
  doorSummary: (listingId) => api.get(`/tickets/event/${listingId}/summary`),
  // `code` is either a scanned QR payload (HUTKT:…) or an admission code typed by hand.
  // Ordinary rejections come back as 200 with admitted:false, not as an error.
  scan: (listingId, code) => api.post(`/tickets/event/${listingId}/scan`, { code }),
};

// Seller payout accounts (Stripe Connect). Sellers connect a bank account once via
// Stripe's own hosted onboarding form — HustleSpace never sees or stores the actual bank
// details, only the resulting account status.
export const payoutsApi = {
  status: () => api.get('/payouts/status'),
  connect: () => api.post('/payouts/connect'),
};

// Seller-defined booking slots — HAIR_BEAUTY/SKILL listings let buyers book a specific
// open slot instead of negotiating a schedule freely.
export const availabilityApi = {
  create: (listingId, startTime, endTime) => api.post('/availability', { listingId, startTime, endTime }),
  listByListing: (listingId) => api.get(`/availability/listing/${listingId}`),
  my: () => api.get('/availability/my'),
  remove: (id) => api.delete(`/availability/${id}`),
};

// Messages
export const messagesApi = {
  getHistory: (bookingId) => api.get(`/messages/${bookingId}`)
};

export const directMessagesApi = {
  getPartners: () => api.get('/direct-messages/partners'),
  // Total messages received but not opened, across all conversations → { count }.
  // Cheap enough for the navbar to poll from any page.
  unreadCount: () => api.get('/direct-messages/unread-count'),
  // Note: fetching a conversation also marks it read server-side — opening the
  // chat IS the read signal, so there's no separate "mark read" call.
  getConversation: (partnerId) => api.get(`/direct-messages/${partnerId}`),
  sendMessage: (partnerId, content, type = 'TEXT') => api.post(`/direct-messages/${partnerId}`, { content, type }),
  sendImage: (partnerId, file, caption = '') => {
    const formData = new FormData();
    formData.append('image', file);
    if (caption) formData.append('caption', caption);
    return api.post(`/direct-messages/${partnerId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // In-app share: sends a rich listing card (not a text link) into the DM thread.
  shareListing: (partnerId, listing, message = '') => api.post(`/direct-messages/${partnerId}`, {
    content: message,
    type: 'LISTING',
    listingId: listing.id,
    listingTitle: listing.title,
    listingPrice: listing.price != null ? String(listing.price) : '',
    listingCurrency: listing.currency || 'PLN',
    listingImage: listing.mediaUrls?.[0] || listing.image || '',
  }),
  // In-app share: sends a rich feed-post card into the DM thread.
  sharePost: (partnerId, post, message = '') => api.post(`/direct-messages/${partnerId}`, {
    content: message,
    type: 'POST',
    postId: post.id,
    postContent: post.content || '',
    postImage: post.media?.[0]?.url || post.imageUrl || '',
    postAuthorName: post.authorName || '',
    postAuthorAvatar: post.authorAvatarUrl || post.authorAvatar || '',
    postAuthorId: post.authorId || '',
  }),
  // In-app share: sends a story card into the DM thread. The media URL and author are
  // snapshotted server-side, so the card still renders after the story expires in 24h.
  shareStory: (partnerId, story, message = '') => api.post(`/direct-messages/${partnerId}`, {
    content: message,
    type: 'STORY',
    storyId: story.id,
    storyImage: story.mediaUrl || '',
    storyType: story.type || 'IMAGE',
    storyAuthorName: story.authorName || '',
    storyAuthorId: story.authorId || '',
  }),
  // Whether this conversation started from a mutual Bond match — used to show the heart
  // badge for partners with zero messages yet (the /partners list only covers people
  // you've already exchanged at least one message with).
  checkBondMatch: (partnerId) => api.get(`/direct-messages/${partnerId}/bond-match`),
  // In-app share: sends a live price-offer card into the DM thread, referencing a Booking
  // by id rather than snapshotting its price/status (which keep changing as the two sides
  // negotiate). bookingId must already exist — create it with bookingsApi.create first.
  sendOffer: (partnerId, bookingId, message = '') => api.post(`/direct-messages/${partnerId}`, {
    content: message,
    type: 'OFFER',
    bookingId,
  }),
};

// Reviews
export const reviewsApi = {
  create: (data) => api.post('/reviews', data),
  getForUser: (userId) => api.get(`/reviews/user/${userId}`),
};

/**
 * How the platform itself is doing, in the words of the people selling on it.
 *
 * Not a review: a review is public, attributed to a person and moves somebody's rating.
 * This is private to admins and moves nothing, which is what makes it worth reading.
 */
export const feedbackApi = {
  /** @param {{rating: number, improvement?: string, bookingId?: string, authorRole?: string}} data */
  submit: (data) => api.post('/feedback', data),
  /** Admin only. */
  all: () => api.get('/feedback'),
};

// Notifications
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// Users
export const usersApi = {
  getAll: () => api.get('/users'),
  getProfile: (id) => api.get(`/users/${id}/profile`),
  // PATCH /users/me only accepts JSON (partial UserDto). Images go through
  // the dedicated multipart endpoints below (form field must be named "file").
  updateProfile: (data) => api.patch('/users/me', data),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.patch('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadBanner: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.patch('/users/me/banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Feed
export const feedApi = {
  getAll: () => api.get('/feed'),
  // FormData fields: content, media[], anonymous, linkedListingId?, communityId?.
  // communityId posts into a community instead of the open feed; the server refuses it
  // unless you have joined that community.
  createPost: (formData) => api.post('/feed', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  /**
   * A post's comments, threaded one level: each top-level comment carries a `replies`
   * array. Also returns likesCount and likedByCurrentUser per comment, so the client does
   * not need a request per row to draw a filled heart.
   */
  getComments: (postId) => api.get(`/feed/${postId}/comments`),
  /** `parentId` makes it a reply; omit it for a top-level comment. */
  addComment: (postId, content, parentId) =>
    api.post(`/feed/${postId}/comments`, parentId ? { content, parentId } : { content }),
  likeComment: (postId, commentId) => api.post(`/feed/${postId}/comments/${commentId}/likes`),
  unlikeComment: (postId, commentId) => api.delete(`/feed/${postId}/comments/${commentId}/likes`),
  likePost: (postId) => api.post(`/feed/${postId}/likes`),
  unlikePost: (postId) => api.delete(`/feed/${postId}/likes`),
  getLikers: (postId) => api.get(`/feed/${postId}/likes`),
  myLiked: () => api.get('/feed/liked/me'),
  // Posts a seller has linked to one of their listings (e.g. announcements about an EVENT).
  getByListing: (listingId) => api.get(`/feed/listing/${listingId}`),
  savePost: (postId) => api.post(`/feed/${postId}/save`),
  unsavePost: (postId) => api.delete(`/feed/${postId}/save`),
  mySaved: () => api.get('/feed/saved/me'),
  /**
   * Every post by one author, newest first.
   *
   * The profile page used to pull the whole feed and filter it by author in the browser,
   * so it only ever showed posts that happened to be in the page already loaded. This
   * queries by author, so older posts appear too.
   */
  getByAuthor: (userId) => api.get(`/feed/user/${userId}`),
  /** Edit your own post's text. Media is fixed once published. */
  updatePost: (postId, content) => api.patch(`/feed/${postId}`, { content }),
  /** Delete your own post, along with its likes, comments and saves. */
  deletePost: (postId) => api.delete(`/feed/${postId}`),
  /** Posts from the people you follow. Empty when you follow nobody — never a fallback. */
  following: () => api.get('/feed/following'),
  /** Posts from every community you've joined. */
  communities: () => api.get('/feed/communities'),
  /** One community's own feed, by id or slug. Public. */
  byCommunity: (idOrSlug) => api.get(`/feed/community/${idOrSlug}`),
  /**
   * Share someone's post onto your own timeline, optionally with your own words above it.
   * Creates a real post that quotes the original, so it can be liked and replied to on its
   * own terms. Idempotent — reposting twice returns the share you already made.
   */
  repost: (postId, comment = '') => api.post(`/feed/${postId}/repost`, { comment }),
  /** Undo your repost. Removes your share; the original is untouched. */
  undoRepost: (postId) => api.delete(`/feed/${postId}/repost`),
};

/**
 * Member-created communities — "Cars in Lublin", "Warsaw street food".
 *
 * A community is a group with a membership, not a hashtag: joining is what puts its posts
 * in your Communities feed, and posting into one you haven't joined is refused server-side.
 */
export const communitiesApi = {
  browse: () => api.get('/communities'),
  mine: () => api.get('/communities/mine'),
  getById: (idOrSlug) => api.get(`/communities/${idOrSlug}`),
  members: (idOrSlug) => api.get(`/communities/${idOrSlug}/members`),
  /** Multipart so the banner uploads with the community rather than needing a second call. */
  create: ({ name, description, city, category, image }) => {
    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    if (city) formData.append('city', city);
    if (category) formData.append('category', category);
    if (image) formData.append('image', image);
    return api.post('/communities', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  join: (idOrSlug) => api.post(`/communities/${idOrSlug}/join`),
  leave: (idOrSlug) => api.delete(`/communities/${idOrSlug}/join`),
  remove: (idOrSlug) => api.delete(`/communities/${idOrSlug}`),
};

// Social graph: follow/unfollow, relationship summary, block, report.
// These live in the social service under /follows (NOT /users — the old
// usersApi.followUser endpoints never existed on the backend).
export const followsApi = {
  follow: (userId) => api.post(`/follows/${userId}`),
  unfollow: (userId) => api.delete(`/follows/${userId}`),
  relationship: (userId) => api.get(`/follows/${userId}/relationship`),
  // { followers, following } for ANY user — used to show follower counts on creator cards.
  counts: (userId) => api.get(`/follows/${userId}/counts`),
  block: (userId) => api.post(`/follows/${userId}/block`),
  unblock: (userId) => api.delete(`/follows/${userId}/block`),
  report: (userId, reason) => api.post(`/follows/${userId}/report`, { reason }),
};

// Dating — the swipe deck behind Hustle Bond.
export const datingApi = {
  getProfiles: () => api.get('/dating/profiles'),
  getMyProfile: () => api.get('/dating/profile/me'),
  saveProfile: (formData) => api.post('/dating/profile', formData),
  // A super like is the same right swipe with `superLike` set: it notifies the
  // recipient immediately instead of staying private until the like is mutual.
  like: (profileId, superLike = false) =>
    api.post(`/dating/like/${profileId}`, null, { params: { superLike } }),
  pass: (profileId) => api.post(`/dating/pass/${profileId}`),
  // Undoes the last swipe and returns the profile to put back on the deck.
  // Resolves with { rewound: false, reason } when there is nothing to undo.
  rewind: () => api.post('/dating/rewind'),
};

// Subscriptions
export const subscriptionsApi = {
  my: () => api.get('/subscriptions/my'),
  /** Price list, served by the backend so the UI never hardcodes an amount. */
  plans: () => api.get('/subscriptions/plans'),
  /**
   * Starts a paid upgrade and returns { checkoutUrl } to redirect the buyer to.
   *
   * This replaced `upgrade()`, which called an endpoint that granted Premium outright
   * with no payment. Premium is now granted only by Stripe's signed webhook, after the
   * money clears — so the caller must send the buyer to `checkoutUrl` and wait.
   *
   * @param {'MONTHLY'|'QUARTERLY'|'ANNUAL'} plan
   */
  checkout: (plan) => api.post('/subscriptions/checkout', { plan }),
  /**
   * Honours a checkout the buyer has just returned from, and activates Premium.
   *
   * The webhook is still the authority when it arrives, but it only arrives if it has been
   * registered in Stripe and can reach the server. This is driven by the buyer's own browser,
   * so the payment is honoured in any environment Stripe can redirect back to. Safe to call
   * more than once — the grant is keyed on the session id.
   *
   * → { premiumActive, message }
   */
  confirm: (sessionId) => api.post('/subscriptions/confirm', { sessionId }),
};

// Stories
export const storiesApi = {
  getAll: () => api.get('/stories'),
  create: (formData) => api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/stories/${id}`),
  like: (id) => api.post(`/stories/${id}/likes`),
  unlike: (id) => api.delete(`/stories/${id}/likes`),
  view: (id) => api.post(`/stories/${id}/views`),
  // Who watched this story, newest first. Author-only server-side — a non-author
  // gets 403, so callers should only render this for the current user's own stories.
  viewers: (id) => api.get(`/stories/${id}/views`),
};

// Swap & Top — barter offers against listings, optionally with cash on top in either
// direction (create() takes cashAmount + cashDirection: PROPOSER_PAYS | OWNER_PAYS).
// A swap is a negotiation whose counter-offer
// is a listing (or a described skill) instead of a number.
export const swapsApi = {
  // { targetListingId, offeredListingId? | offeredText?, message? }
  create: (data) => api.post('/swaps', data),
  incoming: () => api.get('/swaps/incoming'),
  outgoing: () => api.get('/swaps/outgoing'),
  forListing: (listingId) => api.get(`/swaps/listing/${listingId}`),
  // Public: the recent accepted trades rendered as the swap chain.
  chain: (limit = 12) => api.get('/swaps/chain', { params: { limit } }),
  accept: (id) => api.patch(`/swaps/${id}/accept`),
  decline: (id) => api.patch(`/swaps/${id}/decline`),
  withdraw: (id) => api.patch(`/swaps/${id}/withdraw`),
  // Either side of an accepted swap confirming the other's item turned up. The photo/video
  // is required, not decoration: a swap has no payment leg behind it, so this upload is the
  // only record of what actually arrived if the two of them later disagree.
  confirmReceipt: (id, proof) => {
    const formData = new FormData();
    formData.append('proof', proof);
    return api.post(`/swaps/${id}/received`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Hustle Score + leaderboards. Reads are public so social proof works for logged-out
// visitors too.
export const leaderboardApi = {
  // metric: 'sales' | 'earnings' | 'score'; window: 'all' | 'week' | 'month'
  board: (metric = 'sales', window = 'all', limit = 20) =>
    api.get('/leaderboard', { params: { metric, window, limit } }),
  myScore: () => api.get('/leaderboard/me'),
  scoreFor: (userId) => api.get(`/leaderboard/user/${userId}`),
};

// ── Publishers ──────────────────────────────────────────────────────────────
// Becoming a verified hiring company (may post jobs) or news outlet (may publish
// articles). Applications are reviewed by an admin; only APPROVED grants posting.
export const publishersApi = {
  /**
   * Apply for verification. `data` is a plain object; it is packed into FormData here
   * because the logo and supporting document upload with the form.
   * Fields: type ('HIRING_COMPANY' | 'NEWS_OUTLET'), companyName, registrationNumber,
   * website, description, contactEmail, contactPhone, logo (File), document (File).
   */
  apply: (data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v);
    });
    return api.post('/publishers/apply', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // My applications + { canPostJobs, canPostNews, isAdmin }. The UI reads the booleans
  // rather than re-deriving the rule client-side, so it can never drift from the server.
  me: () => api.get('/publishers/me'),
  // Public directory of verified publishers of one type.
  directory: (type) => api.get('/publishers', { params: { type } }),
};

// ── Jobs & Gigs ─────────────────────────────────────────────────────────────
export const jobsApi = {
  board: (params = {}) => api.get('/jobs', { params }),
  one: (id) => api.get(`/jobs/${id}`),
  mine: () => api.get('/jobs/mine'),
  /** Post an advert. `data.media` may be a File[]; everything else is scalar. */
  create: (data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (k === 'media' && Array.isArray(v)) v.forEach((f) => fd.append('media', f));
      else fd.append(k, v);
    });
    return api.post('/jobs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setStatus: (id, status) => api.patch(`/jobs/${id}/status`, { status }),
  apply: (id, { message, attachment } = {}) => {
    const fd = new FormData();
    if (message) fd.append('message', message);
    if (attachment) fd.append('attachment', attachment);
    return api.post(`/jobs/${id}/apply`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Applicants on one of my adverts (owner only).
  applications: (id) => api.get(`/jobs/${id}/applications`),
  myApplications: () => api.get('/jobs/applications/mine'),
  updateApplication: (applicationId, status) =>
    api.patch(`/jobs/applications/${applicationId}`, { status }),
};

// ── News ────────────────────────────────────────────────────────────────────
export const newsApi = {
  feed: (params = {}) => api.get('/news', { params }),
  one: (id) => api.get(`/news/${id}`),
  mine: () => api.get('/news/mine'),
  /** Publish an article. `data.coverImage` is a File; `data.media` may be a File[]. */
  create: (data) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (k === 'media' && Array.isArray(v)) v.forEach((f) => fd.append('media', f));
      else fd.append(k, v);
    });
    return api.post('/news', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  setStatus: (id, status) => api.patch(`/news/${id}/status`, { status }),
};

// ── Admin console ───────────────────────────────────────────────────────────
// Every call here requires ROLE_ADMIN; the gateway splits these across the auth and
// marketplace services, but that is invisible from the client.
export const adminApi = {
  stats: () => api.get('/admin/stats'),
  marketplaceStats: () => api.get('/admin/marketplace-stats'),
  // status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ALL'
  publishers: (status = 'PENDING') => api.get('/admin/publishers', { params: { status } }),
  decide: (id, status, note) => api.patch(`/admin/publishers/${id}/decision`, { status, note }),
  users: (q = '') => api.get('/admin/users', { params: { q } }),
  user: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, patch) => api.patch(`/admin/users/${id}`, patch),
  orders: (params = {}) => api.get('/admin/orders', { params }),
  fixOrder: (id, patch) => api.patch(`/admin/orders/${id}`, patch),
  jobs: () => api.get('/admin/jobs'),
};

export default api;
