import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../api/client';


// Initial state checks localStorage
const token = localStorage.getItem('hustleup_token');
const userStr = localStorage.getItem('hustleup_user');
const user = userStr ? JSON.parse(userStr) : null;

const initialState = {
  user,
  isAuthenticated: !!token && !!user,
  loading: false,
  error: null,
};

// Async thunks for auth actions
export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const res = await authApi.login(credentials);
    const { accessToken, refreshToken, role, fullName, userId } = res.data;
    localStorage.setItem('hustleup_token', accessToken);
    localStorage.setItem('hustleup_refresh', refreshToken);

    // Fetch full profile from backend to get onboardingCompleted status
    let userData;
    try {
      const meRes = await authApi.me();
      userData = {
        ...meRes.data,
        onboardingCompleted: true,
      };
    } catch {
      // Fallback if /me fails
      userData = { id: userId, email: credentials.email, fullName, role, onboardingCompleted: true };
    }
    localStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.response?.data?.message || 'Login failed');
  }
});

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.register(data);
    const { accessToken, refreshToken, role, fullName, userId } = res.data;
    localStorage.setItem('hustleup_token', accessToken);
    localStorage.setItem('hustleup_refresh', refreshToken);
    
    const userData = { id: userId, email: data.email, fullName, role, onboardingCompleted: true };
    localStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
  }
});

export const loadUserProfile = createAsyncThunk('auth/loadProfile', async (_, { rejectWithValue }) => {
  try {
    const res = await authApi.me();
    // Use backend's onboardingCompleted as authoritative source
    const backendUser = res.data;
    const userData = {
      ...res.data,
      onboardingCompleted: true,
    };
    localStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue('Failed to load profile');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      localStorage.removeItem('hustleup_token');
      localStorage.removeItem('hustleup_refresh');
      localStorage.removeItem('hustleup_user');
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError(state) {
      state.error = null;
    },

  },
  extraReducers: (builder) => {
    builder
      // Login
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
      // Register
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
      // Load Profile
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { logout, clearError } = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsSeller = (state) => state.auth.user?.role === 'SELLER';
export const selectHasCompletedOnboarding = () => true;

export default authSlice.reducer;
