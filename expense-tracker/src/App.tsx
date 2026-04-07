import { HomePage } from './pages/HomePage'
import { TelegramOnlyScreen } from './components/auth/TelegramOnlyScreen'
import { AuthProvider } from './context/AuthContext'
import { useAutoUpdate } from './hooks/useAutoUpdate'
import './App.css'
import './components/auth/TelegramOnlyScreen.css'

function App() {
  // Инициализируем авто-обновления
  useAutoUpdate();

  // Проверяем, открыто ли приложение в Telegram
  const isTelegramWebApp = () => {
    const tg = window.Telegram?.WebApp;
    
    if (!tg) {
      return false;
    }
    
    // Проверяем платформу
    const platform = tg.platform;
    
    // Блокируем desktop и web версии
    if (platform === 'unknown' || platform === 'web' || platform === 'weba') {
      return false;
    }
    
    // Разрешаем только мобильные платформы
    return platform === 'ios' || platform === 'android' || platform === 'tdesktop' || platform === 'macos';
  };

  if (!isTelegramWebApp()) {
    return <TelegramOnlyScreen />;
  }

  // Expand the Telegram WebApp to maximum height
  try {
    const tg: any = window.Telegram?.WebApp;
    if (tg && !tg.isExpanded) {
      tg.expand();
    }
  } catch (e) {
    console.error('Failed to expand Telegram WebApp:', e);
  }

  return (
    <AuthProvider>
      <HomePage />
    </AuthProvider>
  )
}

export default App
