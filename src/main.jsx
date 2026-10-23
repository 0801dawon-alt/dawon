import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);

// On the homepage, a service worker makes the site installable as a desktop / home-screen app.
if ('serviceWorker' in navigator && !window.claude && /github\.io$|^localhost$/.test(location.hostname)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
