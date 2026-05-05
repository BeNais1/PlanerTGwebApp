import { useState } from 'react';
import type { SharedReceipt } from '../services/database';
import { useCategories } from '../hooks/useCategories';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import './SharedReceiptView.css';
import { addTransaction } from '../services/database';
import { useAuth } from '../context/AuthContext';
import { getCurrentMonth } from '../services/database';

interface SharedReceiptViewProps {
  receipt: SharedReceipt;
  onClose: () => void;
}

export const SharedReceiptView = ({ receipt, onClose }: SharedReceiptViewProps) => {
  const { names: CATEGORY_NAMES, icons: CATEGORY_ICONS } = useCategories();
  const { CURRENCY_SYMBOLS } = useCurrency();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tx = receipt.transaction;
  const isIncome = tx.type === 'income';
  const categoryName = isIncome ? 'Дохід' : CATEGORY_NAMES[tx.category] || 'Витрата';
  const categoryIcon = isIncome ? '💰' : CATEGORY_ICONS[tx.category] || '💸';
  const currencySymbol = CURRENCY_SYMBOLS[tx.currency as Currency] || tx.currency;

  const formattedAmount = tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedDate = new Date(tx.date).toLocaleDateString('uk-UA', { 
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const handleSave = async () => {
    if (!user || isSaving || saved) return;
    setIsSaving(true);
    
    // Check if the user is saving their own receipt (optional, but good to know)
    if (user.id.toString() === receipt.creatorId) {
      // You can't really stop them, or maybe you show a message, but let's just let them save it as a copy.
    }

    try {
      await addTransaction(user.id, {
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        description: tx.description || 'Скопійовано з чеку',
        date: Date.now(),
        month: getCurrentMonth(),
        currency: tx.currency
      });
      setSaved(true);
      setTimeout(onClose, 1500); // close after 1.5s
    } catch (error) {
      console.error(error);
      setIsSaving(false);
    }
  };

  return (
    <div className="shared-receipt-overlay">
      <div className="receipt-ticket">
        <div className="receipt-header">
          <div className="receipt-icon">{categoryIcon}</div>
          <h2 className="receipt-title">{categoryName}</h2>
        </div>
        
        <div className={`receipt-amount ${isIncome ? 'income' : 'expense'}`}>
          {isIncome ? '+' : '-'}{formattedAmount} {currencySymbol}
        </div>

        <div className="receipt-divider"></div>

        <div className="receipt-details">
          {tx.description && (
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Опис</span>
              <span className="receipt-detail-value">{tx.description}</span>
            </div>
          )}
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">Категорія</span>
            <span className="receipt-detail-value">{categoryName}</span>
          </div>
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">Дата</span>
            <span className="receipt-detail-value">{formattedDate}</span>
          </div>
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">ID Чеку</span>
            <span className="receipt-detail-value" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {receipt.id.slice(1, 9).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="receipt-actions">
        {user ? (
          <button 
            className="receipt-btn-primary" 
            onClick={handleSave}
            disabled={isSaving || saved}
            style={{ background: saved ? '#34d399' : 'var(--accent)' }}
          >
            {saved ? '✓ Збережено' : isSaving ? 'Збереження...' : 'Зберегти собі'}
          </button>
        ) : (
          <button className="receipt-btn-primary" disabled>
            Увійдіть, щоб зберегти
          </button>
        )}
        <button className="receipt-btn-secondary" onClick={onClose}>
          Закрити чек
        </button>
      </div>
    </div>
  );
};
