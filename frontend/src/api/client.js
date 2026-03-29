import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hustleup_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt token refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('hustleup_refresh');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
          localStorage.setItem('hustleup_token', res.data.accessToken);
          original.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem('hustleup_token');
          localStorage.removeItem('hustleup_refresh');
          localStorage.removeItem('hustleup_user');
          window.location.href = '/login';
        }
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
};

// Listings
export const listingsApi = {
  browse: (params) => api.get('/listings', { params }),
  search: (q) => api.get('/listings/search', { params: { q } }),
  getById: (id) => api.get(`/listings/${id}`),
  create: (formData) =>
    api.post('/listings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, data) => api.patch(`/listings/${id}`, data),
  my: () => api.get('/listings/my'),
};

// Bookings
export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  counterOffer: (id, counterPrice) =>
    api.patch(`/bookings/${id}/counter`, { counterPrice }),
  accept: (id) => api.patch(`/bookings/${id}/accept`),
  cancel: (id, reason) => api.patch(`/bookings/${id}/cancel`, { reason }),
  complete: (id) => api.patch(`/bookings/${id}/complete`),
  my: () => api.get('/bookings/my'),
};

// Messages
export const messagesApi = {
  getHistory: (bookingId) => api.get(`/messages/${bookingId}`)
};

export const directMessagesApi = {
  getPartners: () => api.get('/direct-messages/partners'),
  getConversation: (partnerId) => api.get(`/direct-messages/${partnerId}`),
  sendMessage: (partnerId, content) => api.post(`/direct-messages/${partnerId}`, { content })
};

// Reviews
export const reviewsApi = {
  create: (data) => api.post('/reviews', data),
  getForUser: (userId) => api.get(`/reviews/user/${userId}`),
};

// Notifications
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
};

// Users
export const usersApi = {
  getProfile: (id) => api.get(`/users/${id}/profile`),
  updateProfile: (data) => api.patch('/users/me', data),
};

// Feed
export const feedApi = {
  getAll: () => api.get('/feed'),
  createPost: (formData) => api.post('/feed', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Dating
export const datingApi = {
  getProfiles: () => api.get('/dating/profiles'),
  saveProfile: (formData) => api.post('/dating/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Subscriptions
export const subscriptionsApi = {
  my: () => api.get('/subscriptions/my'),
  upgrade: () => api.post('/subscriptions/upgrade'),
};

export default api;
