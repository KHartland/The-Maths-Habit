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

// Register service worker for PWA (web only — skip on native apps where Capacitor bundles assets locally)
import { Capacitor } from '@capacitor/core';
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    // Force-clear stale caches then re-register
    if (window.caches) { caches.keys().then(function(ks) { ks.forEach(function(k) { caches.delete(k); }); }); }
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
} else if (Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  // On native: unregister any stale service worker and clear caches
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    registrations.forEach(function(reg) { reg.unregister(); });
  });
  if (window.caches) { caches.keys().then(function(ks) { ks.forEach(function(k) { caches.delete(k); }); }); }
}
