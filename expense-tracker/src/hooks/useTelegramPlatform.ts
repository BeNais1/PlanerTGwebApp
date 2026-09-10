import { useEffect, useState } from 'react';
import type { TelegramWebApp } from '../types/telegram';

interface SafeAreaInsets {
  top: number;
  bottom: number;
}

interface PlatformState {
  platform: string;
  safeAreaInsets: SafeAreaInsets;
}

function getPlatformFallback(platform: string): SafeAreaInsets {
  if (platform === 'ios') return { top: 60, bottom: 34 };
  if (platform === 'android' || platform === 'android_x') return { top: 48, bottom: 24 };
  if (platform === 'macos' || platform === 'tdesktop') return { top: 32, bottom: 20 };
  return { top: 20, bottom: 0 };
}

function readSafeArea(tg: TelegramWebApp, platform: string): SafeAreaInsets {
  const top = (tg.contentSafeAreaInset?.top || 0) + (tg.safeAreaInset?.top || 0);
  const bottom = tg.safeAreaInset?.bottom || 0;
  return top > 0 || bottom > 0
    ? { top: Math.max(top, 20), bottom: Math.max(bottom, 10) }
    : getPlatformFallback(platform);
}

function detectInitialState(): PlatformState {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    const platform = tg.platform || 'unknown';
    return { platform, safeAreaInsets: readSafeArea(tg, platform) };
  }

  const platform = /iPhone|iPad|iPod/.test(navigator.userAgent)
    ? 'ios'
    : /Android/.test(navigator.userAgent)
      ? 'android'
      : 'desktop';
  return { platform, safeAreaInsets: getPlatformFallback(platform) };
}

export const useTelegramPlatform = () => {
  const [state, setState] = useState<PlatformState>(detectInitialState);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    if (typeof tg.requestFullscreen === 'function') tg.requestFullscreen();
    else tg.expand();
    tg.enableClosingConfirmation?.();
    tg.setHeaderColor?.('#000000');
    tg.setBackgroundColor?.('#000000');

    const updateSafeArea = () => {
      const platform = tg.platform || 'unknown';
      setState({ platform, safeAreaInsets: readSafeArea(tg, platform) });
    };

    tg.onEvent?.('safeAreaChanged', updateSafeArea);
    tg.onEvent?.('contentSafeAreaChanged', updateSafeArea);

    return () => {
      tg.offEvent?.('safeAreaChanged', updateSafeArea);
      tg.offEvent?.('contentSafeAreaChanged', updateSafeArea);
    };
  }, []);

  return state;
};
