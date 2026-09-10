import { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import { useFamilyBudget } from '../../context/useFamilyBudget';
import { subscribeToAllTransactions, type Transaction } from '../../services/database';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { PaymentIcon } from '../PaymentIcon';
import { TransactionDetailModal } from './TransactionDetailModal';
import { JointCheckDetailModal } from '../JointCheckDetailModal';
import { updateTransaction } from '../../services/database';
import './Modals.css';
import '../JointCheck.css';

interface HistoryModalProps {
  onClose: () => void;
  onDeleteTransaction: (transaction: Transaction) => Promise<void>;
  walletBalances?: Record<string, number>;
}

export const HistoryModal = ({ onClose, onDeleteTransaction }: HistoryModalProps) => {
  const { user } = useAuth();
  const { activeSpace, dataOwnerId, isFamily } = useFamilyBudget();
  const { formatValue } = useCurrency();
  const { names: CATEGORY_NAMES } = useCategories();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedJointCheckId, setSelectedJointCheckId] = useState<string | null>(null);
  const [isTxActionLoading, setIsTxActionLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (!user || !dataOwnerId) return;
    return subscribeToAllTransactions(dataOwnerId, (allTxs) => {
      setHistory(allTxs);
      setLoading(false);
    }, (error) => {
      console.error('History subscription failed:', error);
      setLoading(false);
    });
  }, [user, dataOwnerId]);

  const handleDelete = async (id: string) => {
    const transaction = history.find((item) => item.id === id);
    if (!transaction) return;
    setIsTxActionLoading(true);
    try {
      await onDeleteTransaction(transaction);
      setSelectedTx(null);
    } finally {
      setIsTxActionLoading(false);
    }
  };

  const handleUpdate = async (id: string, data: Partial<Transaction>) => {
    if (!user) return;
    setIsTxActionLoading(true);
    await updateTransaction(dataOwnerId, id, { ...data, updatedAt: Date.now() });
    setHistory(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    setSelectedTx(prev => prev && prev.id === id ? { ...prev, ...data } : prev);
    setIsTxActionLoading(false);
  };

  // Using shared PaymentIcon component
  const handleOpenTransaction = (transaction: Transaction) => {
    if (transaction.jointCheckId) {
      setSelectedJointCheckId(transaction.jointCheckId);
      return;
    }
    setSelectedTx(transaction);
  };

  const filteredHistory = history.filter((tx) => {
    const query = searchQuery.trim().toLowerCase();
    const categoryName = CATEGORY_NAMES[tx.category] || "";
    if (!query) return true;

    const haystack = `${(tx.tags || []).map(tag => '#' + tag).join(' ')} ${tx.description} ${tx.category} ${categoryName} ${tx.amount} ${tx.currency || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  // Group by Month string
  const groupedHistory = filteredHistory.reduce((acc, tx) => {
    const monthName = new Date(tx.date).toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    if (!acc[monthName]) acc[monthName] = [];
    acc[monthName].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          isLoading={isTxActionLoading}
          canEdit={!isFamily || activeSpace.role !== 'member' || selectedTx.authorId === String(user?.id)}
        />
      )}
      {selectedJointCheckId && (
        <JointCheckDetailModal
          jointCheckId={selectedJointCheckId}
          onClose={() => setSelectedJointCheckId(null)}
        />
      )}

      <div className={`modal-content history-modal-content ${isClosing ? 'closing' : ''}`} style={{ height: '85vh', maxHeight: '85vh' }}>
        <div className="modal-header" style={{ marginBottom: '10px' }}>
          <h2 className="modal-title">Уся історія</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        <input
          className="history-search-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Пошук за сумою, категорією або описом"
        />

        <div className="history-list-container" style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>Завантаження...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>Немає транзакцій</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>Нічого не знайдено</div>
          ) : (
            Object.entries(groupedHistory).map(([monthStr, txs]) => (
              <div key={monthStr} className="history-month-group">
                <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '8px', paddingLeft: '4px' }}>
                  {monthStr}
                </h3>
                 <div className="payment-list" style={{ overflow: 'visible', gap: '8px' }}>
                  {txs.map((item) => (
                    <div key={item.id} className={`payment-item ${item.isJointCheck ? 'joint-check-highlight' : ''}`} onClick={() => handleOpenTransaction(item)}>
                      <PaymentIcon type={item.type} category={item.category} />
                      <div className="payment-info">
                        <span className="payment-name">
                          {item.type === 'income' ? 'Дохід' : CATEGORY_NAMES[item.category] || 'Витрата'}
                        </span>
                        <span className="payment-category">
                          {item.description || new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`payment-amount ${item.type === 'expense' ? 'expense' : 'income'}`} style={{ color: item.type === 'income' ? 'var(--accent)' : 'var(--text-primary)' }}>
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
