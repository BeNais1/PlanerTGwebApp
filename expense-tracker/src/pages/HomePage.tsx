import { useState, useEffect, useMemo } from "react";
import { ArrowDown } from "../components/icons/ArrowDown";
import { ArrowTop } from "../components/icons/ArrowTop";
import { SettingsIcon } from "../components/icons/SettingsIcon";
import { HomeIcon } from "../components/icons/HomeIcon";
import { HistoryIcon } from "../components/icons/HistoryIcon";
import { BookmarkIcon } from "../components/icons/BookmarkIcon";
import { AnalyticsIcon } from "../components/icons/AnalyticsIcon";
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
import { SubscriptionsView } from "../components/SubscriptionsView";
import { BudgetBubble } from "../components/BudgetBubble";
import { NumericKeypad, getKeypadNumericValue } from "../components/NumericKeypad";
import { SavedReceiptsView } from "../components/SavedReceiptsView";
import { SharedReceiptView } from "../components/SharedReceiptView";
import type { ReceiptShare } from "../services/database";

export const HomePage = () => {
  const [activeNav, setActiveNav] = useState(0);
  const { safeAreaInsets } = useTelegramPlatform();
  useKeyboardSafe();
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS } = useCurrency();
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

  transactions.forEach(t => {
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
    <div className="phone-frame">
      {/* Modals */}
      {(monthData === null || monthData === undefined) && <SetBalanceModal onSetBalance={handleSetInitialBalance} isLoading={isSaving} />}
      {isSpendOpen && <SpendModal onClose={() => setIsSpendOpen(false)} onSpend={handleSpend} isLoading={isSaving} walletBalances={walletBalances} />}
      {isAddOpen && <AddModal onClose={() => setIsAddOpen(false)} onAdd={handleAdd} isLoading={isSaving} walletBalances={walletBalances} />}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} walletBalances={walletBalances} />}
      {isHistoryOpen && <HistoryModal onClose={() => setIsHistoryOpen(false)} walletBalances={walletBalances} />}
      {isQuickSpendOpen && <QuickSpendModal onClose={() => setIsQuickSpendOpen(false)} onSpend={handleQuickSpend} isLoading={isSaving} walletBalances={walletBalances} />}
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

      {/* Full-screen views */}
      <AnalyticsView 
        walletBalances={walletBalances}
        mainCurrency={mainCurrency}
        isActive={activeNav === 3}
      />

      <SubscriptionsView
        isActive={activeNav === 1}
        onClose={() => setActiveNav(0)}
        walletBalances={walletBalances}
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

      {/* Balance Display */}
      <div className="balance-section">
        <div className="balance-amount">
          <AnimatedNumber value={walletBalances[mainCurrency] || 0} formatter={formatValue} />
        </div>
        <div className="balance-sub">
          Капітал: <AnimatedNumber value={currentBalance} formatter={formatValue} />
        </div>
      </div>

      {/* Budget Bubble */}
      <BudgetBubble
        spent={periodExpenses}
        limit={budgetLimit}
        formatValue={formatValue}
        onSetLimit={() => setShowLimitModal(true)}
        period={budgetLimitPeriod}
      />

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
                <div key={item.id} className="payment-item" onClick={() => setSelectedTx(item)}>
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
  );
};
