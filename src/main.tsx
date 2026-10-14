import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Prevent uncaught Clerk CDN timeout errors from unhandled window rejection in iframe previews
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = e?.message || e?.error?.message || '';
    if (typeof msg === 'string' && (msg.includes('failed_to_load_clerk_js_timeout') || msg.includes('Failed to load Clerk'))) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e?.reason?.message || String(e?.reason || '');
    if (typeof msg === 'string' && (msg.includes('failed_to_load_clerk_js_timeout') || msg.includes('Failed to load Clerk'))) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}

// Register Workbox Service Worker for offline metadata caching and intermittent travel connectivity
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] New version ready.');
    },
    onOfflineReady() {
      console.log('[PWA] Project metadata & SOP cached for offline international travel.');
    }
  });
}

import { ClerkAppWrapper } from './lib/clerk.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkAppWrapper>
      <App />
    </ClerkAppWrapper>
  </StrictMode>,
);
