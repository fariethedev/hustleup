import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = '8080';
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
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return withApiPath(window.location.origin);
  }

  const configured = getConfiguredBaseUrl();
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

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const storiesApi = {
  getAll: () => api.get('/stories'),
  create: (formData) => api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  like: (id) => api.post(`/stories/${id}/likes`),
  unlike: (id) => api.delete(`/stories/${id}/likes`),
  view: (id) => api.post(`/stories/${id}/views`),
};

export const usersApi = {
  getAll: () => api.get('/users'),
};

export { API_URL };
export default api;
