import { useState, useEffect, useMemo, useRef, type PointerEvent, type TouchEvent, type WheelEvent } from "react";
import { ArrowDown } from "../components/icons/ArrowDown";
import { ArrowTop } from "../components/icons/ArrowTop";
import { SettingsIcon } from "../components/icons/SettingsIcon";
import { HistoryIcon } from "../components/icons/HistoryIcon";
import { BookmarkIcon } from "../components/icons/BookmarkIcon";
import { AnalyticsIcon } from "../components/icons/AnalyticsIcon";
import { JointCheckIcon } from "../components/icons/JointCheckIcon";
import { SvgRepoIcon } from "../components/icons/SvgRepoIcon";
import { PaymentIcon } from "../components/PaymentIcon";
import { useTelegramPlatform } from "../hooks/useTelegramPlatform";
import { useKeyboardSafe } from "../hooks/useKeyboardSafe";
import { useAuth } from "../context/AuthContext";
import { useCurrency, type Currency, CURRENCY_SYMBOLS } from "../hooks/useCurrency";
import { useCategories } from "../hooks/useCategories";
import { useWallets } from "../hooks/useWallets";
import {
  getCurrentMonth,
  subscribeToTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addTransfer,
  subscribeToUserSettings,
  updateUserSettings,
  ADMIN_TELEGRAM_ID,
  type Transaction,
  type UserSettings
} from "../services/database";

import { SpendModal } from "../components/modals/SpendModal";
import { AddModal } from "../components/modals/AddModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { HistoryModal } from "../components/modals/HistoryModal";
import { TransferModal } from "../components/modals/TransferModal";
import { TransactionDetailModal } from "../components/modals/TransactionDetailModal";
import { VaultModal } from "../components/modals/VaultModal";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { AnalyticsView } from "../components/AnalyticsView";
import { NumericKeypad, getKeypadNumericValue } from "../components/NumericKeypad";
import { SavedReceiptsView } from "../components/SavedReceiptsView";
import { SharedReceiptView } from "../components/SharedReceiptView";
import { FinancialHubView } from "../components/FinancialHubView";
import { JointCheckCreateModal } from "../components/JointCheckCreateModal";
import { JointCheckDetailModal } from "../components/JointCheckDetailModal";
import { UserQrSheet } from "../components/UserQrSheet";
import { walletColor } from "../components/WalletPicker";
import type { ReceiptShare } from "../services/database";
import "../components/JointCheck.css";

export const HomePage = () => {
  const [activeNav, setActiveNav] = useState(0);
  const { safeAreaInsets } = useTelegramPlatform();
  useKeyboardSafe();
  const { user } = useAuth();
  const isAdmin = user?.id === ADMIN_TELEGRAM_ID;
  const { currency: mainCurrency, mainWalletId, formatValue, convertToMain } = useCurrency();
  const currSym = (CURRENCY_SYMBOLS as Record<string, string>)[mainCurrency] ?? mainCurrency;
  const { names: CATEGORY_NAMES } = useCategories();
  const { wallets, isLoaded: walletsLoaded, createWallet, renameWallet, removeWallet } = useWallets();
  const currentMonth = getCurrentMonth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [budgetLimitStartDate, setBudgetLimitStartDate] = useState<number | null | undefined>();
  const [budgetLimitPeriod, setBudgetLimitPeriod] = useState<'day' | 'week' | 'month'>('month');

  // Modals
  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
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

  // Pull-to-reveal QR
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [pullQrDistance, setPullQrDistance] = useState(0);

  // Wallet carousel
  const [activeWallet, setActiveWallet] = useState(0);
  const cardsScrollRef = useRef<HTMLDivElement>(null);
  const walletDragRef = useRef<{ pointerId: number; startX: number; scrollLeft: number } | null>(null);
  const walletWheelTimeoutRef = useRef<number | null>(null);
  const [isDraggingWallets, setIsDraggingWallets] = useState(false);

  // Wallet management
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletCurrency, setNewWalletCurrency] = useState<Currency>('UAH');
  const [newWalletBalance, setNewWalletBalance] = useState('');
  const [menuWalletId, setMenuWalletId] = useState<string | null>(null);
  const [menuStep, setMenuStep] = useState<'main' | 'rename' | 'delete'>('main');
  const [editingName, setEditingName] = useState('');

  const navItems = [
    { icon: <SvgRepoIcon name="home" />, id: 0, label: 'Головна' },
    { icon: <HistoryIcon />, id: 1, label: 'Фінанси' },
    { icon: <BookmarkIcon />, id: 2, label: 'Чеки' },
    { icon: <AnalyticsIcon />, id: 3, label: 'Аналітика' },
  ];

  useEffect(() => {
    document.documentElement.style.setProperty('--safe-area-top', `${safeAreaInsets.top}px`);
    document.documentElement.style.setProperty('--safe-area-bottom', `${safeAreaInsets.bottom}px`);
  }, [safeAreaInsets]);

  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;

    const unsubTx = subscribeToTransactions(user.id, currentMonth, (txs) => {
      if (isSubscribed) {
        setTransactions(txs);
        setIsDataLoaded(true);
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
      unsubTx();
      unsubSettings();
    };
  }, [user, currentMonth]);

  // Compute walletBalances from wallets for backward-compat components (HistoryModal etc.)
  const walletBalances: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of wallets) {
      map[w.currency] = (map[w.currency] || 0) + (w.balance || 0);
    }
    return map;
  }, [wallets]);

  const selectedMainWalletId = useMemo(() => {
    const savedWallet = wallets.find(w => w.id === mainWalletId);
    if (savedWallet) return savedWallet.id ?? null;

    return wallets.find(w => w.currency === mainCurrency)?.id ?? null;
  }, [wallets, mainWalletId, mainCurrency]);

  const displayedWallets = useMemo(() => {
    const mainIndex = wallets.findIndex(wallet => wallet.id === selectedMainWalletId);
    if (mainIndex <= 0) return wallets;

    return [
      wallets[mainIndex],
      ...wallets.slice(0, mainIndex),
      ...wallets.slice(mainIndex + 1),
    ];
  }, [wallets, selectedMainWalletId]);

  const defaultWalletId = selectedMainWalletId ?? wallets[0]?.id ?? null;

  useEffect(() => {
    setActiveWallet(0);
    cardsScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [selectedMainWalletId]);

  useEffect(() => () => {
    if (walletWheelTimeoutRef.current !== null) {
      window.clearTimeout(walletWheelTimeoutRef.current);
    }
  }, []);

  const isDesktopPointer = () => window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;

  const scrollToWallet = (index: number) => {
    const track = cardsScrollRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(displayedWallets.length, index));
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  };

  const handleWalletWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!isDesktopPointer() || walletWheelTimeoutRef.current !== null) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    const target = Math.max(0, Math.min(displayedWallets.length, activeWallet + (delta > 0 ? 1 : -1)));
    if (target === activeWallet) return;

    event.preventDefault();
    scrollToWallet(target);
    walletWheelTimeoutRef.current = window.setTimeout(() => {
      walletWheelTimeoutRef.current = null;
    }, 360);
  };

  const handleWalletPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDesktopPointer() || event.pointerType !== 'mouse' || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;

    walletDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDraggingWallets(true);
  };

  const handleWalletPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = walletDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = dragState.scrollLeft - (event.clientX - dragState.startX);
  };

  const finishWalletDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = walletDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const track = event.currentTarget;
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    walletDragRef.current = null;
    setIsDraggingWallets(false);
    scrollToWallet(Math.round(track.scrollLeft / track.clientWidth));
  };


  const periodExpenses = useMemo(() => {
    let periodStart = 0;
    const now = new Date();
    if (budgetLimitPeriod === 'day') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (budgetLimitPeriod === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      periodStart = new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
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

  const handleSpend = async (amount: number, category: string, description: string, walletId: string, date: number) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const wallet = wallets.find(w => w.id === walletId);
      await addTransaction(user.id, {
        type: 'expense', amount, category, description,
        date, month: getCurrentMonth(date),
        currency: wallet?.currency || mainCurrency,
        walletId,
      });
      setIsSpendOpen(false);
    } catch (error) {
      console.error('Failed to add spend transaction:', error);
      alert('Помилка при додаванні видатків. Спробуйте ще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (amount: number, description: string, walletId: string, date: number) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const wallet = wallets.find(w => w.id === walletId);
      await addTransaction(user.id, {
        type: 'income', amount, category: 'income', description,
        date, month: getCurrentMonth(date),
        currency: wallet?.currency || mainCurrency,
        walletId,
      });
      setIsAddOpen(false);
    } catch (error) {
      console.error('Failed to add income transaction:', error);
      alert('Помилка при додаванні доходу. Спробуйте ще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransfer = async (fromWalletId: string, toWalletId: string, amount: number, convertedAmount: number, description: string) => {
    if (!user) return;
    await addTransfer(user.id, { fromWalletId, toWalletId, amount, convertedAmount, description, date: Date.now() });
  };

  const handleActionSelect = (openAction: () => void) => {
    setIsActionMenuOpen(false);
    openAction();
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
      });
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

  const handleCloseVault = () => {
    setIsVaultOpen(false);
  };

  const handleWalletAdd = async () => {
    if (!newWalletName.trim()) return;
    const balance = parseFloat(newWalletBalance) || 0;
    await createWallet(newWalletName.trim(), newWalletCurrency, balance);
    setIsAddingWallet(false);
    setNewWalletName('');
    setNewWalletBalance('');
  };

  const handleWalletRename = async () => {
    if (!menuWalletId || !editingName.trim()) return;
    await renameWallet(menuWalletId, editingName.trim());
    setMenuWalletId(null);
    setMenuStep('main');
  };

  const handleMainWalletChange = async () => {
    if (!user || !menuWallet?.id) return;
    await updateUserSettings(user.id, {
      currency: menuWallet.currency,
      mainWalletId: menuWallet.id,
    });
    setMenuWalletId(null);
    setMenuStep('main');
  };

  const handleWalletDelete = async () => {
    if (!menuWalletId) return;
    const replacementWallet = wallets.find(wallet => wallet.id !== menuWalletId);
    await removeWallet(menuWalletId);
    if (menuWalletId === selectedMainWalletId && replacementWallet?.id && user) {
      await updateUserSettings(user.id, {
        currency: replacementWallet.currency,
        mainWalletId: replacementWallet.id,
      });
    }
    setMenuWalletId(null);
    setMenuStep('main');
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (activeNav !== 0) return;
    if (isSpendOpen || isAddOpen || isSettingsOpen || isHistoryOpen || isTransferOpen || isJointCheckOpen || isActionMenuOpen || selectedTx || jointCheckId || viewingShare) return;
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

  const monthName = new Date().toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
  const todayDateStr = new Date().toLocaleDateString();
  const todaysTransactions = transactions.filter(t => new Date(t.date).toLocaleDateString() === todayDateStr);
  const menuWallet = wallets.find(w => w.id === menuWalletId) ?? null;

  if (!isDataLoaded || !walletsLoaded) {
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
      {isSpendOpen && <SpendModal onClose={() => setIsSpendOpen(false)} onSpend={handleSpend} isLoading={isSaving} wallets={wallets} defaultWalletId={defaultWalletId} />}
      {isAddOpen && <AddModal onClose={() => setIsAddOpen(false)} onAdd={handleAdd} isLoading={isSaving} wallets={wallets} defaultWalletId={defaultWalletId} />}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} walletBalances={walletBalances} />}
      {isAdmin && isVaultOpen && <VaultModal onClose={handleCloseVault} />}
      {isHistoryOpen && <HistoryModal onClose={() => setIsHistoryOpen(false)} walletBalances={walletBalances} />}
      {isTransferOpen && wallets.length >= 2 && (
        <TransferModal
          onClose={() => setIsTransferOpen(false)}
          onTransfer={handleTransfer}
          wallets={wallets}
        />
      )}
      {isJointCheckOpen && <JointCheckCreateModal onClose={() => setIsJointCheckOpen(false)} walletBalances={walletBalances} />}
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onDelete={handleDeleteTransaction}
          onUpdate={handleUpdateTransaction}
          isLoading={isTxActionLoading}
        />
      )}
      {jointCheckId && <JointCheckDetailModal jointCheckId={jointCheckId} onClose={() => setJointCheckId(null)} />}
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

      {/* Budget Limit Modal */}
      {showLimitModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowLimitModal(false); }}>
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
                <input type="checkbox" checked={limitIncludePriorInput} onChange={(e) => setLimitIncludePriorInput(e.target.checked)} />
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
              currencySymbol={currSym}
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
        <AnalyticsView walletBalances={walletBalances} mainCurrency={mainCurrency} isActive={activeNav === 3} />
        <FinancialHubView isActive={activeNav === 1} walletBalances={walletBalances} onOpenReceipt={(share) => setViewingShare(share)} onOpenTransaction={handleOpenTransaction} />
        <SavedReceiptsView isActive={activeNav === 2} onOpenReceipt={(share) => setViewingShare(share)} />
        {viewingShare && <SharedReceiptView share={viewingShare} onClose={() => setViewingShare(null)} />}

        <main className="home-dashboard" style={{ display: (activeNav === 3 || activeNav === 1 || activeNav === 2) ? 'none' : undefined }}>
          {/* Header */}
          <div className="header">
            <span className="month-label">{monthName}</span>
            <div className="header-actions">
              {isAdmin && (
                <button type="button" className="vault-entry-btn" onClick={() => setIsVaultOpen(true)}>
                  Підписка Vault
                </button>
              )}
              <div className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
                <SettingsIcon />
              </div>
            </div>
          </div>

          {/* Wallet Cards Carousel */}
          <div className="wallet-cards-section">
            <div
              className={`wallet-cards-track ${isDraggingWallets ? 'is-dragging' : ''}`}
              ref={cardsScrollRef}
              onWheel={handleWalletWheel}
              onPointerDown={handleWalletPointerDown}
              onPointerMove={handleWalletPointerMove}
              onPointerUp={finishWalletDrag}
              onPointerCancel={finishWalletDrag}
              onScroll={() => {
                if (!cardsScrollRef.current) return;
                const el = cardsScrollRef.current;
                setActiveWallet(Math.round(el.scrollLeft / el.offsetWidth));
              }}
            >
              {displayedWallets.map((wallet) => {
                const sym = (CURRENCY_SYMBOLS as Record<string, string>)[wallet.currency] ?? wallet.currency;
                const balance = wallet.balance ?? 0;
                return (
                  <div key={wallet.id} className="wallet-card-slide">
                    <div className="wallet-card" style={{ background: walletColor(wallet.currency) }}>
                      <div className="wallet-card-deco" style={{ width: 140, height: 140, right: -28, top: -28, background: 'rgba(255,255,255,0.08)' }} />
                      <div className="wallet-card-deco" style={{ width: 90, height: 90, right: 50, bottom: -36, background: 'rgba(255,255,255,0.05)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                        <span style={{ fontSize: '14px', fontWeight: 650, opacity: 0.85 }}>{wallet.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuWalletId(wallet.id!); setMenuStep('main'); setEditingName(wallet.name); }}
                          aria-label="Відкрити меню гаманця"
                          style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '8px', padding: '4px 7px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <SvgRepoIcon name="dots" className="wallet-card-menu-icon" />
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
                          <AnimatedNumber value={balance} formatter={(v) => `${v.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`} />
                        </div>
                        <div style={{ marginTop: '5px', fontSize: '12px', opacity: 0.6 }}>
                          {wallet.currency}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

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

            <div className="wallet-card-controls">
              <button
                type="button"
                className="wallet-card-control previous"
                onClick={() => scrollToWallet(activeWallet - 1)}
                disabled={activeWallet === 0}
                aria-label="Попередній гаманець"
              >
                ‹
              </button>
              <button
                type="button"
                className="wallet-card-control next"
                onClick={() => scrollToWallet(activeWallet + 1)}
                disabled={activeWallet === displayedWallets.length}
                aria-label="Наступний гаманець"
              >
                ›
              </button>
            </div>

            {/* Dots */}
            <div className="wallet-dots">
              {Array.from({ length: displayedWallets.length + 1 }).map((_, i) => (
                <div key={i} className={`wallet-dot ${activeWallet === i ? 'active' : ''}`} style={{ width: activeWallet === i ? 18 : 6 }} />
              ))}
            </div>

            {/* Add wallet form */}
            {isAddingWallet && (
              <div style={{ padding: '10px 16px 0' }}>
                <div style={{ background: 'var(--card-bg)', borderRadius: '18px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Новий гаманець</span>
                  <input
                    type="text"
                    placeholder="Назва (наприклад: Монобанк)"
                    value={newWalletName}
                    onChange={e => setNewWalletName(e.target.value)}
                    style={{ background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none', fontFamily: 'var(--font-text)', fontSize: '14px' }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={newWalletCurrency} onChange={e => setNewWalletCurrency(e.target.value as Currency)}
                      style={{ background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none', fontFamily: 'var(--font-text)' }}>
                      <option value="UAH">UAH</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" placeholder="Баланс (необов.)" value={newWalletBalance} onChange={e => setNewWalletBalance(e.target.value)}
                      style={{ flex: 1, background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none', fontFamily: 'var(--font-text)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setIsAddingWallet(false); setNewWalletName(''); setNewWalletBalance(''); }}
                      style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-text)' }}>
                      Скасувати
                    </button>
                    <button onClick={handleWalletAdd} disabled={!newWalletName.trim()}
                      style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: newWalletName.trim() ? 1 : 0.4, fontFamily: 'var(--font-text)' }}>
                      Додати
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Budget Progress Bar */}
          {budgetLimit > 0 ? (
            <div className="budget-section" style={{ padding: '8px 16px 0' }}>
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
            <div className="budget-section" style={{ padding: '4px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLimitModal(true)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
                + Встановити ліміт
              </button>
            </div>
          )}

          {/* Wallet menu overlay */}
          {menuWalletId && (
            <div className="modal-overlay" style={{ zIndex: 200, alignItems: 'flex-end', padding: '16px' }} onClick={() => { setMenuWalletId(null); setMenuStep('main'); }}>
              <div style={{ width: '100%', background: 'var(--card-bg)', borderRadius: '20px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }} onClick={e => e.stopPropagation()}>
                {menuStep === 'main' && (<>
                  <button onClick={() => setMenuStep('rename')} style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', background: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SvgRepoIcon name="rename" /> Перейменувати
                  </button>
                  {menuWallet?.id === selectedMainWalletId ? (
                    <div style={{ padding: '14px 16px', color: 'var(--text-tertiary)', fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <SvgRepoIcon name="favorite" /> Головний гаманець
                    </div>
                  ) : (
                    <button onClick={handleMainWalletChange} style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', background: 'none', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <SvgRepoIcon name="favorite" /> Зробити головним
                    </button>
                  )}
                  <button onClick={() => setMenuStep('delete')} style={{ padding: '14px 16px', border: 'none', borderRadius: '14px', background: 'none', color: 'var(--danger)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SvgRepoIcon name="delete" /> Видалити гаманець
                  </button>
                </>)}
                {menuStep === 'rename' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, paddingLeft: '4px' }}>Нова назва</span>
                    <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                      style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', background: 'var(--card-bg-2)', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', fontFamily: 'var(--font-text)' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setMenuStep('main')} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Назад</button>
                      <button onClick={handleWalletRename} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Зберегти</button>
                    </div>
                  </div>
                )}
                {menuStep === 'delete' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>Видалити гаманець <strong>{menuWallet?.name}</strong>?</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setMenuStep('main')} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Скасувати</button>
                      <button onClick={handleWalletDelete} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '12px', background: 'var(--danger)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-text)' }}>Видалити</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Card */}
          <div className="bottom-card">
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
                  todaysTransactions.map((item) => {
                    const txSym = (CURRENCY_SYMBOLS as Record<string, string>)[item.currency || mainCurrency] ?? mainCurrency;
                    return (
                      <div key={item.id} className={`payment-item ${item.isJointCheck ? 'joint-check-highlight' : ''}`} onClick={() => handleOpenTransaction(item)}>
                        <PaymentIcon type={item.type} category={item.category} />
                        <div className="payment-info">
                          <span className="payment-name">
                            {item.type === 'income' ? 'Дохід' : item.type === 'transfer' ? 'Переказ' : CATEGORY_NAMES[item.category] || 'Витрата'}
                          </span>
                          <span className="payment-category">{item.description || new Date(item.date).toLocaleDateString()}</span>
                        </div>
                        <span className={`payment-amount ${item.type === 'expense' ? 'expense' : 'income'}`} style={{ color: item.type === 'income' ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {item.type === 'expense' ? '-' : '+'}{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {txSym}
                        </span>
                      </div>
                    );
                  })
                )}

                <button
                  onClick={() => setIsHistoryOpen(true)}
                  style={{
                    background: 'var(--card-bg)', color: 'var(--text-secondary)', border: 'none',
                    padding: '12px', borderRadius: 'var(--radius-md)', marginTop: '8px',
                    fontFamily: 'var(--font-text)', fontSize: '13px', fontWeight: 500,
                    cursor: 'pointer', transition: 'background 0.2s ease',
                  }}
                >
                  Уся історія
                </button>
              </div>
            </div>
          </div>
        </main>

        {isActionMenuOpen && (
          <button
            type="button"
            className="action-menu-backdrop"
            aria-label="Закрити меню дій"
            onClick={() => setIsActionMenuOpen(false)}
          />
        )}
        {isActionMenuOpen && (
          <div className="action-menu" role="menu" aria-label="Нова операція">
            <button type="button" className="action-menu-item" role="menuitem" onClick={() => handleActionSelect(() => setIsSpendOpen(true))}>
              <ArrowTop className="!relative !w-5 !h-5" />
              <span>Витрата</span>
            </button>
            <button type="button" className="action-menu-item" role="menuitem" onClick={() => handleActionSelect(() => setIsAddOpen(true))}>
              <ArrowDown className="!relative !w-5 !h-5" />
              <span>Дохід</span>
            </button>
            <button type="button" className="action-menu-item" role="menuitem" disabled={wallets.length < 2} onClick={() => handleActionSelect(() => setIsTransferOpen(true))}>
              <SvgRepoIcon name="transfer" />
              <span>Переказ</span>
            </button>
            <button type="button" className="action-menu-item" role="menuitem" onClick={() => handleActionSelect(() => setIsJointCheckOpen(true))}>
              <JointCheckIcon />
              <span>Спільні</span>
            </button>
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className="bottom-nav" aria-label="Основна навігація">
          <div className="nav-pills">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`nav-item ${activeNav === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveNav(item.id);
                  setIsActionMenuOpen(false);
                }}
                aria-label={item.label}
                aria-current={activeNav === item.id ? 'page' : undefined}
                data-label={item.label}
              >
                {item.icon}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`plus-btn ${isActionMenuOpen ? "open" : ""}`}
            onClick={() => setIsActionMenuOpen(open => !open)}
            aria-label={isActionMenuOpen ? "Закрити меню дій" : "Додати операцію"}
            aria-expanded={isActionMenuOpen}
            data-label="Додати"
          >
            <SvgRepoIcon name="plus" />
          </button>
        </nav>
      </div>
    </div>
  );
};
