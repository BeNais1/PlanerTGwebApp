import { useState, useEffect, useMemo } from 'react'
import { HomePage } from './pages/HomePage'
import { TelegramOnlyScreen } from './components/auth/TelegramOnlyScreen'
import { OnboardingWizard } from './components/OnboardingWizard'
import { WalletSetupScreen } from './components/WalletSetupScreen'
import { DeviceSessionScreen } from './components/DeviceSessionScreen'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useAutoUpdate } from './hooks/useAutoUpdate'
import { useSingleDeviceSession } from './hooks/useSingleDeviceSession'
import { getUserSettings, getReceiptShare, getSharedReceipt, getWallets, addWallet, updateUserSettings, isValidShareCode, type ReceiptShare } from './services/database'
import { SharedReceiptView } from './components/SharedReceiptView'
import './App.css'
import './components/auth/TelegramOnlyScreen.css'

function AppContent() {
  const { user, isLoading: authLoading, error: authError } = useAuth();
  const deviceSession = useSingleDeviceSession(user?.id ?? null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [activeShare, setActiveShare] = useState<ReceiptShare | null>(null);
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Check for receipt deep link (either via Telegram start_param or direct URL query)
  useEffect(() => {
    if (authLoading || !user) return;

    const tg = window.Telegram?.WebApp;
    const rawStartParam = tg?.initDataUnsafe?.start_param;
    const startParam = typeof rawStartParam === 'string' ? rawStartParam : '';
    const urlParams = new URLSearchParams(window.location.search);
    const receiptQuery = urlParams.get('receipt');
    
    let shareCode = '';
    if (startParam && startParam.startsWith('receipt_')) {
      shareCode = startParam.replace('receipt_', '');
    } else if (receiptQuery) {
      shareCode = receiptQuery;
    }

    if (shareCode) {
      if (!isValidShareCode(shareCode)) {
        setReceiptError('Некоректне посилання на чек.');
        return;
      }

      setCheckingReceipt(true);
      // Try new system first, then fall back to legacy
      getReceiptShare(shareCode).then(async (share) => {
        if (share) {
          if (!share.isActive) {
            setReceiptError('Це посилання було вимкнено автором.');
          } else {
            setActiveShare(share);
          }
        } else {
          // Fallback: try old shared_receipts (legacy)
          const legacy = await getSharedReceipt(shareCode);
          if (legacy) {
            // Convert legacy to ReceiptShare-like object
            const fakeShare: ReceiptShare = {
              id: legacy.id,
              receiptId: '',
              ownerId: legacy.creatorId,
              shareCode: legacy.id,
              isActive: true,
              privacyMode: 'anonymous',
              transaction: legacy.transaction,
              createdAt: legacy.createdAt,
              updatedAt: legacy.createdAt,
            };
            setActiveShare(fakeShare);
          }
        }
        setCheckingReceipt(false);
      }).catch(err => {
        console.error(err);
        setCheckingReceipt(false);
      });
    }
  }, [authLoading, user]);

  // Check onboarding status once user is authenticated
  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;

      console.warn('Onboarding check timed out; opening app shell.');
      setOnboardingDone((current) => current ?? true);
      setWalletReady((current) => current ?? true);
      setCheckingOnboarding(false);
    }, 10000);

    (async () => {
      try {
        const [settings, wallets] = await Promise.all([
          getUserSettings(user.id),
          getWallets(user.id),
        ]);
        if (!cancelled) {
          const onboardingCompleted = settings.onboardingCompleted === true;
          setOnboardingDone(onboardingCompleted);
          setWalletReady(wallets.length > 0);

          // Apply saved theme
          const savedTheme = settings.theme || localStorage.getItem('app-theme') || 'dark';
          document.documentElement.setAttribute('data-theme', savedTheme);
          localStorage.setItem('app-theme', savedTheme);

          // Update Telegram header colors to match theme
          try {
            const tg = window.Telegram?.WebApp;
            if (tg) {
              const headerColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
              const bgColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
              if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
              if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
            }
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error('Error checking onboarding:', err);
        if (!cancelled) {
          setOnboardingDone(false);
          setWalletReady(false);
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setCheckingOnboarding(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [user]);

  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
  };

  const handleWalletCreated = async (name: string, currency: string, balance: number) => {
    if (!user) return;
    const walletId = await addWallet(user.id, { name, currency, balance, createdAt: Date.now() });
    await updateUserSettings(user.id, { currency, mainWalletId: walletId });
    setWalletReady(true);
  };

  if (authLoading || checkingReceipt) {
    return (
      <div className="phone-frame">
        <div style={{ margin: 'auto', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
          Завантаження...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="phone-frame">
        <div style={{
          margin: 'auto',
          maxWidth: '320px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Не вдалося відкрити застосунок
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.45, marginBottom: '18px' }}>
            {authError || 'Авторизація Telegram не завершилась.'}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: '14px',
              padding: '12px 18px',
              background: 'var(--accent)',
              color: 'white',
              fontWeight: 700,
            }}
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  if (user && deviceSession.status === 'blocked') {
    return (
      <DeviceSessionScreen
        activeSession={deviceSession.activeSession}
        isClaiming={deviceSession.isClaiming}
        error={deviceSession.error}
        onTransfer={deviceSession.claimCurrentDevice}
      />
    );
  }

  // Show loading while checking onboarding after this device owns the session
  if (checkingOnboarding) {
    return (
      <div className="phone-frame">
        <div style={{ margin: 'auto', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
          Завантаження...
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (user && onboardingDone === false) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  // Show wallet setup if onboarding done but no wallets yet
  if (user && onboardingDone === true && walletReady === false) {
    return <WalletSetupScreen onComplete={handleWalletCreated} />;
  }

  return (
    <>
      <HomePage />
      {activeShare && (
        <SharedReceiptView share={activeShare} onClose={() => setActiveShare(null)} />
      )}
      {receiptError && (
        <div className="shared-receipt-overlay">
          <div style={{
            background: 'var(--card-bg)', borderRadius: '24px', padding: '32px 24px',
            textAlign: 'center', maxWidth: '320px', margin: '0 20px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Посилання недоступне
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {receiptError}
            </p>
            <button
              onClick={() => setReceiptError('')}
              style={{
                padding: '12px 32px', borderRadius: '14px', border: 'none',
                background: 'var(--accent)', color: 'white', fontWeight: 600,
                fontSize: '15px', cursor: 'pointer',
              }}
            >
              Зрозуміло
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  // Reload any open Mini App shortly after a new hosting build is deployed.
  useAutoUpdate();

  const isTelegramWebApp = useMemo(() => {
    const tg = window.Telegram?.WebApp;
    
    if (!tg) {
      return false;
    }

    const platform = (tg.platform || '').toLowerCase();
    const isMobileTelegram = platform === 'ios' || platform === 'android' || platform === 'android_x';
    
    // Дозволяємо тільки мобільний Telegram. Desktop/Web показують екран з підказкою.
    if (!isMobileTelegram) {
      return false;
    }
    
    return true;
  }, []);

  if (!isTelegramWebApp) {
    return <TelegramOnlyScreen />;
  }

  // Expand the Telegram WebApp to maximum height
  try {
    const tg = window.Telegram?.WebApp;
    if (tg && !tg.isExpanded) {
      tg.expand();
    }
  } catch (e) {
    console.error('Failed to expand Telegram WebApp:', e);
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
