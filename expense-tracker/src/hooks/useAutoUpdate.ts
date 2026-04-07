import { useEffect, useRef } from 'react';

/**
 * Hook to automatically check for app updates and reload if a new version is detected.
 * Checks for a /version.json file with a timestamp.
 */
export const useAutoUpdate = (intervalMs = 300000) => { // Default check every 5 minutes
  const initialVersion = useRef<number | null>(null);

  const checkVersion = async () => {
    try {
      // Use cache-busting to ensure we get the fresh version from the server
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const currentVersion = data.version;

      if (initialVersion.current === null) {
        initialVersion.current = currentVersion;
        console.log(`[AutoUpdate] Initialized version: ${initialVersion.current}`);
      } else if (currentVersion > initialVersion.current) {
        console.log(`[AutoUpdate] New version detected (${currentVersion} > ${initialVersion.current}). Reloading...`);
        // Use true for a complete reload (ignoring cache)
        window.location.reload();
      }
    } catch (error) {
      console.error('[AutoUpdate] Error checking version:', error);
    }
  };

  useEffect(() => {
    // Initial check on mount
    checkVersion();

    // Set up polling interval
    const interval = setInterval(checkVersion, intervalMs);

    // Also check when the user returns to the app (visibility change)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
};
