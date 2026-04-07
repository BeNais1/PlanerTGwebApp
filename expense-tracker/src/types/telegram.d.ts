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
  initDataUnsafe: {
    user?: TelegramUser;
    [key: string]: any;
  };
  initData: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  viewportStableHeight?: number;
  onEvent?: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}
