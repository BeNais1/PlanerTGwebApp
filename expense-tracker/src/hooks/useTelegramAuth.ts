import { useEffect, useState } from 'react';
import { signInWithCustomToken, signOut as signOutFirebase } from 'firebase/auth';
import { auth as firebaseAuth } from '../config/firebase';
import { authenticateWithTelegram } from '../services/auth';
import type { TelegramUser } from '../types/telegram.d';

interface AuthState {
  isAuthenticated: boolean;
  user: TelegramUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const AUTH_STEP_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

export const useTelegramAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    let isFinished = false;

    const finishAuth = (nextState: AuthState) => {
      isFinished = true;
      if (isMounted) {
        setAuthState(nextState);
      }
    };

    const watchdogId = window.setTimeout(() => {
      if (!isMounted || isFinished) return;
      finishAuth({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false,
        error: 'Авторизація триває занадто довго. Закрийте застосунок і відкрийте його знову через /start.',
      });
    }, 16000);

    const authenticate = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        
        if (!tg) {
          // Check if TEST_MODE is enabled for desktop testing
          const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';
          
          if (isTestMode) {
            // Create a test user for desktop development/testing
            const testUser: TelegramUser = {
              id: 999999999,
              first_name: 'Test',
              last_name: 'User',
              username: 'test_dev',
              language_code: 'uk',
            };

            const { registerUser } = await import('../services/database');
            await registerUser(testUser.id, testUser.first_name, testUser.last_name || '', testUser.username || '');

            finishAuth({
              isAuthenticated: true,
              user: testUser,
              token: 'test-desktop-session',
              isLoading: false,
              error: null,
            });
            return;
          }

          throw new Error('Telegram WebApp not available');
        }

        if (!tg.initData) {
          throw new Error('Telegram initData not available');
        }

        const authResponse = await withTimeout(
          authenticateWithTelegram(tg.initData),
          AUTH_STEP_TIMEOUT_MS,
          'Не вдалося підключитися до авторизації. Відкрийте застосунок ще раз.'
        );
        await withTimeout(
          signInWithCustomToken(firebaseAuth, authResponse.firebaseToken),
          AUTH_STEP_TIMEOUT_MS,
          'Firebase авторизація не відповіла. Відкрийте застосунок ще раз.'
        );

        const validUser: TelegramUser = {
          id: authResponse.user.id,
          first_name: authResponse.user.firstName,
          last_name: authResponse.user.lastName,
          username: authResponse.user.username,
          photo_url: authResponse.user.photoUrl,
          language_code: authResponse.user.languageCode,
        };
        const token = authResponse.token;
        localStorage.setItem('authToken', token);

        // Регистрируем пользователя в Firebase
        void import('../services/database')
          .then(({ registerUser }) => registerUser(
            validUser.id,
            validUser.first_name,
            validUser.last_name || '',
            validUser.username || ''
          ))
          .catch((registerError) => {
            console.error('User registration sync failed:', registerError);
          });

        finishAuth({
          isAuthenticated: true,
          user: validUser,
          token,
          isLoading: false,
          error: null,
        });

      } catch (error) {
        console.error('Authentication error:', error);
        finishAuth({
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    };

    authenticate();

    return () => {
      isMounted = false;
      window.clearTimeout(watchdogId);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('authToken');
    void signOutFirebase(firebaseAuth);
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: null,
    });
  };

  return {
    ...authState,
    logout,
  };
};
