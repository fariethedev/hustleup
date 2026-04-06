import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/client';

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const buildUserData = (dto) => ({
  id: dto.id || dto.userId,
  email: dto.email,
  fullName: dto.fullName,
  username: dto.username,
  role: dto.role,
  avatarUrl: dto.avatarUrl || null,
});

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const res = await authApi.login(credentials);
    const { accessToken, refreshToken } = res.data;
    await AsyncStorage.setItem('hustleup_token', accessToken);
    await AsyncStorage.setItem('hustleup_refresh', refreshToken);
    // Fetch full profile to get avatarUrl and username
    let userData;
    try {
      const meRes = await authApi.me();
      userData = buildUserData(meRes.data);
    } catch {
      userData = buildUserData({ ...res.data, email: credentials.email });
    }
    await AsyncStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.response?.data?.message || 'Login failed');
  }
});

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.register(data);
    const { accessToken, refreshToken } = res.data;
    await AsyncStorage.setItem('hustleup_token', accessToken);
    await AsyncStorage.setItem('hustleup_refresh', refreshToken);
    let userData;
    try {
      const meRes = await authApi.me();
      userData = buildUserData(meRes.data);
    } catch {
      userData = buildUserData({ ...res.data, email: data.email });
    }
    await AsyncStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
  }
});

export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async (_, { rejectWithValue }) => {
  try {
    const meRes = await authApi.me();
    const userData = buildUserData(meRes.data);
    await AsyncStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue('Failed to fetch user');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.removeItem('hustleup_token');
  await AsyncStorage.removeItem('hustleup_refresh');
  await AsyncStorage.removeItem('hustleup_user');
});

const authSlice = createSlice({
  name: 'auth',
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setUser, clearError } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

export default authSlice.reducer;

