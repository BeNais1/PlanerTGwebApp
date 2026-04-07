import { apiClient } from './api';
import { API_ENDPOINTS } from '../config/api';

interface TelegramAuthResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    username: string;
    photoUrl: string;
    languageCode: string;
  };
}

interface VerifyTokenResponse {
  success: boolean;
  user: {
    id: number;
    username: string;
    firstName: string;
  };
}

/**
 * Авторизация через Telegram Web App
 */
export async function authenticateWithTelegram(
  initData: string
): Promise<TelegramAuthResponse> {
  return apiClient.post<TelegramAuthResponse>(
    API_ENDPOINTS.AUTH.TELEGRAM,
    { initData },
    false // не требует авторизации
  );
}

/**
 * Проверка валидности токена
 */
export async function verifyToken(): Promise<VerifyTokenResponse> {
  return apiClient.get<VerifyTokenResponse>(
    API_ENDPOINTS.AUTH.VERIFY,
    true // требует авторизации
  );
}

/**
 * Выход из системы
 */
export function logout(): void {
  localStorage.removeItem('authToken');
}
