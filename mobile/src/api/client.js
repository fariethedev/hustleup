import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = '8000';
const API_PATH = '/api/v1';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const withApiPath = (baseUrl) => {
  const normalized = trimTrailingSlash(baseUrl);
  if (normalized.endsWith(API_PATH)) return normalized;
  return `${normalized}${API_PATH}`;
};

const getHostFromExpo = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== 'string') return null;
  return hostUri.split(':')[0];
};

const getConfiguredBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiBaseUrl;
  if (!configured || typeof configured !== 'string') return null;
  return withApiPath(configured);
};

// A home/office Wi-Fi address (10.x, 192.168.x, 172.16–31.x). These change whenever the laptop
// switches network, so a value pinned in .env.local goes stale and every request then hangs.
const isPrivateLan = (url) => /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);

const resolveApiUrl = () => {
  const configured = getConfiguredBaseUrl();
  // A real (public / https) API address always wins. A pinned LAN address only wins outside
  // development; in dev the live address Expo is serving from is always current.
  if (configured && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(configured) && !(__DEV__ && isPrivateLan(configured))) return configured;

  if (Platform.OS === 'web') {
    // The browser can always reach the API on the same machine it loaded the app from.
    const host = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
    return `http://${host}:${DEFAULT_PORT}${API_PATH}`;
  }

  const expoHost = getHostFromExpo();

  if (expoHost) {
    if (expoHost === 'localhost' || expoHost === '127.0.0.1') {
      if (Platform.OS === 'android') {
        return `http://10.0.2.2:${DEFAULT_PORT}${API_PATH}`;
      }
      return `http://localhost:${DEFAULT_PORT}${API_PATH}`;
    }
    return `http://${expoHost}:${DEFAULT_PORT}${API_PATH}`;
  }

  if (configured) {
    if (Platform.OS === 'android' && configured.includes('localhost')) {
      return configured.replace('localhost', '10.0.2.2');
    }
    return configured;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}${API_PATH}`;
  }

  return `http://localhost:${DEFAULT_PORT}${API_PATH}`;
};

const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: API_URL,
  // Without a timeout an unreachable server (wrong IP, service restarting) leaves a spinner
  // running forever. Uploads get longer because photos/videos travel over slow mobile links.
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isFormData) {
    // Let React Native's XHR adapter attach the multipart boundary. Setting this
    // header manually leaves the boundary off and Spring cannot parse video uploads.
    config.headers.delete('Content-Type');
    if (config.timeout === 30000) config.timeout = 120000;
  } else if (config.data !== undefined && config.data !== null) {
    config.headers.set('Content-Type', 'application/json');
  }
  const token = await AsyncStorage.getItem('hustleup_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let _isRefreshing = false;
let _failedQueue = [];

const _processQueue = (error, token = null) => {
  _failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  _failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && !original.skipAuthRefresh) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      _isRefreshing = true;
      try {
        const refreshToken = await AsyncStorage.getItem('hustleup_refresh');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.setItem('hustleup_token', data.accessToken);
        _processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        _processQueue(refreshErr, null);
        await AsyncStorage.multiRemove(['hustleup_token', 'hustleup_refresh', 'hustleup_user']);
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }, { skipAuthRefresh: true }),
  resendCode: email => api.post('/auth/resend-code', { email }, { skipAuthRefresh: true }),
  usernameAvailable: username => api.get('/auth/username-available', { params: { username }, skipAuthRefresh: true }),
  forgotPassword: email => api.post('/auth/forgot-password', { email }, { skipAuthRefresh: true }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }, { skipAuthRefresh: true }),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const leaderboardApi = {
  board: (metric, window) => api.get('/leaderboard', { params: { metric, window, limit: 25 } }),
};

export const storiesApi = {
  viewers: id => api.get(`/stories/${id}/views`),
  comments: id => api.get(`/stories/${id}/comments`),
  addComment: (id, content) => api.post(`/stories/${id}/comments`, { content }),
  deleteComment: (id, commentId) => api.delete(`/stories/${id}/comments/${commentId}`),
  getAll: () => api.get('/stories'),
  create: (formData) => api.post('/stories', formData),
  delete: (id) => api.delete(`/stories/${id}`),
  like: (id) => api.post(`/stories/${id}/likes`),
  unlike: (id) => api.delete(`/stories/${id}/likes`),
  view: (id) => api.post(`/stories/${id}/views`),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  getProfile: (id) => api.get(`/users/${id}/profile`),
  getMyViewers: () => api.get('/users/me/viewers'),
  updateProfile: (data) => api.patch('/users/me', data),
  uploadAvatar: (formData) => api.patch('/users/me/avatar', formData),
  uploadBanner: (formData) => api.patch('/users/me/banner', formData),
  updatePushToken: (pushToken) => api.patch('/users/me/push-token', { pushToken }),
};

export const followsApi = {
  requests: () => api.get('/follows/requests'),
  approveRequest: (id) => api.post(`/follows/requests/${id}/accept`),
  declineRequest: (id) => api.delete(`/follows/requests/${id}`),
  getFollowers: (userId) => api.get(userId ? `/follows/${userId}/followers` : '/follows/followers'),
  getFollowing: (userId) => api.get(userId ? `/follows/${userId}/following` : '/follows/following'),
  getMyFollowers: () => api.get('/follows/followers'),
  getMyFollowing: () => api.get('/follows/following'),
  getCounts: (userId) => api.get(`/follows/${userId}/counts`),
  isFollowing: (userId) => api.get(`/follows/${userId}/is-following`),
  relationship: (userId) => api.get(`/follows/${userId}/relationship`),
  follow: (id) => api.post(`/follows/${id}`),
  unfollow: (id) => api.delete(`/follows/${id}`),
};

export const listingsApi = {
  browse: (params) => api.get('/listings', { params }),
  search: (q) => api.get('/listings', { params: { q } }),
  getById: (id) => api.get(`/listings/${id}`),
  create: (formData) => api.post('/listings', formData),
  getMyListings: () => api.get('/listings/my'),
  forFeed: () => api.get('/listings', { params: { sort: 'latest' } }),
  getRecommended: () => api.get('/listings/recommended'),
  getByUser: (userId) => api.get(`/listings/user/${userId}`),
};

export const feedApi = {
  repost: (id) => api.post(`/feed/${id}/repost`, { comment: '' }),
  undoRepost: (id) => api.delete(`/feed/${id}/repost`),
  following: () => api.get('/feed/following'),
  communities: () => api.get('/feed/communities'),
  mySaved: () => api.get('/feed/saved/me'),
  getPosts: (sort = 'latest') => api.get('/feed', { params: { sort } }),
  createPost: (formData) => api.post('/feed', formData),
  likePost: (id) => api.post(`/feed/${id}/likes`),
  unlikePost: (id) => api.delete(`/feed/${id}/likes`),
  getComments: (id) => api.get(`/feed/${id}/comments`),
  addComment: (id, content, parentId) => {
    const body = { content };
    if (parentId) body.parentId = parentId;
    return api.post(`/feed/${id}/comments`, body);
  },
};

/**
 * Swap Mode: offer one of your listings (or a described item + photo) for someone's listing,
 * optionally with a cash top-up either way. cashDirection: PROPOSER_PAYS | OWNER_PAYS.
 */
export const swapsApi = {
  create: (data, offeredImage) => {
    const form = new FormData();
    Object.entries(data).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') form.append(key, String(value)); });
    if (offeredImage) form.append('offeredImage', offeredImage);
    return api.post('/swaps', form);
  },
  incoming: () => api.get('/swaps/incoming'),
  outgoing: () => api.get('/swaps/outgoing'),
  forListing: (listingId) => api.get(`/swaps/listing/${listingId}`),
  accept: (id) => api.patch(`/swaps/${id}/accept`),
  decline: (id) => api.patch(`/swaps/${id}/decline`),
  withdraw: (id) => api.patch(`/swaps/${id}/withdraw`),
  received: (id, proof) => { const form = new FormData(); form.append('proof', proof); return api.post(`/swaps/${id}/received`, form); },
};

export const communitiesApi = {
  browse: () => api.get('/communities'),
  mine: () => api.get('/communities/mine'),
  get: (idOrSlug) => api.get(`/communities/${idOrSlug}`),
  join: (idOrSlug) => api.post(`/communities/${idOrSlug}/join`),
  leave: (idOrSlug) => api.delete(`/communities/${idOrSlug}/join`),
  /** Multipart so a banner can upload with the community in one request. */
  create: ({ name, description, city, category, image }) => {
    const form = new FormData();
    form.append('name', name);
    if (description) form.append('description', description);
    if (city) form.append('city', city);
    if (category) form.append('category', category);
    if (image) form.append('image', image);
    return api.post('/communities', form);
  },
};

export const datingApi = {
  getProfiles: (params) => api.get('/dating/profiles', { params }),
  getMyProfile: () => api.get('/dating/profile/me'),
  saveProfile: (formData) => api.post('/dating/profile', formData),
  likeProfile: (id) => api.post(`/dating/like/${id}`),
  superLikeProfile: (id) => api.post(`/dating/like/${id}`, null, { params: { superLike: true } }),
  passProfile: (id) => api.post(`/dating/pass/${id}`),
  rewind: () => api.post('/dating/rewind'),
  matches: () => api.get('/dating/matches'),
  likesYou: () => api.get('/dating/likes'),
  unmatch: (id) => api.delete(`/dating/matches/${id}`),
};

export const directMessagesApi = {
  getPartners: () => api.get('/direct-messages/partners'),
  getConversation: (partnerId) => api.get(`/direct-messages/${partnerId}`),
  sendMessage: (partnerId, content, extra = {}) => api.post(`/direct-messages/${partnerId}`, { content, ...extra }),
  sendMedia: (partnerId, formData) => api.post(`/direct-messages/${partnerId}/media`, formData),
  getOrCreateConversation: (partnerId) => api.get(`/direct-messages/${partnerId}`),
  unreadCount: () => api.get('/direct-messages/unread-count'),
  edit: (messageId, content) => api.patch(`/direct-messages/messages/${messageId}`, { content }),
  deleteForEveryone: (messageId) => api.delete(`/direct-messages/messages/${messageId}`),
  react: (messageId, emoji) => api.post(`/direct-messages/messages/${messageId}/reactions`, { emoji }),
  presence: (partnerId) => api.get(`/direct-messages/${partnerId}/presence`),
  typing: (partnerId) => api.post(`/direct-messages/${partnerId}/typing`),
  heartbeat: () => api.post('/direct-messages/presence'),
  getPrivacy: () => api.get('/direct-messages/privacy'),
  updatePrivacy: (settings) => api.put('/direct-messages/privacy', settings),
};

export const blocksApi = {
  list: () => api.get('/follows/blocked'),
  block: (id) => api.post(`/follows/${id}/block`),
  unblock: (id) => api.delete(`/follows/${id}/block`),
};

export const bookingsApi = {
  checkout: (data) => api.post('/bookings/checkout', data),
  /** One Stripe payment for the whole cart: listings plus products from any number of shops. */
  checkoutCart: (data) => api.post('/bookings/checkout/cart', data, { timeout: 60000 }),
  create: (data) => api.post('/bookings', data),
  getAll: () => api.get('/bookings/my'),
  cancel: (id, reason) => api.patch(`/bookings/${id}/cancel`, { reason }),
  accept: (id, version) => api.patch(`/bookings/${id}/accept`, { version }),
  counter: (id, counterPrice, version) => api.patch(`/bookings/${id}/counter`, { counterPrice, version }),
  confirmReceipt: id => api.patch(`/bookings/${id}/received`),
  updateFulfilment: (id, update) => api.patch(`/bookings/${id}/fulfilment`, update),
  checkoutSession: id => api.post(`/bookings/${id}/checkout-session`),
  confirmPayment: sessionId => api.post('/bookings/confirm-payment', { sessionId }),
  complete: (id) => api.patch(`/bookings/${id}/complete`),
};

export const shopsApi = {
  create: (data) => api.post('/shops', data),
  /** 204 with an empty body when the user has no shop yet. */
  mine: () => api.get('/shops/me'),
  addProduct: (id, data) => api.post(`/shops/${id}/products`, data),
  updateProduct: (id, productId, data) => api.patch(`/shops/${id}/products/${productId}`, data),
  deleteProduct: (id, productId) => api.delete(`/shops/${id}/products/${productId}`),
  addService: (id, data) => api.post(`/shops/${id}/services`, data),
  deleteService: (id, serviceId) => api.delete(`/shops/${id}/services/${serviceId}`),
  addSlot: (id, serviceId, startTime, endTime) => api.post(`/shops/${id}/services/${serviceId}/slots`, { startTime, endTime }),
  update: (id, data) => api.patch(`/shops/${id}`, data),
  uploadMedia: (id, form) => api.post(`/shops/${id}/media`, form),
  browse: () => api.get('/shops'),
  get: (id) => api.get(`/shops/${id}`),
  services: (id) => api.get(`/shops/${id}/services`),
  slots: (id, serviceId) => api.get(`/shops/${id}/services/${serviceId}/slots`),
  book: (id, data) => api.post(`/shops/${id}/appointments`, data),
  checkout: (id, data) => api.post(`/shops/${id}/checkout`, data),
  orders: () => api.get('/shops/orders/mine'),
  sales: () => api.get('/shops/orders/received'),
  confirmReceipt: id => api.patch(`/shops/orders/${id}/received`),
  updateFulfilment: (id, update) => api.patch(`/shops/orders/${id}/fulfilment`, update),
};

export const claimsApi = {
  mine: () => api.get('/claims/mine'),
  raise: (orderType, orderId, reason, detail) => api.post('/claims', { orderType, orderId, reason, detail }),
};

export const payoutsApi = {
  dashboard: () => api.post('/payouts/dashboard'),
  status: () => api.get('/payouts/status'),
  connect: () => api.post('/payouts/connect'),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const ticketsApi = {
  my: () => api.get('/tickets/my'),
  getById: id => api.get(`/tickets/${id}`),
  forEventMine: id => api.get(`/tickets/event/${id}/mine`),
  checkInSelf: id => api.post(`/tickets/${id}/check-in`),
  forEvent: id => api.get(`/tickets/event/${id}`),
  doorSummary: id => api.get(`/tickets/event/${id}/summary`),
  scan: (id, code) => api.post(`/tickets/event/${id}/scan`, { code }),
};

export const jobsApi = {
  board: params => api.get('/jobs', { params }),
  one: id => api.get(`/jobs/${id}`),
  myApplications: () => api.get('/jobs/applications/mine'),
  apply: (id, data) => api.post(`/jobs/${id}/apply`, data),
};
export const newsApi = {
  feed: params => api.get('/news', { params }),
  one: id => api.get(`/news/${id}`),
};

export const reviewsApi = {
  create: data => api.post('/reviews', data),
  forUser: id => api.get(`/reviews/user/${id}`),
};

export { API_URL };
export default api;
