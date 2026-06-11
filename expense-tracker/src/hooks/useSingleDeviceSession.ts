import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTIVE_SESSION_STALE_MS,
  claimActiveSession,
  releaseActiveSession,
  subscribeToActiveSession,
  updateActiveSessionHeartbeat,
  type ActiveSession,
} from '../services/database';

const DEVICE_ID_KEY = 'expense-tracker-device-id';
const HEARTBEAT_MS = 12000;
const STALE_RETRY_MS = 9000;
const CHECK_TIMEOUT_MS = 8000;

type DeviceSessionStatus = 'idle' | 'checking' | 'active' | 'blocked';

interface DeviceIdentity {
  deviceId: string;
  sessionId: string;
  deviceName: string;
}

export interface DeviceSessionState {
  status: DeviceSessionStatus;
  activeSession: ActiveSession | null;
  isClaiming: boolean;
  error: string | null;
  claimCurrentDevice: () => Promise<void>;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStoredDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const next = createId('device');
    localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return createId('device');
  }
}

function getDeviceName() {
  const telegramPlatform = window.Telegram?.WebApp?.platform;
  if (telegramPlatform) return `Telegram ${telegramPlatform}`;

  const platform = navigator.platform || 'browser';
  return `Browser ${platform}`;
}

function isSameDevice(session: ActiveSession | null, identity: DeviceIdentity) {
  return session?.deviceId === identity.deviceId;
}

function isSessionStale(session: ActiveSession | null) {
  return !session || Date.now() - (session.lastSeenAt || 0) > ACTIVE_SESSION_STALE_MS;
}

export function useSingleDeviceSession(userId: number | null): DeviceSessionState {
  const identity = useMemo<DeviceIdentity>(() => ({
    deviceId: getStoredDeviceId(),
    sessionId: createId('session'),
    deviceName: getDeviceName(),
  }), []);

  const [status, setStatus] = useState<DeviceSessionStatus>('idle');
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestSessionRef = useRef<ActiveSession | null>(null);

  const buildSession = useCallback((): ActiveSession => {
    const now = Date.now();
    return {
      ...identity,
      claimedAt: now,
      lastSeenAt: now,
    };
  }, [identity]);

  const claimCurrentDevice = useCallback(async (force = true) => {
    if (!userId) return;

    setIsClaiming(true);
    setError(null);
    try {
      const claimed = await claimActiveSession(userId, buildSession(), force);
      if (claimed && isSameDevice(claimed, identity)) {
        setActiveSession(claimed);
        setStatus('active');
      }
    } catch (claimError) {
      console.error('Failed to claim active session:', claimError);
      setError('Не вдалося перейти на цей пристрій. Спробуйте ще раз.');
    } finally {
      setIsClaiming(false);
    }
  }, [buildSession, identity, userId]);

  useEffect(() => {
    if (!userId) {
      setStatus('idle');
      setActiveSession(null);
      latestSessionRef.current = null;
      return;
    }

    let disposed = false;
    setStatus('checking');
    setError(null);

    const checkTimeout = window.setTimeout(() => {
      if (disposed) return;

      console.warn('Active session check timed out; continuing without blocking app startup.');
      setStatus('active');
    }, CHECK_TIMEOUT_MS);

    const finishChecking = () => {
      window.clearTimeout(checkTimeout);
    };

    const tryClaimIfFree = async () => {
      try {
        const claimed = await claimActiveSession(userId, buildSession(), false);
        if (disposed) return;
        if (claimed && isSameDevice(claimed, identity)) {
          finishChecking();
          setActiveSession(claimed);
          setStatus('active');
        }
      } catch (claimError) {
        if (!disposed) {
          finishChecking();
          console.error('Failed to check active session:', claimError);
          setError('Не вдалося перевірити активний пристрій.');
          setStatus('active');
        }
      }
    };

    void tryClaimIfFree();

    const unsubscribe = subscribeToActiveSession(userId, (session) => {
      if (disposed) return;

      finishChecking();
      latestSessionRef.current = session;
      setActiveSession(session);

      if (isSameDevice(session, identity)) {
        setStatus('active');
        return;
      }

      if (isSessionStale(session)) {
        void tryClaimIfFree();
        return;
      }

      setStatus('blocked');
    }, (sessionError) => {
      if (disposed) return;

      finishChecking();
      console.error('Active session subscription failed:', sessionError);
      setError('Не вдалося перевірити активний пристрій.');
      setStatus('active');
    });

    return () => {
      disposed = true;
      finishChecking();
      unsubscribe();
    };
  }, [buildSession, identity, userId]);

  useEffect(() => {
    if (!userId || status !== 'active') return;

    const sendHeartbeat = () => {
      void updateActiveSessionHeartbeat(userId, identity.deviceId, identity.sessionId);
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [identity.deviceId, identity.sessionId, status, userId]);

  useEffect(() => {
    if (!userId || status !== 'blocked') return;

    const intervalId = window.setInterval(() => {
      if (isSessionStale(latestSessionRef.current)) {
        void claimCurrentDevice(false);
      }
    }, STALE_RETRY_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [claimCurrentDevice, status, userId]);

  useEffect(() => {
    if (!userId || status !== 'active') return;

    const release = () => {
      void releaseActiveSession(userId, identity.deviceId, identity.sessionId);
    };

    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
    };
  }, [identity.deviceId, identity.sessionId, status, userId]);

  return {
    status,
    activeSession,
    isClaiming,
    error,
    claimCurrentDevice: () => claimCurrentDevice(true),
  };
}
