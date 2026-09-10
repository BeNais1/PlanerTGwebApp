import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './minimal.css'

// Telegram types are declared in src/types/telegram.d.ts

function getSavedTheme() {
  try {
    return localStorage.getItem('app-theme') || 'dark';
  } catch {
    return 'dark';
  }
}

// Apply saved theme immediately to prevent flash
const savedTheme = getSavedTheme();
document.documentElement.setAttribute('data-theme', savedTheme);

function hasTelegramLaunchParams() {
  const launchParams = `${window.location.search} ${window.location.hash}`;
  return (
    launchParams.includes('tgWebAppData') ||
    launchParams.includes('tgWebAppPlatform') ||
    navigator.userAgent.includes('Telegram')
  );
}

function waitForTelegramWebApp(timeoutMs: number) {
  return new Promise<void>((resolve) => {
    if (window.Telegram?.WebApp) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      if (window.Telegram?.WebApp || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(intervalId);
        resolve();
      }
    }, 50);
  });
}

function initializeTelegramChrome() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    try {
      tg.ready();
    } catch (error) {
      console.error('Telegram ready failed:', error);
    }

    try {
      tg.expand();
    } catch (error) {
      console.error('Telegram expand failed:', error);
    }

    try {
      const headerColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
      const bgColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
      if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
      if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
    } catch (error) {
      console.error('Telegram colors failed:', error);
    }

    // Set CSS variable for viewport height
    const setVh = () => {
      const vh = window.Telegram?.WebApp?.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--tg-vh', `${vh}px`);
    };
    setVh();
    try {
      if (tg.onEvent) tg.onEvent('viewportChanged', setVh);
    } catch (error) {
      console.error('Telegram viewport listener failed:', error);
    }
  
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
}

async function bootstrap() {
  await waitForTelegramWebApp(hasTelegramLaunchParams() ? 5000 : 1000);
  initializeTelegramChrome();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap();
