import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/browser'
import './index.css'
import App from './App.jsx'

// Initialise Sentry error tracking
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Capture unhandled errors and promise rejections
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Sample rate for performance monitoring (10%)
    tracesSampleRate: 0.1,
  });
}

// Test Sentry: call window.__testSentry() in browser console to verify
window.__testSentry = () => {
  throw new Error('[Sentry Test] This is a test error — if you see this in Sentry, it works!');
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
