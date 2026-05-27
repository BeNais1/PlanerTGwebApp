import { useEffect, useRef } from 'react';

/**
 * Reload an open Web App when Firebase Hosting receives a different build.
 * The query parameter also bypasses Telegram WebView's cached document response.
 */
export const useAutoUpdate = (intervalMs = 15000) => {
  const isReloading = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) return;

        const data: { version?: unknown } = await response.json();
        const deployedVersion = Number(data.version);

        if (
          !Number.isFinite(deployedVersion)
          || deployedVersion === __APP_BUILD_VERSION__
          || !isMounted
          || isReloading.current
        ) return;

        isReloading.current = true;
        console.log(`[AutoUpdate] Build ${__APP_BUILD_VERSION__} is stale; loading ${deployedVersion}.`);

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('appVersion', String(deployedVersion));
        nextUrl.searchParams.set('reloadAt', String(Date.now()));
        window.location.replace(nextUrl.toString());
      } catch (error) {
        console.error('[AutoUpdate] Error checking version:', error);
      }
    };

    void checkVersion();
    const interval = window.setInterval(() => void checkVersion(), intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkVersion);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkVersion);
    };
  }, [intervalMs]);
};
