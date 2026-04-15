import { useEffect, useState } from 'react';

interface SafeAreaInsets {
  top: number;
  bottom: number;
}

export const useTelegramPlatform = () => {
  const [platform, setPlatform] = useState<string>('unknown');
  const [safeAreaInsets, setSafeAreaInsets] = useState<SafeAreaInsets>({
    top: 50,
    bottom: 50
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp as any;
    
    if (tg) {
      // Инициализация и переход в полноэкранный режим
      if (typeof tg.ready === 'function') tg.ready();
      if (typeof tg.requestFullscreen === 'function') {
        tg.requestFullscreen();
      } else if (typeof tg.expand === 'function') {
        tg.expand();
      }
      
      // Включаем подтверждение при закрытии
      if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
      
      // Устанавливаем цвета заголовка и фона
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#000000');
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#000000');

      const detectedPlatform = tg.platform;
      setPlatform(detectedPlatform);

      // Try Telegram 8.0+ safe area API first
      const tryTelegramSafeArea = () => {
        let top = 0;
        let bottom = 0;

        // Content safe area (accounts for Telegram header buttons)
        if (tg.contentSafeAreaInset) {
          top += tg.contentSafeAreaInset.top || 0;
        }
        // Device safe area (notch, home indicator)
        if (tg.safeAreaInset) {
          top += tg.safeAreaInset.top || 0;
          bottom += tg.safeAreaInset.bottom || 0;
        }

        if (top > 0 || bottom > 0) {
          setSafeAreaInsets({ top: Math.max(top, 20), bottom: Math.max(bottom, 10) });
          return true;
        }
        return false;
      };

      // Listen for safe area changes (Telegram 8.0+)
      if (typeof tg.onEvent === 'function') {
        tg.onEvent('safeAreaChanged', tryTelegramSafeArea);
        tg.onEvent('contentSafeAreaChanged', tryTelegramSafeArea);
      }

      // Try API first, fallback to platform-based values
      if (!tryTelegramSafeArea()) {
        if (detectedPlatform === 'ios') {
          setSafeAreaInsets({ top: 60, bottom: 34 });
        } else if (detectedPlatform === 'android') {
          setSafeAreaInsets({ top: 48, bottom: 24 });
        } else if (detectedPlatform === 'macos' || detectedPlatform === 'tdesktop') {
          setSafeAreaInsets({ top: 32, bottom: 20 });
        } else {
          setSafeAreaInsets({ top: 50, bottom: 50 });
        }
      }

      return () => {
        if (typeof tg.offEvent === 'function') {
          tg.offEvent('safeAreaChanged', tryTelegramSafeArea);
          tg.offEvent('contentSafeAreaChanged', tryTelegramSafeArea);
        }
      };
    } else {
      // Fallback: определяем через User Agent
      const userAgent = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(userAgent)) {
        setPlatform('ios');
        setSafeAreaInsets({ top: 60, bottom: 34 });
      } else if (/Android/.test(userAgent)) {
        setPlatform('android');
        setSafeAreaInsets({ top: 48, bottom: 24 });
      }
    }
  }, []);

  return { platform, safeAreaInsets };
};
