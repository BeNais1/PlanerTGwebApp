// Unified Telegram WebApp type declarations

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  platform: string;
  version: string;
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  enableClosingConfirmation?: () => void;
  isExpanded?: boolean;
  initDataUnsafe: {
    user?: TelegramUser;
    [key: string]: unknown;
  };
  initData: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openTelegramLink?: (url: string) => void;
  viewportStableHeight?: number;
  safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
  showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void;
  HapticFeedback?: {
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  openInvoice?: (
    url: string,
    callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void
  ) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}
