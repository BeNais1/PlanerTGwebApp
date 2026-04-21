import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTransactions, type Transaction } from '../../services/database';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { ArrowDown } from '../icons/ArrowDown';
import { TransactionDetailModal } from './TransactionDetailModal';
import { deleteTransaction, updateTransaction } from '../../services/database';
import './Modals.css';

interface HistoryModalProps {
  onClose: () => void;
  walletBalances: Record<string, number>;
}

export const HistoryModal = ({ onClose, walletBalances }: HistoryModalProps) => {
  const { user } = useAuth();
  const { formatValue } = useCurrency();
  const { icons: CATEGORY_ICONS, names: CATEGORY_NAMES } = useCategories();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isTxActionLoading, setIsTxActionLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setLoading(true);
      const allTxs = await getAllTransactions(user.id);
      setHistory(allTxs);
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    setIsTxActionLoading(true);
    await deleteTransaction(user.id, id);
    setHistory(prev => prev.filter(t => t.id !== id));
    setIsTxActionLoading(false);
    setSelectedTx(null);
  };

  const handleUpdate = async (id: string, data: Partial<Transaction>) => {
    if (!user) return;
    setIsTxActionLoading(true);
    await updateTransaction(user.id, id, data);
    setHistory(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    setIsTxActionLoading(false);
  };

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

  // Group by Month string
  const groupedHistory = history.reduce((acc, tx) => {
    const monthName = new Date(tx.date).toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    if (!acc[monthName]) acc[monthName] = [];
    acc[monthName].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content history-modal-content ${isClosing ? 'closing' : ''}`} style={{ height: '85vh', maxHeight: '85vh' }}>
        <div className="modal-header" style={{ marginBottom: '10px' }}>
          <h2 className="modal-title">Уся історія</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        {selectedTx && (
          <TransactionDetailModal 
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            isLoading={isTxActionLoading}
            walletBalances={walletBalances}
          />
        )}

        <div className="history-list-container" style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--apple-text-on-dark-tertiary)' }}>Завантаження...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--apple-text-on-dark-tertiary)' }}>Немає транзакцій</div>
          ) : (
            Object.entries(groupedHistory).map(([monthStr, txs]) => (
              <div key={monthStr} className="history-month-group">
                <h3 style={{ fontSize: '15px', color: 'var(--apple-text-on-dark-secondary)', marginBottom: '8px', paddingLeft: '4px' }}>
                  {monthStr}
                </h3>
                 <div className="payment-list" style={{ overflow: 'visible', gap: '8px' }}>
                  {txs.map((item) => (
                    <div key={item.id} className="payment-item" onClick={() => setSelectedTx(item)}>
                      <PaymentIcon type={item.type} category={item.category} />
                      <div className="payment-info">
                        <span className="payment-name">
                          {item.type === 'income' ? 'Дохід' : CATEGORY_NAMES[item.category] || 'Витрата'}
                        </span>
                        <span className="payment-category">
                          {item.description || new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`payment-amount ${item.type === 'expense' ? 'expense' : 'income'}`} style={{ color: item.type === 'income' ? 'var(--apple-blue)' : 'var(--apple-text-on-dark)' }}>
                        {item.type === 'expense' ? '-' : '+'}{formatValue(item.amount, item.currency as Currency || 'EUR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
