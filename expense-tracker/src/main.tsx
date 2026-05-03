import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Telegram types are declared in src/types/telegram.d.ts

// Apply saved theme immediately to prevent flash
const savedTheme = localStorage.getItem('app-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  const headerColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
  const bgColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
  if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
  if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);

  // Set CSS variable for viewport height
  const setVh = () => {
    const vh = window.Telegram?.WebApp?.viewportStableHeight || window.innerHeight;
    document.documentElement.style.setProperty('--tg-vh', `${vh}px`);
  };
  setVh();
  if (tg.onEvent) tg.onEvent('viewportChanged', setVh);
  
  // Initialize safe area defaults
  document.documentElement.style.setProperty('--safe-area-top', '50px');
  document.documentElement.style.setProperty('--safe-area-bottom', '50px');
}

// Fallback for non-TG browsers
const setVhFallback = () => {
  document.documentElement.style.setProperty('--tg-vh', `${window.innerHeight}px`);
};
if (!window.Telegram?.WebApp) {
  setVhFallback();
  window.addEventListener('resize', setVhFallback);
  
  // Initialize safe area defaults for non-Telegram browsers
  document.documentElement.style.setProperty('--safe-area-top', '50px');
  document.documentElement.style.setProperty('--safe-area-bottom', '50px');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
