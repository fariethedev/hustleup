import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import * as Sentry from '@sentry/react';
import { store } from './store';
import './index.css';
import App from './App.jsx';

// No-ops safely if VITE_SENTRY_DSN is unset (blank dsn just disables the SDK).
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      {/* Blank client ID just disables the button's onSuccess flow — safe default. */}
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'unset'}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GoogleOAuthProvider>
    </Provider>
  </StrictMode>,
);
