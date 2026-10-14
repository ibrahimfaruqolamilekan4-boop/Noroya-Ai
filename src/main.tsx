import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import CryptoWorkstation from './components/CryptoWorkstation.tsx';
import './index.css';

// Proactively clear any stale Service Workers or Cache Storage from old builds
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  }
  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name).catch(() => {});
      }
    }).catch(() => {});
  }
}

// Lightweight hash routing: the Crypto Workstation lives at /#crypto, everything else renders the main app.
const showCryptoWorkstation = typeof window !== 'undefined' && window.location.hash.indexOf('#crypto') === 0;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showCryptoWorkstation ? <CryptoWorkstation /> : <App />}
  </StrictMode>,
);
