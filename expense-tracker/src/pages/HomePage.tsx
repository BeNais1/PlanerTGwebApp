import { useState, useEffect } from "react";
import { ArrowDown } from "../components/icons/ArrowDown";
import { ArrowTop } from "../components/icons/ArrowTop";
import { SettingsIcon } from "../components/icons/SettingsIcon";
import { HomeIcon } from "../components/icons/HomeIcon";
import { HistoryIcon } from "../components/icons/HistoryIcon";
import { WalletIcon } from "../components/icons/WalletIcon";
import { AnalyticsIcon } from "../components/icons/AnalyticsIcon";
import { SearchIcon } from "../components/icons/SearchIcon";
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
  type Transaction,
  type MonthData
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

export const HomePage = () => {
  const [activeNav, setActiveNav] = useState(0);
  const { safeAreaInsets } = useTelegramPlatform();
  useKeyboardSafe();
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS } = useCurrency();
  const { icons: CATEGORY_ICONS, names: CATEGORY_NAMES } = useCategories();
  const currentMonth = getCurrentMonth();

  // State
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Modals state
  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQuickSpendOpen, setIsQuickSpendOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTxActionLoading, setIsTxActionLoading] = useState(false);

  const navItems = [
    { icon: <HomeIcon />, id: 0 },
    { icon: <HistoryIcon />, id: 1 },
    { icon: <WalletIcon />, id: 2 },
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

    return () => {
      isSubscribed = false;
      unsubBalance();
      unsubTx();
    };
  }, [user, currentMonth]);

  // Calculations
  const walletBalances: Record<string, number> = {};
  if (monthData) {
    if (monthData.initialBalance) {
      walletBalances['EUR'] = monthData.initialBalance;
    }
    if (monthData.balances) {
      Object.entries(monthData.balances).forEach(([cur, amount]) => {
        walletBalances[cur] = (walletBalances[cur] || 0) + amount;
      });
    }
  }
  if (Object.keys(walletBalances).length === 0) {
    walletBalances['EUR'] = 0;
  }

  transactions.forEach(t => {
    const cur = t.currency || 'EUR';
    if (walletBalances[cur] === undefined) walletBalances[cur] = 0;
    if (t.type === 'expense') walletBalances[cur] -= t.amount;
    if (t.type === 'income') walletBalances[cur] += t.amount;
  });

  let currentBalance = 0;
  Object.entries(walletBalances).forEach(([cur, amount]) => {
    currentBalance += convertToMain(amount, cur as Currency);
  });

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
    await addTransaction(user.id, {
      type: 'expense', amount, category, description,
      date: Date.now(), month: currentMonth, currency
    });
    setIsSaving(false);
    setIsSpendOpen(false);
  };

  const handleAdd = async (amount: number, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    await addTransaction(user.id, {
      type: 'income', amount, category: 'income', description,
      date: Date.now(), month: currentMonth, currency
    });
    setIsSaving(false);
    setIsAddOpen(false);
  };

  const handleQuickSpend = async (amount: number, category: string, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    await addTransaction(user.id, {
      type: 'expense', amount, category, description,
      date: Date.now(), month: currentMonth, currency
    });
    setIsSaving(false);
    setIsQuickSpendOpen(false);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    setIsTxActionLoading(true);
    await deleteTransaction(user.id, id);
    setIsTxActionLoading(false);
    setSelectedTx(null);
  };

  const handleUpdateTransaction = async (id: string, data: Partial<Transaction>) => {
    if (!user) return;
    setIsTxActionLoading(true);
    await updateTransaction(user.id, id, data);
    setIsTxActionLoading(false);
  };

  const monthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const getIndicatorLeft = () => `calc(4px + ${activeNav} * (100% - 8px) / 4)`;

  const todayDateStr = new Date().toLocaleDateString();
  const todaysTransactions = transactions.filter(t => new Date(t.date).toLocaleDateString() === todayDateStr);

  const PaymentIcon = ({ type, category }: { type: string, category: string }) => {
    if (type === 'income') {
      return (
        <div className="payment-icon" style={{ background: "var(--apple-blue)" }}>
          <ArrowDown className="!w-5 !h-5 text-white" />
        </div>
      );
    }
    const icon = CATEGORY_ICONS[category] || '📦';
    return (
      <div className="payment-icon" style={{ background: "var(--apple-surface-3)", fontSize: "20px" }}>
        {icon}
      </div>
    );
  };

  if (!isDataLoaded) {
    return <div className="phone-frame"><div style={{ margin: 'auto', color: 'var(--apple-text-on-dark-secondary)' }}>Loading...</div></div>;
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

      {/* Full-screen views */}
      <AnalyticsView 
        walletBalances={walletBalances}
        mainCurrency={mainCurrency}
        isActive={activeNav === 3}
        onClose={() => setActiveNav(0)}
      />

      <SubscriptionsView
        isActive={activeNav === 1}
        onClose={() => setActiveNav(0)}
        walletBalances={walletBalances}
      />

      <div style={{ display: (activeNav === 3 || activeNav === 1) ? 'none' : 'contents' }}>
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
          Общий капитал: <AnimatedNumber value={currentBalance} formatter={formatValue} />
        </div>
      </div>

      {/* Bottom Card */}
      <div className="bottom-card">
        <div className="action-buttons">
          <div className="action-btn" onClick={() => setIsSpendOpen(true)}>
            <ArrowTop className="!relative !w-5 !h-5" />
            <span>Расход</span>
          </div>
          <div className="action-btn" onClick={() => setIsAddOpen(true)}>
            <ArrowDown className="!relative !w-5 !h-5" />
            <span>Доход</span>
          </div>
        </div>

        {/* Payment History (Today) */}
        <div className="payment-history">
          <div className="payment-header">
            <h3>Сегодня</h3>
            <span className="chevron" onClick={() => setIsHistoryOpen(true)}>›</span>
          </div>

          <div className="payment-list">
            {todaysTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--apple-text-on-dark-tertiary)', fontSize: '13px' }}>
                Нет транзакций сегодня
              </div>
            ) : (
              todaysTransactions.map((item) => (
                <div key={item.id} className="payment-item" onClick={() => setSelectedTx(item)}>
                  <PaymentIcon type={item.type} category={item.category} />
                  <div className="payment-info">
                    <span className="payment-name">
                      {item.type === 'income' ? 'Доход' : CATEGORY_NAMES[item.category] || 'Расход'}
                    </span>
                    <span className="payment-category">{item.description || new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <span className={`payment-amount ${item.type === 'expense' ? 'expense' : 'income'}`} style={{ color: item.type === 'income' ? 'var(--apple-blue)' : 'var(--apple-text-on-dark)' }}>
                    {item.type === 'expense' ? '-' : '+'}{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[item.currency as Currency || 'EUR']}
                  </span>
                </div>
              ))
            )}
            
            <button 
              onClick={() => setIsHistoryOpen(true)}
              style={{
                background: 'var(--apple-surface-2)',
                color: 'var(--apple-text-on-dark-secondary)',
                border: 'none',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                marginTop: '10px',
                fontFamily: 'var(--font-text)',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Вся история
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
