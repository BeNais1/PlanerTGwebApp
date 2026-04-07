// API Configuration
export const API_CONFIG = {
  // Замените на URL вашего backend после деплоя на Vercel
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  TIMEOUT: 10000,
};

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    TELEGRAM: '/api/auth/telegram',
    VERIFY: '/api/auth/verify',
  },
  USER: {
    PROFILE: '/api/user/profile',
  },
  TRANSACTIONS: {
    LIST: '/api/transactions',
    CREATE: '/api/transactions',
    UPDATE: (id: string) => `/api/transactions/${id}`,
    DELETE: (id: string) => `/api/transactions/${id}`,
  },
};
