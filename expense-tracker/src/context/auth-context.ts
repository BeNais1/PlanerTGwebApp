import { createContext } from 'react';
import type { TelegramUser } from '../types/telegram';

export interface AuthContextValue {
  isAuthenticated: boolean;
  user: TelegramUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
