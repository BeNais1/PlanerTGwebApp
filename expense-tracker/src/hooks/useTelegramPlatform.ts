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
      
      // Включаем подтверждение при закрытии, чтобы не потерять данные
      if (typeof tg.enableClosingConfirmation === 'function') tg.enableClosingConfirmation();
      
      // Устанавливаем цвета заголовка и фона под Apple стиль
      if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#000000');
      if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#000000');

      const detectedPlatform = tg.platform;
      setPlatform(detectedPlatform);

      // Разные отступы для разных платформ
      if (detectedPlatform === 'ios') {
        setSafeAreaInsets({ top: 60, bottom: 34 });
      } else if (detectedPlatform === 'android') {
        setSafeAreaInsets({ top: 24, bottom: 24 });
      } else if (detectedPlatform === 'macos' || detectedPlatform === 'tdesktop') {
        setSafeAreaInsets({ top: 20, bottom: 20 });
      } else {
        setSafeAreaInsets({ top: 50, bottom: 50 });
      }
    } else {
      // Fallback: определяем через User Agent если Telegram API недоступен
      const userAgent = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(userAgent)) {
        setPlatform('ios');
        setSafeAreaInsets({ top: 60, bottom: 34 });
      } else if (/Android/.test(userAgent)) {
        setPlatform('android');
        setSafeAreaInsets({ top: 24, bottom: 24 });
      }
    }
  }, []);

  return { platform, safeAreaInsets };
};
