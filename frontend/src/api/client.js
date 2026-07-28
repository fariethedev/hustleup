import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
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

// Handle 401/403 — attempt token refresh, then logout
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Skip toast for auth errors — they'll be handled by redirect/refresh
    if (status !== 401 && status !== 403) {
      const msg = error.response?.data?.message || error.message || "An unexpected error occurred";
      console.error('API Error:', msg);
    }

    // On 401 or 403: try refreshing the access token once (only if user was authenticated)
    const hasStoredToken = !!localStorage.getItem('hustleup_token') || !!localStorage.getItem('hustleup_refresh');
    if ((status === 401 || status === 403) && !original._retry && hasStoredToken) {
      original._retry = true;
      const refreshToken = localStorage.getItem('hustleup_refresh');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
          const newToken = res.data.accessToken;
          localStorage.setItem('hustleup_token', newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch {
          // Refresh failed — clear session and redirect to login
          localStorage.removeItem('hustleup_token');
          localStorage.removeItem('hustleup_refresh');
          localStorage.removeItem('hustleup_user');
          window.location.href = '/login';
        }
      } else {
        // No refresh token either — clear and redirect
        localStorage.removeItem('hustleup_token');
        localStorage.removeItem('hustleup_user');
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
  // Returns a Stripe-hosted checkout URL for the buyer to pay for a BOOKED booking.
  checkoutSession: (id) => api.post(`/bookings/${id}/checkout-session`),
};

// Seller payout accounts (Stripe Connect). Sellers connect a bank account once via
// Stripe's own hosted onboarding form — HustleUp never sees or stores the actual bank
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
  createPost: (formData) => api.post('/feed', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getComments: (postId) => api.get(`/feed/${postId}/comments`),
  addComment: (postId, content) => api.post(`/feed/${postId}/comments`, { content }),
  likePost: (postId) => api.post(`/feed/${postId}/likes`),
  unlikePost: (postId) => api.delete(`/feed/${postId}/likes`),
  getLikers: (postId) => api.get(`/feed/${postId}/likes`),
  myLiked: () => api.get('/feed/liked/me'),
  // Posts a seller has linked to one of their listings (e.g. announcements about an EVENT).
  getByListing: (listingId) => api.get(`/feed/listing/${listingId}`),
};

// Social graph: follow/unfollow, relationship summary, block, report.
// These live in the social service under /follows (NOT /users — the old
// usersApi.followUser endpoints never existed on the backend).
export const followsApi = {
  follow: (userId) => api.post(`/follows/${userId}`),
  unfollow: (userId) => api.delete(`/follows/${userId}`),
  relationship: (userId) => api.get(`/follows/${userId}/relationship`),
  block: (userId) => api.post(`/follows/${userId}/block`),
  unblock: (userId) => api.delete(`/follows/${userId}/block`),
  report: (userId, reason) => api.post(`/follows/${userId}/report`, { reason }),
};

// Dating
export const datingApi = {
  getProfiles: () => api.get('/dating/profiles'),
  getMyProfile: () => api.get('/dating/profile/me'),
  saveProfile: (formData) => api.post('/dating/profile', formData),
  like: (profileId) => api.post(`/dating/like/${profileId}`),
  pass: (profileId) => api.post(`/dating/pass/${profileId}`),
};

// Subscriptions
export const subscriptionsApi = {
  my: () => api.get('/subscriptions/my'),
  upgrade: () => api.post('/subscriptions/upgrade'),
};

// Stories
export const storiesApi = {
  getAll: () => api.get('/stories'),
  create: (formData) => api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/stories/${id}`),
  like: (id) => api.post(`/stories/${id}/likes`),
  unlike: (id) => api.delete(`/stories/${id}/likes`),
  view: (id) => api.post(`/stories/${id}/views`),
};

export default api;
