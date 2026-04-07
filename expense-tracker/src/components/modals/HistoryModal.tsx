import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllTransactions, type Transaction } from '../../services/database';
import { useCurrency } from '../../hooks/useCurrency';
import { ArrowDown } from '../icons/ArrowDown';
import './Modals.css';

interface HistoryModalProps {
  onClose: () => void;
  CATEGORY_ICONS: Record<string, string>;
  CATEGORY_NAMES: Record<string, string>;
}

export const HistoryModal = ({ onClose, CATEGORY_ICONS, CATEGORY_NAMES }: HistoryModalProps) => {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Group by Month string (e.g. "April 2026")
  const groupedHistory = history.reduce((acc, tx) => {
    const monthName = new Date(tx.date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[monthName]) acc[monthName] = [];
    acc[monthName].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content history-modal-content" style={{ height: '85vh', maxHeight: '85vh' }}>
        <div className="modal-header" style={{ marginBottom: '10px' }}>
          <h2 className="modal-title">Вся история</h2>
          <div className="modal-close" onClick={onClose}>✕</div>
        </div>

        <div className="history-list-container" style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--apple-text-on-dark-tertiary)' }}>Загрузка...</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--apple-text-on-dark-tertiary)' }}>Нет транзакций</div>
          ) : (
            Object.entries(groupedHistory).map(([monthStr, txs]) => (
              <div key={monthStr} className="history-month-group">
                <h3 style={{ fontSize: '15px', color: 'var(--apple-text-on-dark-secondary)', marginBottom: '8px', paddingLeft: '4px' }}>
                  {monthStr}
                </h3>
                <div className="payment-list" style={{ overflow: 'visible', gap: '8px' }}>
                  {txs.map((item) => (
                    <div key={item.id} className="payment-item">
                      <PaymentIcon type={item.type} category={item.category} />
                      <div className="payment-info">
                        <span className="payment-name">
                          {item.type === 'income' ? 'Income' : CATEGORY_NAMES[item.category] || 'Expense'}
                        </span>
                        <span className="payment-category">
                          {item.description || new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`payment-amount ${item.type === 'expense' ? 'expense' : 'income'}`} style={{ color: item.type === 'income' ? 'var(--apple-blue)' : 'var(--apple-text-on-dark)' }}>
                        {item.type === 'expense' ? '-' : '+'}{formatAmount(item.amount)}
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
