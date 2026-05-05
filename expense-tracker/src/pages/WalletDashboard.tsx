import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import { useCategories } from '../hooks/useCategories';
import {
  getCurrentMonth,
  subscribeToMonthlyBalance,
  subscribeToTransactions,
  addTransaction,
  deleteTransaction,
  updateTransaction,
  type Transaction,
  type MonthData,
} from '../services/database';
import { SpendModal } from '../components/modals/SpendModal';
import { AddModal } from '../components/modals/AddModal';
import { TransactionDetailModal } from '../components/modals/TransactionDetailModal';
import { PaymentIcon } from '../components/PaymentIcon';

const WalletDashboard: React.FC = () => {
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS } = useCurrency();
  const { names: CATEGORY_NAMES } = useCategories();
  const currentMonth = getCurrentMonth();

  // State
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get month name
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthDate = new Date(currentMonth);
  const monthName = monthNames[monthDate.getMonth()] + ' ' + monthDate.getFullYear();

  // Load data from Firebase
  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;

    const unsubBalance = subscribeToMonthlyBalance(user.id, currentMonth, (data) => {
      if (isSubscribed) {
        setMonthData(data);
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

  // Calculate balances
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

  // Get today's transactions for display
  const todaysTransactions = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    return transactions
      .filter(t => t.date >= todayStart && t.date < todayEnd)
      .sort((a, b) => b.date - a.date)
      .slice(0, 3); // Show only 3 most recent
  }, [transactions]);

  // Handlers
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
      alert('Error adding expense');
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
      alert('Error adding income');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await deleteTransaction(user.id, id);
      setSelectedTx(null);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Error deleting transaction');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTransaction = async (id: string, data: Partial<Transaction>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateTransaction(user.id, id, data);
      setSelectedTx(null);
    } catch (error) {
      console.error('Failed to update transaction:', error);
      alert('Error updating transaction');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
      <div className="w-[430px] h-[932px] bg-[#1C1C1E] text-white flex flex-col items-center justify-start pt-6 overflow-y-auto" style={{ maxHeight: '100vh' }}>
        {/* Header with date */}
        <div className="flex items-center justify-center mb-6">
          <div className="rounded-full px-[18px] py-[18px] bg-transparent flex items-center justify-center gap-2.5">
            <span className="text-2xl font-bold text-white text-center">{monthName}</span>
          </div>
        </div>

        {/* Balance display section */}
        <div className="flex flex-col items-center justify-center mb-8 gap-2.5">
          <div className="rounded-full px-[18px] py-[18px] bg-transparent flex items-center justify-center gap-2.5">
            <span className="text-5xl font-black text-white text-center">{formatValue(currentBalance)}</span>
          </div>
          <div className="rounded-full px-2.5 py-2.5 bg-transparent flex items-center justify-center gap-2.5 opacity-50">
            <span className="text-base font-medium text-white text-center">
              Capital: {formatValue(monthData?.initialBalance || 0)}
            </span>
          </div>
        </div>

        {/* Main content area with actions and history */}
        <div className="w-[398px] bg-[#1C1C1E] rounded-[40px] p-4 gap-2.5 flex flex-col">
          {/* Action buttons */}
          <div className="flex gap-4 justify-between mb-4">
            {/* Spend button */}
            <button
              onClick={() => setIsSpendOpen(true)}
              className="flex-1 flex flex-col items-center justify-center rounded-[24px] px-3.5 py-3.5 gap-1.5 bg-transparent hover:bg-gray-700 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg
                  width="12"
                  height="15"
                  viewBox="0 0 12 15"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 1v13M1 6h10" />
                </svg>
              </div>
              <span className="text-base font-medium text-white text-center">Spend</span>
            </button>

            {/* Add button */}
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex-1 flex flex-col items-center justify-center rounded-[24px] px-3.5 py-3.5 gap-1.5 bg-transparent hover:bg-gray-700 transition-colors"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <svg
                  width="12"
                  height="15"
                  viewBox="0 0 12 15"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 1v13M1 6h10" />
                </svg>
              </div>
              <span className="text-base font-medium text-white text-center">Add</span>
            </button>
          </div>

          {/* Payment history section */}
          <div className="w-[366px] bg-[#2C2C2E] rounded-[24px] p-4 gap-3.5 flex flex-col">
            {/* History header */}
            <div className="w-[332px] flex justify-between items-center">
              <span className="text-base font-medium text-white">Today</span>
              <span className="text-base font-medium text-white">&gt;</span>
            </div>

            {/* Payment items */}
            <div className="space-y-3">
              {todaysTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>
                  No transactions today
                </div>
              ) : (
                todaysTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    onClick={() => setSelectedTx(transaction)}
                    className="w-[332px] flex items-center gap-2.5 bg-[#1E1E1E] rounded-[40px] p-1.5 cursor-pointer hover:bg-[#2A2A2A] transition-colors"
                  >
                    {/* Payment icon */}
                    <div className="w-[35px] h-[35px] rounded-full flex-shrink-0 flex items-center justify-center">
                      <PaymentIcon type={transaction.type} category={transaction.category} />
                    </div>

                    {/* Payment details */}
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-base font-medium text-white">
                        {transaction.type === 'income' ? 'Income' : CATEGORY_NAMES[transaction.category] || 'Expense'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(transaction.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Amount */}
                    <span className={`text-xl font-semibold text-right flex-shrink-0 ${transaction.type === 'expense' ? 'text-[#FF7373]' : 'text-[#00C853]'}`}>
                      {transaction.type === 'expense' ? '-' : '+'}{transaction.amount.toFixed(2)} {CURRENCY_SYMBOLS[transaction.currency as Currency || mainCurrency]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {isSpendOpen && (
          <SpendModal
            onClose={() => setIsSpendOpen(false)}
            onSpend={handleSpend}
            isLoading={isSaving}
            walletBalances={walletBalances}
          />
        )}

        {isAddOpen && (
          <AddModal
            onClose={() => setIsAddOpen(false)}
            onAdd={handleAdd}
            isLoading={isSaving}
            walletBalances={walletBalances}
          />
        )}

        {selectedTx && (
          <TransactionDetailModal
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
            onDelete={handleDeleteTransaction}
            onUpdate={handleUpdateTransaction}
            isLoading={isSaving}
            walletBalances={walletBalances}
          />
        )}
      </div>
    </div>
  );
};

export default WalletDashboard;
