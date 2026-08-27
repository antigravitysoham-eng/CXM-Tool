import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registered after load so it never competes with first paint. Failure is
// non-fatal: without it the app simply is not installable, which is not a
// reason to break the page.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((e) => {
            console.warn('Service worker registration failed:', e.message);
        });
    });
}
