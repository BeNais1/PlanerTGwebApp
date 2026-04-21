// Auth hook — Firebase Anonymous Auth for iOS
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { registerUser } from '../services/database';
import React from 'react';

interface AuthUser {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthContextType>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const appUser: AuthUser = {
          id: firebaseUser.uid,
          first_name: 'User',
          username: firebaseUser.uid.substring(0, 8),
        };

        // Register user in Firebase Realtime Database
        try {
          await registerUser(
            appUser.id,
            appUser.first_name,
            appUser.last_name || '',
            appUser.username || ''
          );
        } catch (e) {
          console.error('Failed to register user:', e);
        }

        setState({
          isAuthenticated: true,
          user: appUser,
          isLoading: false,
          error: null,
        });
      } else {
        // No user — sign in anonymously
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Anonymous auth error:', error);
          setState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Auth failed',
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return React.createElement(AuthContext.Provider, { value: state }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
