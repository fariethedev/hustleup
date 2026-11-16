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

const resolveApiUrl = () => {
  const configured = getConfiguredBaseUrl();
  // Explicit configuration wins over Metro's development-server address on real devices.
  if (configured && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(configured)) return configured;

  if (Platform.OS === 'web') {
    return configured || `http://localhost:${DEFAULT_PORT}${API_PATH}`;
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
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
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

export const subscriptionsApi = {
  plans: () => api.get('/subscriptions/plans'),
  my: () => api.get('/subscriptions/my'),
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
  create: (formData) => api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  uploadAvatar: (formData) => api.patch('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadBanner: (formData) => api.patch('/users/me/banner', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  create: (formData) => api.post('/listings', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  createPost: (formData) => api.post('/feed', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  likePost: (id) => api.post(`/feed/${id}/likes`),
  unlikePost: (id) => api.delete(`/feed/${id}/likes`),
  getComments: (id) => api.get(`/feed/${id}/comments`),
  addComment: (id, content, parentId) => {
    const body = { content };
    if (parentId) body.parentId = parentId;
    return api.post(`/feed/${id}/comments`, body);
  },
};

export const datingApi = {
  getProfiles: () => api.get('/dating/profiles'),
  getMyProfile: () => api.get('/dating/profile/me'),
  saveProfile: (formData) => api.post('/dating/profile', formData),
  likeProfile: (id) => api.post(`/dating/like/${id}`),
  passProfile: (id) => api.post(`/dating/pass/${id}`),
};

export const directMessagesApi = {
  getPartners: () => api.get('/direct-messages/partners'),
  getConversation: (partnerId) => api.get(`/direct-messages/${partnerId}`),
  sendMessage: (partnerId, content) => api.post(`/direct-messages/${partnerId}`, { content }),
  getOrCreateConversation: (partnerId) => api.get(`/direct-messages/${partnerId}`),
};

export const bookingsApi = {
  checkout: (data) => api.post('/bookings/checkout', data),
  create: (data) => api.post('/bookings', data),
  getAll: () => api.get('/bookings/my'),
  cancel: (id, reason) => api.patch(`/bookings/${id}/cancel`, { reason }),
  accept: (id, version) => api.patch(`/bookings/${id}/accept`, { version }),
  counter: (id, counterPrice, version) => api.patch(`/bookings/${id}/counter`, { counterPrice, version }),
  confirmReceipt: id => api.patch(`/bookings/${id}/received`),
  updateFulfilment: (id, update) => api.patch(`/bookings/${id}/fulfilment`, update),
  checkoutSession: id => api.post(`/bookings/${id}/checkout-session`),
  complete: (id) => api.patch(`/bookings/${id}/complete`),
};

export const shopsApi = {
  update: (id, data) => api.patch(`/shops/${id}`, data),
  uploadMedia: (id, form) => api.post(`/shops/${id}/media`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  apply: (id, data) => api.post(`/jobs/${id}/apply`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
