import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../api/client';
import { clearStoredSession } from '../utils/session';


// Initial state checks localStorage
const token = localStorage.getItem('hustleup_token');
const userStr = localStorage.getItem('hustleup_user');
const user = userStr ? JSON.parse(userStr) : null;

const initialState = {
  user,
  isAuthenticated: !!token && !!user,
  loading: false,
  error: null,
  // field name -> message, when the backend rejected specific inputs. Null otherwise.
  fieldErrors: null,
};

/**
 * Turns an axios failure into a message worth showing someone, plus the per-field
 * detail when there is any.
 *
 * GlobalExceptionHandler answers @Valid failures with {"validationErrors": {field: msg}}
 * and business-rule failures with {"error": "..."}. This previously read only `error`
 * and `message`, so every validation failure — wrong password format, taken username,
 * bad email — collapsed into the same useless "Registration failed", and the response
 * actually naming the problem was thrown away.
 */
const describeAuthError = (err, fallback) => {
  const data = err.response?.data;
  const fieldErrors =
    data?.validationErrors && typeof data.validationErrors === 'object'
      ? data.validationErrors
      : null;

  const message =
    data?.error ||
    data?.message ||
    // Several fields can fail at once; show them all rather than picking one.
    (fieldErrors ? Object.values(fieldErrors).join(' ') : null) ||
    // A network failure has no response body at all, and "Registration failed" badly
    // misdescribes it — nothing was attempted server-side.
    (err.response ? null : 'Could not reach the server. Check your connection and try again.') ||
    fallback;

  return { message, fieldErrors };
};

/**
 * Shared `rejected` handler.
 *
 * `state.error` must stay a plain string — components render it directly, and putting
 * the describeAuthError object there would crash React with "Objects are not valid as a
 * React child". The per-field detail goes in its own key instead, so existing consumers
 * of `error` are unaffected.
 */
const applyAuthError = (state, action) => {
  state.loading = false;
  state.error = action.payload?.message ?? action.payload ?? null;
  state.fieldErrors = action.payload?.fieldErrors ?? null;
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
    return rejectWithValue(describeAuthError(err, 'Login failed'));
  }
});

// Shared by googleLogin/facebookLogin — both hit an /auth/oauth/* endpoint that returns
// the exact same AuthResponse shape as the password login endpoint.
async function handleOAuthResponse(apiCall, rejectWithValue) {
  try {
    const res = await apiCall;
    const { accessToken, refreshToken, role, fullName, userId } = res.data;
    localStorage.setItem('hustleup_token', accessToken);
    localStorage.setItem('hustleup_refresh', refreshToken);
    let userData;
    try {
      const meRes = await authApi.me();
      userData = { ...meRes.data, onboardingCompleted: true };
    } catch {
      userData = { id: userId, fullName, role, onboardingCompleted: true };
    }
    localStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue(describeAuthError(err, 'Sign-in failed'));
  }
}

export const googleLogin = createAsyncThunk('auth/googleLogin', async (idToken, { rejectWithValue }) =>
  handleOAuthResponse(authApi.googleLogin(idToken), rejectWithValue));

export const facebookLogin = createAsyncThunk('auth/facebookLogin', async (accessToken, { rejectWithValue }) =>
  handleOAuthResponse(authApi.facebookLogin(accessToken), rejectWithValue));

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await authApi.register(data);

    // Registering no longer signs you in. The server withholds the session until the address
    // is confirmed, and answers with verificationRequired instead of tokens — so there is
    // nothing to store yet, and the caller sends the person to the code screen.
    if (res.data?.verificationRequired) {
      return { verificationRequired: true, email: res.data.email || data.email };
    }

    // Still reachable where the server has no way to send mail, in which case withholding
    // the session would lock everyone out rather than protect anything.
    const { accessToken, refreshToken, role, fullName, userId } = res.data;
    localStorage.setItem('hustleup_token', accessToken);
    localStorage.setItem('hustleup_refresh', refreshToken);

    const userData = { id: userId, email: data.email, fullName, role, onboardingCompleted: true };
    localStorage.setItem('hustleup_user', JSON.stringify(userData));
    return userData;
  } catch (err) {
    return rejectWithValue(describeAuthError(err, 'Registration failed'));
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
      // Clears every session-scoped key, not just the auth ones — see utils/session.
      // The cart's in-memory copy is dropped by cartSlice, which listens for this action.
      clearStoredSession();
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
      state.fieldErrors = null;
    },
    clearError(state) {
      state.error = null;
      state.fieldErrors = null;
    },
    /**
     * Adopts a session created outside the login/register thunks.
     *
     * Used by the verify-code screen, which is now where a new account's session begins:
     * registration withholds it until the address is confirmed, so the tokens come back from
     * verification and the store has to be told about them.
     */
    sessionRestored(state, action) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
      state.fieldErrors = null;
    },

  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; state.fieldErrors = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, applyAuthError)
      // Google / Facebook sign-in
      .addCase(googleLogin.pending, (state) => { state.loading = true; state.error = null; state.fieldErrors = null; })
      .addCase(googleLogin.fulfilled, (state, action) => { state.loading = false; state.isAuthenticated = true; state.user = action.payload; })
      .addCase(googleLogin.rejected, applyAuthError)
      .addCase(facebookLogin.pending, (state) => { state.loading = true; state.error = null; state.fieldErrors = null; })
      .addCase(facebookLogin.fulfilled, (state, action) => { state.loading = false; state.isAuthenticated = true; state.user = action.payload; })
      .addCase(facebookLogin.rejected, applyAuthError)
      // Register
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; state.fieldErrors = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        // A pending verification is a successful registration with no session behind it —
        // marking it authenticated here would let an unconfirmed account through the router.
        if (action.payload?.verificationRequired) return;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(registerUser.rejected, applyAuthError)
      // Load Profile
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { logout, clearError, sessionRestored } = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
/** Per-field rejection messages from the last failed auth call, or null. */
export const selectFieldErrors = (state) => state.auth.fieldErrors;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsSeller = (state) => state.auth.user?.role === 'SELLER';
export const selectHasCompletedOnboarding = () => true;

export default authSlice.reducer;
