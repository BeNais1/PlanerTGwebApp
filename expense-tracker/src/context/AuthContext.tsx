import type { ReactNode } from 'react';
import { useTelegramAuth } from '../hooks/useTelegramAuth';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useTelegramAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};
