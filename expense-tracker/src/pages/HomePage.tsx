import { useState, useEffect, useMemo, useRef, type TouchEvent } from "react";
import { ArrowDown } from "../components/icons/ArrowDown";
import { ArrowTop } from "../components/icons/ArrowTop";
import { SettingsIcon } from "../components/icons/SettingsIcon";
import { HomeIcon } from "../components/icons/HomeIcon";
import { HistoryIcon } from "../components/icons/HistoryIcon";
import { BookmarkIcon } from "../components/icons/BookmarkIcon";
import { AnalyticsIcon } from "../components/icons/AnalyticsIcon";
import { JointCheckIcon } from "../components/icons/JointCheckIcon";
import { SearchIcon } from "../components/icons/SearchIcon";
import { PaymentIcon } from "../components/PaymentIcon";
import { useTelegramPlatform } from "../hooks/useTelegramPlatform";
import { useKeyboardSafe } from "../hooks/useKeyboardSafe";
import { useAuth } from "../context/AuthContext";
import { useCurrency, type Currency } from "../hooks/useCurrency";
import { useCategories } from "../hooks/useCategories";
import {
  getCurrentMonth,
  subscribeToMonthlyBalance,
  subscribeToTransactions,
  setMonthlyBalance,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addWalletBalance,
  deleteWalletData,
  subscribeToUserSettings,
  updateUserSettings,
  type Transaction,
  type MonthData,
  type UserSettings
} from "../services/database";

import { SpendModal } from "../components/modals/SpendModal";
import { AddModal } from "../components/modals/AddModal";
import { SetBalanceModal } from "../components/modals/SetBalanceModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { HistoryModal } from "../components/modals/HistoryModal";
import { QuickSpendModal } from "../components/modals/QuickSpendModal";
import { TransactionDetailModal } from "../components/modals/TransactionDetailModal";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AnalyticsView } from "../components/AnalyticsView";
import { NumericKeypad, getKeypadNumericValue } from "../components/NumericKeypad";
import { SavedReceiptsView } from "../components/SavedReceiptsView";
import { SharedReceiptView } from "../components/SharedReceiptView";
import { FinancialHubView } from "../components/FinancialHubView";
import { JointCheckCreateModal } from "../components/JointCheckCreateModal";
import { JointCheckDetailModal } from "../components/JointCheckDetailModal";
import { UserQrSheet } from "../components/UserQrSheet";
import type { ReceiptShare } from "../services/database";
import "../components/JointCheck.css";

const CARD_GRADIENTS: Record<string, string> = {
  EUR: 'linear-gradient(135deg, #1e3a6e 0%, #2563eb 100%)',
  USD: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
  UAH: 'linear-gradient(135deg, #3b1f0d 0%, #b45309 100%)',
};

export const HomePage = () => {
  const [activeNav, setActiveNav] = useState(0);
  const { safeAreaInsets } = useTelegramPlatform();
  useKeyboardSafe();
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS, EXCHANGE_RATES, walletNames } = useCurrency();
  const { names: CATEGORY_NAMES } = useCategories();
  const currentMonth = getCurrentMonth();

  // State
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [budgetLimitStartDate, setBudgetLimitStartDate] = useState<number | null | undefined>();
  const [budgetLimitPeriod, setBudgetLimitPeriod] = useState<'day' | 'week' | 'month'>('month');

  // Modals state
  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQuickSpendOpen, setIsQuickSpendOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTxActionLoading, setIsTxActionLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [limitIncludePriorInput, setLimitIncludePriorInput] = useState(true);
  const [limitPeriodInput, setLimitPeriodInput] = useState<'day' | 'week' | 'month'>('month');
  const [viewingShare, setViewingShare] = useState<ReceiptShare | null>(null);
  const [isJointCheckOpen, setIsJointCheckOpen] = useState(false);
  const [jointCheckId, setJointCheckId] = useState<string | null>(null);
  const [isUserQrOpen, setIsUserQrOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [pullQrDistance, setPullQrDistance] = useState(0);
  const [activeWallet, setActiveWallet] = useState(0);
  const cardsScrollRef = useRef<HTMLDivElement>(null);
  // Wallet management from home screen
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [newWalletCurrency, setNewWalletCurrency] = useState<Currency>('USD');
  const [newWalletAmount, setNewWalletAmount] = useState('');
  const [editingName, setEditingName] = useState('');
  const [menuCur, setMenuCur] = useState<Currency | null>(null);
  const [menuStep, setMenuStep] = useState<'main' | 'rename' | 'delete'>('main');

  const navItems = [
    { icon: <HomeIcon />, id: 0 },
    { icon: <HistoryIcon />, id: 1 },
    { icon: <BookmarkIcon />, id: 2 },
    { icon: <AnalyticsIcon />, id: 3 },
  ];

  useEffect(() => {
    document.documentElement.style.setProperty('--safe-area-top', `${safeAreaInsets.top}px`);
    document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaInsets.bottom}px`);
  }, [safeAreaInsets]);

  // Load data from Firebase
  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;

    const unsubBalance = subscribeToMonthlyBalance(user.id, currentMonth, (data) => {
      if (isSubscribed) {
        setMonthData(data);
        setIsDataLoaded(true);
      }
    });

    const unsubTx = subscribeToTransactions(user.id, currentMonth, (txs) => {
      if (isSubscribed) {
        setTransactions(txs);
      }
    });

    const unsubSettings = subscribeToUserSettings(user.id, (settings: UserSettings) => {
      if (isSubscribed) {
        setBudgetLimit(settings.budgetLimit || 0);
        setBudgetLimitStartDate(settings.budgetLimitStartDate);
        setBudgetLimitPeriod(settings.budgetLimitPeriod || 'month');
        setLimitPeriodInput(settings.budgetLimitPeriod || 'month');
      }
    });

    return () => {
      isSubscribed = false;
      unsubBalance();
      unsubTx();
      unsubSettings();
    };
  }, [user, currentMonth]);

  // Calculations — Bug #4 fix: handle all currencies for initialBalance
  const walletBalances: Record<string, number> = {};
  if (monthData) {
    // Legacy initialBalance — add to EUR
    if (monthData.initialBalance) {
      walletBalances['EUR'] = monthData.initialBalance;
    }
    // Modern multi-currency balances
    if (monthData.balances) {
      Object.entries(monthData.balances).forEach(([cur, amount]) => {
        walletBalances[cur] = (walletBalances[cur] || 0) + amount;
      });
    }
  }
  if (Object.keys(walletBalances).length === 0) {
    walletBalances[mainCurrency] = 0;
  }

  transactions.filter(t => !t.excludeFromBalance).forEach(t => {
    const cur = t.currency || mainCurrency;
    if (walletBalances[cur] === undefined) walletBalances[cur] = 0;
    if (t.type === 'expense') walletBalances[cur] -= t.amount;
    if (t.type === 'income') walletBalances[cur] += t.amount;
  });

  let currentBalance = 0;
  Object.entries(walletBalances).forEach(([cur, amount]) => {
    currentBalance += convertToMain(amount, cur as Currency);
  });

  // Calculate total expenses for the selected period (in main currency) for Bubble
  const periodExpenses = useMemo(() => {
    let periodStart = 0;
    const now = new Date();
    
    if (budgetLimitPeriod === 'day') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (budgetLimitPeriod === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      periodStart = new Date(d.setDate(diff)).setHours(0,0,0,0);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    return transactions
      .filter(t => {
        if (t.excludeFromBalance) return false;
        if (t.type !== 'expense') return false;
        if (t.date < periodStart) return false;
        if (budgetLimitStartDate && t.date < budgetLimitStartDate) return false;
        return true;
      })
      .reduce((acc, t) => acc + convertToMain(t.amount, (t.currency || mainCurrency) as Currency), 0);
  }, [transactions, mainCurrency, convertToMain, budgetLimitStartDate, budgetLimitPeriod]);

  // Handlers
  const handleSetInitialBalance = async (amount: number, currency: Currency = mainCurrency) => {
    if (!user) return;
    setIsSaving(true);
    await setMonthlyBalance(user.id, currentMonth, amount, currency);
    setIsSaving(false);
  };

  const handleSpend = async (amount: number, category: string, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await addTransaction(user.id, {
        type: 'expense', amount, category, description,
        date: Date.now(), month: currentMonth, currency
      });
      setIsSpendOpen(false);
    } catch (error) {
      console.error('Failed to add spend transaction:', error);
      alert('Помилка при додаванні видатків. Спробуйте ще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (amount: number, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await addTransaction(user.id, {
        type: 'income', amount, category: 'income', description,
        date: Date.now(), month: currentMonth, currency
      });
      setIsAddOpen(false);
    } catch (error) {
      console.error('Failed to add income transaction:', error);
      alert('Помилка при додаванні доходу. Спробуйте ще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickSpend = async (amount: number, category: string, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await addTransaction(user.id, {
        type: 'expense', amount, category, description,
        date: Date.now(), month: currentMonth, currency
      });
      setIsQuickSpendOpen(false);
    } catch (error) {
      console.error('Failed to add quick spend transaction:', error);
      alert('Помилка при додаванні видатків. Спробуйте ще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    setIsTxActionLoading(true);
    try {
      await deleteTransaction(user.id, id);
      setSelectedTx(null);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Помилка при видаленні транзакції. Спробуйте ще раз.');
    } finally {
      setIsTxActionLoading(false);
    }
  };

  const handleUpdateTransaction = async (id: string, data: Partial<Transaction>) => {
    if (!user) return;
    setIsTxActionLoading(true);
    try {
      await updateTransaction(user.id, id, data);
      setSelectedTx(prev => prev && prev.id === id ? { ...prev, ...data } : prev);
    } catch (error) {
      console.error('Failed to update transaction:', error);
      alert('Помилка при оновленні транзакції. Спробуйте ще раз.');
    } finally {
      setIsTxActionLoading(false);
    }
  };

  const handleSetBudgetLimit = async () => {
    if (!user) return;
    const num = getKeypadNumericValue(limitInput);
    if (num > 0) {
      await updateUserSettings(user.id, { 
        budgetLimit: num,
        budgetLimitPeriod: limitPeriodInput,
        budgetLimitIncludePrior: limitIncludePriorInput,
        budgetLimitStartDate: limitIncludePriorInput ? null : Date.now()
      } as any);
      setShowLimitModal(false);
      setLimitInput('');
      setLimitIncludePriorInput(true);
    }
  };

  const handleOpenTransaction = (transaction: Transaction) => {
    if (transaction.jointCheckId) {
      setJointCheckId(transaction.jointCheckId);
      return;
    }
    setSelectedTx(transaction);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (activeNav !== 0) return;
    if (
      isSpendOpen ||
      isAddOpen ||
      isSettingsOpen ||
      isHistoryOpen ||
      isQuickSpendOpen ||
      isJointCheckOpen ||
      selectedTx ||
      jointCheckId ||
      viewingShare
    ) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"], .modal-overlay, .payment-list, .payment-history')) return;
    const touch = event.touches[0];
    if (window.innerHeight - touch.clientY < 24) return;
    setTouchStartY(touch.clientY);
    setPullQrDistance(0);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (activeNav !== 0) return;
    if (touchStartY === null) return;
    const distance = Math.max(0, touchStartY - event.touches[0].clientY);
    if (distance < 10) return;
    setPullQrDistance(Math.min(136, distance));
  };

  const handleTouchEnd = () => {
    if (pullQrDistance > 72) setIsUserQrOpen(true);
    setTouchStartY(null);
    setPullQrDistance(0);
  };

  const handleWalletCurrencyChange = async (newCurrency: Currency) => {
    if (!user) return;
    await updateUserSettings(user.id, { currency: newCurrency });
  };

  const handleWalletSaveName = async (c: Currency) => {
    if (!user) return;
    await updateUserSettings(user.id, { walletNames: { ...walletNames, [c]: editingName } });
    setMenuCur(null);
    setMenuStep('main');
  };

  const handleWalletDelete = async (c: Currency) => {
    if (!user) return;
    await deleteWalletData(user.id, currentMonth, c);
    setMenuCur(null);
    setMenuStep('main');
  };

  const handleWalletAdd = async () => {
    if (!user || !newWalletAmount) return;
    const amount = parseFloat(newWalletAmount);
    if (!isNaN(amount) && amount > 0) {
      await addWalletBalance(user.id, currentMonth, newWalletCurrency, amount);
      setIsAddingWallet(false);
      setNewWalletAmount('');
    }
  };

  const convertDirect = (amount: number, from: Currency, to: Currency) => {
    const inEur = amount / EXCHANGE_RATES[from];
    return inEur * EXCHANGE_RATES[to];
  };

  const ALL_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

  const monthName = new Date().toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
  const getIndicatorLeft = () => `calc(4px + ${activeNav} * (100% - 8px) / 4)`;

  const todayDateStr = new Date().toLocaleDateString();
  const todaysTransactions = transactions.filter(t => new Date(t.date).toLocaleDateString() === todayDateStr);

  if (!isDataLoaded) {
    return (
      <div className="phone-frame">
        <div style={{ margin: 'auto', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
          Завантаження...
        </div>
      </div>
    );
  }

  return (
    <div
      className="phone-frame"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Modals */}
      {(monthData === null || monthData === undefined) && <SetBalanceModal onSetBalance={handleSetInitialBalance} isLoading={isSaving} />}
      {isSpendOpen && <SpendModal onClose={() => setIsSpendOpen(false)} onSpend={handleSpend} isLoading={isSaving} walletBalances={walletBalances} />}
      {isAddOpen && <AddModal onClose={() => setIsAddOpen(false)} onAdd={handleAdd} isLoading={isSaving} walletBalances={walletBalances} />}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} walletBalances={walletBalances} />}
      {isHistoryOpen && <HistoryModal onClose={() => setIsHistoryOpen(false)} walletBalances={walletBalances} />}
      {isQuickSpendOpen && <QuickSpendModal onClose={() => setIsQuickSpendOpen(false)} onSpend={handleQuickSpend} isLoading={isSaving} walletBalances={walletBalances} />}
      {isJointCheckOpen && <JointCheckCreateModal onClose={() => setIsJointCheckOpen(false)} walletBalances={walletBalances} />}
      {selectedTx && (
        <TransactionDetailModal 
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onDelete={handleDeleteTransaction}
          onUpdate={handleUpdateTransaction}
          isLoading={isTxActionLoading}
          walletBalances={walletBalances}
        />
      )}
      {jointCheckId && (
        <JointCheckDetailModal jointCheckId={jointCheckId} onClose={() => setJointCheckId(null)} />
      )}
      {isUserQrOpen && <UserQrSheet onClose={() => setIsUserQrOpen(false)} />}
      {pullQrDistance > 12 && (
        <div className="pull-qr-indicator" style={{ opacity: Math.min(1, pullQrDistance / 72) }}>
          {pullQrDistance > 72 ? 'Відпустіть, щоб відкрити QR-код' : 'Потягніть вище, щоб відкрити QR-код'}
        </div>
      )}

      <div className="pull-qr-reveal" style={{ opacity: Math.min(1, pullQrDistance / 86) }}>
        <button type="button" style={{ transform: `translateY(${Math.max(0, 28 - pullQrDistance * 0.32)}px) scale(${0.92 + Math.min(0.08, pullQrDistance / 900)})` }}>
          {pullQrDistance > 72 ? 'Відпустіть, щоб відкрити QR-код' : 'Показати QR-код'}
        </button>
      </div>

      {/* Budget Limit Set Modal */}
      {showLimitModal && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLimitModal(false); }}
        >
          <div className="modal-content" style={{ gap: '16px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Місячний ліміт</h2>
              <div className="modal-close" onClick={() => setShowLimitModal(false)}>✕</div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
              Скільки ви хочете максимально витратити цього місяця?
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card-bg-2)', borderRadius: '14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>Враховувати минулі витрати</span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={limitIncludePriorInput} 
                  onChange={(e) => setLimitIncludePriorInput(e.target.checked)} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              {(['day', 'week', 'month'] as const).map(period => (
                <button key={period} onClick={() => setLimitPeriodInput(period)} style={{
                  flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px',
                  background: limitPeriodInput === period ? 'var(--accent)' : 'var(--card-bg-2)',
                  color: limitPeriodInput === period ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease'
                }}>
                  {period === 'day' ? 'День' : period === 'week' ? 'Тиждень' : 'Місяць'}
                </button>
              ))}
            </div>

            <NumericKeypad
              value={limitInput}
              onChange={setLimitInput}
              currencySymbol={CURRENCY_SYMBOLS[mainCurrency]}
              onSubmit={handleSetBudgetLimit}
              submitLabel="Встановити"
            />

            {budgetLimit > 0 && (
              <button
                className="modal-btn-primary"
                style={{ background: 'var(--card-bg-2)', color: 'var(--danger)', marginTop: '-8px' }}
                onClick={async () => {
                  if (user) {
                    await updateUserSettings(user.id, { budgetLimit: 0 });
                    setShowLimitModal(false);
                  }
                }}
              >
                Прибрати ліміт
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="app-lift-content"
        style={{
          transform: `translateY(${-pullQrDistance}px)`,
          transition: touchStartY === null ? 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
        }}
      >
      {/* Full-screen views */}
      <AnalyticsView 
        walletBalances={walletBalances}
        mainCurrency={mainCurrency}
        isActive={activeNav === 3}
      />

      <FinancialHubView
        isActive={activeNav === 1}
        walletBalances={walletBalances}
        onOpenReceipt={(share) => setViewingShare(share)}
        onOpenTransaction={handleOpenTransaction}
      />

      <SavedReceiptsView
        isActive={activeNav === 2}
        onOpenReceipt={(share) => setViewingShare(share)}
      />

      {viewingShare && (
        <SharedReceiptView share={viewingShare} onClose={() => setViewingShare(null)} />
      )}

      <div style={{ display: (activeNav === 3 || activeNav === 1 || activeNav === 2) ? 'none' : 'contents' }}>
      {/* Header */}
      <div className="header">
        <span className="month-label">{monthName}</span>
        <div className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
          <SettingsIcon />
        </div>
      </div>

      {/* Wallet Cards Carousel */}
      {(() => {
        // Main wallet always first
        const sortedEntries = Object.entries(walletBalances).sort(([a]) => a === mainCurrency ? -1 : 1);
        const totalSlides = sortedEntries.length + 1; // +1 for "+" card

        return (
          <div className="wallet-cards-section">
            <div
              className="wallet-cards-track"
              ref={cardsScrollRef}
              onScroll={() => {
                if (!cardsScrollRef.current) return;
                const el = cardsScrollRef.current;
                setActiveWallet(Math.round(el.scrollLeft / el.offsetWidth));
              }}
            >
              {sortedEntries.map(([cur, amount]) => (
                <div key={cur} className="wallet-card-slide">
                  <div className="wallet-card" style={{ background: CARD_GRADIENTS[cur] ?? CARD_GRADIENTS['EUR'] }}>
                    <div className="wallet-card-deco" style={{ width: 140, height: 140, right: -28, top: -28, background: 'rgba(255,255,255,0.08)' }} />
                    <div className="wallet-card-deco" style={{ width: 90, height: 90, right: 50, bottom: -36, background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                      <span style={{ fontSize: '14px', fontWeight: 650, opacity: 0.85 }}>
                        {walletNames[cur] || `Гаманець ${cur}`}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuCur(cur as Currency); setMenuStep('main'); setEditingName(walletNames[cur] || `Гаманець ${cur}`); }}
                        style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '8px', padding: '3px 10px', color: 'white', fontSize: '18px', cursor: 'pointer', lineHeight: 1, letterSpacing: '2px' }}
                      >
                        ···
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
                        <AnimatedNumber value={amount} formatter={(v) => formatValue(v, cur as Currency)} />
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                        {ALL_CURRENCIES.filter(oc => oc !== cur).map(oc => (
                          <span key={oc} style={{ fontSize: '12px', opacity: 0.6 }}>
                            ≈ {convertDirect(amount, cur as Currency, oc).toLocaleString('en-US', { maximumFractionDigits: 0 })} {CURRENCY_SYMBOLS[oc]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* "+" card */}
              <div className="wallet-card-slide">
                <button
                  onClick={() => setIsAddingWallet(true)}
                  style={{
                    width: '100%', height: '168px', border: '2px dashed var(--card-bg-3)',
                    borderRadius: '24px', background: 'var(--card-bg)',
                    color: 'var(--accent)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '32px', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Додати гаманець</span>
                </button>
              </div>
            </div>

            {/* Dots */}
            <div className="wallet-dots">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div key={i} className={`wallet-dot ${activeWallet === i ? 'active' : ''}`} style={{ width: activeWallet === i ? 18 : 6 }} />
              ))}
            </div>

            {/* Add wallet form */}
            {isAddingWallet && (
              <div style={{ padding: '10px 16px 0' }}>
                <div style={{ background: 'var(--card-bg)', borderRadius: '18px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Новий гаманець</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={newWalletCurrency} onChange={e => setNewWalletCurrency(e.target.value as Currency)}
                      style={{ background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none', fontFamily: 'var(--font-text)' }}>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="UAH">UAH</option>
                    </select>
                    <input type="number" placeholder="Сума" value={newWalletAmount} onChange={e => setNewWalletAmount(e.target.value)}
                      style={{ flex: 1, background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none', fontFamily: 'var(--font-text)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setIsAddingWallet(false)}
                      style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-text)' }}>
                      Скасувати
                    </button>
                    <button onClick={handleWalletAdd} disabled={!newWalletAmount}
                      style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: newWalletAmount ? 1 : 0.4, fontFamily: 'var(--font-text)' }}>
                      Додати
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Budget Progress Bar */}
      {budgetLimit > 0 ? (
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Ліміт {budgetLimitPeriod === 'day' ? 'на день' : budgetLimitPeriod === 'week' ? 'на тиждень' : 'на місяць'}
              </span>
              <button onClick={() => setShowLimitModal(true)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Змінити
              </button>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--card-bg-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (periodExpenses / budgetLimit) * 100)}%`, background: periodExpenses >= budgetLimit ? 'var(--danger)' : 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{formatValue(periodExpenses)}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>з {formatValue(budgetLimit)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '4px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowLimitModal(true)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
            + Встановити ліміт
          </button>
        </div>
      )}

      {/* Wallet menu overlay */}
      {menuCur && (
        <div className="modal-overlay" style={{ zIndex: 200, alignItems: 'flex-end', padding: '16px' }} onClick={() => { setMenuCur(null); setMenuStep('main'); }}>
          <div style={{ width: '100%', background: 'var(--card-bg)', borderRadius: '20px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={e => e.stopPropagation()}>
            {menuStep === 'main' && (<>
              <button onClick={() => setMenuStep('rename')} style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', background: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-text)' }}>
                ✎ Перейменувати
              </button>
              {menuCur !== mainCurrency && (
                <button onClick={() => { handleWalletCurrencyChange(menuCur); setMenuCur(null); }} style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', background: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-text)' }}>
                  ⭐ Зробити головним
                </button>
              )}
              <button onClick={() => setMenuStep('delete')} style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', background: 'none', color: 'var(--danger)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-text)' }}>
                🗑 Видалити гаманець
              </button>
            </>)}
            {menuStep === 'rename' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, paddingLeft: '4px' }}>Нова назва</span>
                <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', background: 'var(--card-bg-2)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', fontFamily: 'var(--font-text)' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setMenuStep('main')} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Назад</button>
                  <button onClick={() => handleWalletSaveName(menuCur)} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Зберегти</button>
                </div>
              </div>
            )}
            {menuStep === 'delete' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>Видалити гаманець <strong>{walletNames[menuCur] || menuCur}</strong>?</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setMenuStep('main')} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Скасувати</button>
                  <button onClick={() => handleWalletDelete(menuCur)} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--danger)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Видалити</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Card */}
      <div className="bottom-card">
        <div className="action-buttons">
          <div className="action-btn" onClick={() => setIsSpendOpen(true)}>
            <ArrowTop className="!relative !w-5 !h-5" />
            <span>Витрата</span>
          </div>
          <div className="action-btn" onClick={() => setIsAddOpen(true)}>
            <ArrowDown className="!relative !w-5 !h-5" />
            <span>Дохід</span>
          </div>
          <div className="action-btn" onClick={() => setIsJointCheckOpen(true)}>
            <JointCheckIcon />
            <span>Спільний</span>
          </div>
        </div>

        {/* Payment History (Today) */}
        <div className="payment-history">
          <div className="payment-header">
            <h3>Сьогодні</h3>
            <span className="chevron" onClick={() => setIsHistoryOpen(true)}>›</span>
          </div>

          <div className="payment-list">
            {todaysTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Немає транзакцій сьогодні
              </div>
            ) : (
              todaysTransactions.map((item) => (
                <div key={item.id} className={`payment-item ${item.isJointCheck ? 'joint-check-highlight' : ''}`} onClick={() => handleOpenTransaction(item)}>
                  <PaymentIcon type={item.type} category={item.category} />
                  <div className="payment-info">
                    <span className="payment-name">
                      {item.type === 'income' ? 'Дохід' : CATEGORY_NAMES[item.category] || 'Витрата'}
                    </span>
                    <span className="payment-category">{item.description || new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <span className={`payment-amount ${item.type === 'expense' ? 'expense' : 'income'}`} style={{ color: item.type === 'income' ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {item.type === 'expense' ? '-' : '+'}{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[item.currency as Currency || mainCurrency]}
                  </span>
                </div>
              ))
            )}
            
            <button 
              onClick={() => setIsHistoryOpen(true)}
              style={{
                background: 'var(--card-bg)',
                color: 'var(--text-secondary)',
                border: 'none',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                marginTop: '8px',
                fontFamily: 'var(--font-text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              Уся історія
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bottom-nav">
        <div className="nav-pills">
          <div
            className="nav-active-indicator"
            style={{ left: getIndicatorLeft() }}
          />
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeNav === item.id ? "active" : ""}`}
              onClick={() => setActiveNav(item.id)}
            >
              {item.icon}
            </div>
          ))}
        </div>
      <div className="search-btn" onClick={() => setIsQuickSpendOpen(true)}>
          <SearchIcon />
        </div>
      </div>
      </div>
    </div>
  );
};
