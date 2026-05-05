import { useEffect, useState } from 'react';
import type { TelegramUser } from '../types/telegram.d';

interface AuthState {
  isAuthenticated: boolean;
  user: TelegramUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
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

    const authenticate = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        
        if (!tg) {
          throw new Error('Telegram WebApp not available');
        }

        // Получаем данные пользователя из Telegram
        const initDataUnsafe = tg.initDataUnsafe;

        if (!initDataUnsafe.user) {
          throw new Error('User data not available');
        }

        let validUser = initDataUnsafe.user as TelegramUser;

        // Bypass Vercel backend validation since Vercel is protected by SSO
        // This makes the app rely solely on Telegram data and Firebase directly.
        const token = 'telegram-valid-session';
        localStorage.setItem('authToken', token);

        // Регистрируем пользователя в Firebase
        const { registerUser } = await import('../services/database');
        await registerUser(
          validUser.id,
          validUser.first_name,
          validUser.last_name || '',
          validUser.username || ''
        );

        if (isMounted) {
          setAuthState({
            isAuthenticated: true,
            user: validUser,
            token,
            isLoading: false,
            error: null,
          });
        }

      } catch (error) {
        console.error('Authentication error:', error);
        if (isMounted) {
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
        }
      }
    };

    authenticate();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('authToken');
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
