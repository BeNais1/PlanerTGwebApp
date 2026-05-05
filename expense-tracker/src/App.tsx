import { useState, useEffect, useMemo } from 'react'
import { HomePage } from './pages/HomePage'
import { TelegramOnlyScreen } from './components/auth/TelegramOnlyScreen'
import { OnboardingWizard } from './components/OnboardingWizard'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useAutoUpdate } from './hooks/useAutoUpdate'
import { getUserSettings, getReceiptShare, getSharedReceipt, type ReceiptShare } from './services/database'
import { SharedReceiptView } from './components/SharedReceiptView'
import './App.css'
import './components/auth/TelegramOnlyScreen.css'

function AppContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [activeShare, setActiveShare] = useState<ReceiptShare | null>(null);
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Check for receipt deep link (either via Telegram start_param or direct URL query)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param;
    const urlParams = new URLSearchParams(window.location.search);
    const receiptQuery = urlParams.get('receipt');
    
    let shareCode = '';
    if (startParam && startParam.startsWith('receipt_')) {
      shareCode = startParam.replace('receipt_', '');
    } else if (receiptQuery) {
      shareCode = receiptQuery;
    }

    if (shareCode) {
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
  }, []);

  // Check onboarding status once user is authenticated
  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const settings = await getUserSettings(user.id);
        if (!cancelled) {
          setOnboardingDone(settings.onboardingCompleted === true);

          // Apply saved theme
          const savedTheme = settings.theme || localStorage.getItem('app-theme') || 'dark';
          document.documentElement.setAttribute('data-theme', savedTheme);
          localStorage.setItem('app-theme', savedTheme);

          // Update Telegram header colors to match theme
          try {
            const tg = (window as any).Telegram?.WebApp;
            if (tg) {
              const headerColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
              const bgColor = savedTheme === 'light' ? '#F2F2F7' : '#000000';
              if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
              if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
            }
          } catch (e) { /* ignore */ }
        }
      } catch (err) {
        console.error('Error checking onboarding:', err);
        if (!cancelled) setOnboardingDone(false);
      } finally {
        if (!cancelled) setCheckingOnboarding(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
  };

  // Show loading while checking auth or onboarding or receipt
  if (authLoading || checkingOnboarding || checkingReceipt) {
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
  // Bug #1 fix: memoize the Telegram check so it doesn't re-run on every render
  const isTelegramWebApp = useMemo(() => {
    const tg = window.Telegram?.WebApp;
    
    if (!tg) {
      return false;
    }
    
    const platform = tg.platform;
    
    // Блокуємо невідомі та веб-версії
    if (platform === 'unknown' || platform === 'web' || platform === 'weba') {
      return false;
    }
    
    // Дозволяємо мобільні платформи та десктоп-клієнти Telegram
    return platform === 'ios' || platform === 'android' || platform === 'tdesktop' || platform === 'macos';
  }, []);

  // Bug #5 fix: auto-update checks still run, but the hook is safe to call
  // unconditionally — it simply fetches /version.json which is harmless
  useAutoUpdate();

  if (!isTelegramWebApp) {
    return <TelegramOnlyScreen />;
  }

  // Expand the Telegram WebApp to maximum height
  try {
    const tg: any = window.Telegram?.WebApp;
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
