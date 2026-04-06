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
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  if (!configured || typeof configured !== 'string') return null;
  return withApiPath(configured);
};

const resolveApiUrl = () => {
  const configured = getConfiguredBaseUrl();

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
    if (error.response?.status === 401 && !original._retry) {
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
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const storiesApi = {
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
};

export const followsApi = {
  getFollowers: (userId) => api.get(userId ? `/follows/${userId}/followers` : '/follows/followers'),
  getFollowing: (userId) => api.get(userId ? `/follows/${userId}/following` : '/follows/following'),
  getMyFollowers: () => api.get('/follows/followers'),
  getMyFollowing: () => api.get('/follows/following'),
  getCounts: (userId) => api.get(`/follows/${userId}/counts`),
  isFollowing: (userId) => api.get(`/follows/${userId}/is-following`),
  follow: (id) => api.post(`/follows/${id}`),
  unfollow: (id) => api.delete(`/follows/${id}`),
};

export const listingsApi = {
  browse: (params) => api.get('/listings', { params }),
  search: (q) => api.get('/listings/search', { params: { q } }),
  getById: (id) => api.get(`/listings/${id}`),
  create: (formData) => api.post('/listings', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyListings: () => api.get('/listings/my'),
  forFeed: () => api.get('/listings', { params: { sort: 'latest' } }),
  getRecommended: () => api.get('/listings/recommended'),
  getByUser: (userId) => api.get(`/listings/user/${userId}`),
};

export const feedApi = {
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
  create: (data) => api.post('/bookings', data),
  getAll: () => api.get('/bookings/my'),
  cancel: (id, reason) => api.patch(`/bookings/${id}/cancel`, { reason }),
  accept: (id) => api.patch(`/bookings/${id}/accept`),
  counter: (id, counterPrice) => api.patch(`/bookings/${id}/counter`, { counterPrice }),
  complete: (id) => api.patch(`/bookings/${id}/complete`),
};

export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export { API_URL };
export default api;
