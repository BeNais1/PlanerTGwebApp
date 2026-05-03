import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { type Transaction, getMonthlyBalance, getTransactions } from '../../services/database';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import { toPng } from 'html-to-image';
import './Modals.css';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Transaction>) => Promise<void>;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

const ReceiptIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 11H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 15H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TransactionDetailModal = ({ 
  transaction, 
  onClose, 
  onDelete, 
  onUpdate,
  isLoading,
  walletBalances
}: TransactionDetailModalProps) => {
  const { formatValue, CURRENCY_SYMBOLS } = useCurrency();
  const { categories, names: CATEGORY_NAMES, icons: CATEGORY_ICONS } = useCategories();
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Edit State
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [description, setDescription] = useState(transaction.description || '');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(transaction.currency as Currency || 'EUR');
  const { user } = useAuth();
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !transaction.month) return;

    const calculateBalanceAfter = async () => {
      const mData = await getMonthlyBalance(user.id, transaction.month);
      const txs = await getTransactions(user.id, transaction.month);
      
      let runningBalance = 0;
      const cur = transaction.currency || 'EUR';

      if (mData) {
        if (cur === 'EUR' && mData.initialBalance) {
          runningBalance = mData.initialBalance;
        } else if (mData.balances && mData.balances[cur] !== undefined) {
          runningBalance = mData.balances[cur];
        }
      }

      const sortedTxs = [...txs].sort((a, b) => a.date - b.date);

      for (const tx of sortedTxs) {
        if ((tx.currency || 'EUR') === cur) {
          if (tx.type === 'income') runningBalance += tx.amount;
          else runningBalance -= tx.amount;
        }
        if (tx.id === transaction.id) break;
      }

      setBalanceAfter(runningBalance);
    };

    calculateBalanceAfter();
  }, [user, transaction]);

  const handleShare = async () => {
    if (!receiptRef.current || isSharing) return;
    try {
      setIsSharing(true);
      const dataUrl = await toPng(receiptRef.current, { quality: 0.95, backgroundColor: '#fff', pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `receipt_${transaction.date}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Чек транзакції', text: `Чек: ${transaction.type === 'expense' ? 'Витрата' : 'Дохід'} ${transaction.amount} ${transaction.currency}` });
      } else {
        const link = document.createElement('a');
        link.download = `receipt_${transaction.date}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      alert('Не вдалося поділитися чеком.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSave = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount > 0) {
      onUpdate(transaction.id!, {
        amount: numAmount, category, description, currency: selectedCurrency });
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Ви впевнені, що хочете видалити цю транзакцію?')) {
      await onDelete(transaction.id!);
      handleClose();
    }
  };

  const dateStr = new Date(transaction.date).toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const availableWallets = Object.keys(walletBalances) as Currency[];
  const catObj = categories.find(c => c.id === transaction.category);

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Змінити' : 'Деталі'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!isEditing && (
              <div className="modal-close" onClick={handleShare}
                style={{ cursor: 'pointer', opacity: isSharing ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
                {isSharing ? <SpinnerIcon /> : <ReceiptIcon />}
              </div>
            )}
            <div className="modal-close" onClick={handleClose}>✕</div>
          </div>
        </div>

        {isEditing ? (
          <>
            <NumericKeypad
              value={amount}
              onChange={setAmount}
              currencySymbol={CURRENCY_SYMBOLS[selectedCurrency]}
              onSubmit={handleSave}
              submitLabel="Зберегти"
              isLoading={isLoading}
            />

            <div className="modal-input-group">
              <label className="modal-label">Гаманець</label>
              <div className="currency-selector" style={{ flexWrap: 'wrap' }}>
                {availableWallets.map((c) => (
                  <button key={c}
                    className={`currency-btn ${selectedCurrency === c ? 'active' : ''}`}
                    style={{ padding: '8px 4px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    onClick={() => setSelectedCurrency(c)}>
                    <span>{c}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{formatValue(walletBalances[c], c)}</span>
                  </button>
                ))}
              </div>
            </div>

            {transaction.type === 'expense' && (
              <div className="modal-input-group">
                <label className="modal-label">Категорія</label>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {categories.map((cat) => (
                    <button key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 10px', borderRadius: '12px', border: 'none',
                        background: category === cat.id ? 'var(--accent)' : 'var(--card-bg-2)',
                        color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500,
                        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-input-group">
              <label className="modal-label">Коментар</label>
              <input type="text" className="modal-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <button className="modal-btn-primary" style={{ background: 'var(--card-bg-3)', marginTop: '8px' }} onClick={() => setIsEditing(false)}>
              Скасувати
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: '700', color: transaction.type === 'income' ? 'var(--apple-blue)' : 'var(--apple-text-on-dark)' }}>
                {transaction.type === 'expense' ? '-' : '+'}{formatValue(transaction.amount, selectedCurrency)}
              </div>
              <div style={{ color: 'var(--apple-text-on-dark-tertiary)', fontSize: '14px', marginTop: '4px' }}>
                {dateStr}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--apple-surface-2)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Тип</span>
                <span style={{ fontWeight: '500' }}>{transaction.type === 'income' ? 'Дохід' : 'Витрата'}</span>
              </div>
              
              {transaction.type === 'expense' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Категорія</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{catObj?.icon || CATEGORY_ICONS[transaction.category] || '📦'}</span>
                    <span style={{ fontWeight: '500' }}>{catObj?.name || CATEGORY_NAMES[transaction.category] || transaction.category}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Гаманець</span>
                <span style={{ fontWeight: '500' }}>{selectedCurrency}</span>
              </div>

              {balanceAfter !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Баланс після</span>
                  <span style={{ fontWeight: '600', color: 'var(--apple-text-on-dark)' }}>
                    {formatValue(balanceAfter, selectedCurrency as Currency)}
                  </span>
                </div>
              )}

              {transaction.description && (
                <div style={{ borderTop: '1px solid var(--apple-surface-3)', paddingTop: '16px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Коментар</span>
                  <p style={{ fontSize: '16px', lineHeight: '1.4' }}>{transaction.description}</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button className="modal-btn-primary" style={{ flex: 1, background: 'var(--apple-surface-2)', color: '#ff453a' }} onClick={handleDelete} disabled={isLoading}>
                Видалити
              </button>
              <button className="modal-btn-primary" style={{ flex: 2 }} onClick={() => setIsEditing(true)}>
                Змінити
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Receipt Template */}
      <div className="receipt-container">
        <div ref={receiptRef} className="receipt-template">
          <div className="receipt-header">
            <div className="receipt-logo">PLANER</div>
            <div className="receipt-brand">Expense Tracker</div>
          </div>
          <div className="receipt-divider" />
          <div className="receipt-amount" style={{ color: transaction.type === 'income' ? '#007aff' : '#1c1c1e' }}>
            {transaction.type === 'expense' ? '-' : '+'}{formatValue(transaction.amount, transaction.currency as Currency || 'EUR')}
          </div>
          <div style={{ color: '#8e8e93', fontSize: '13px', marginBottom: '10px' }}>{dateStr}</div>
          <div className="receipt-divider" />
          <div className="receipt-details">
            <div className="receipt-row">
              <span className="receipt-label">Тип</span>
              <span className="receipt-value">{transaction.type === 'income' ? 'Дохід' : 'Витрата'}</span>
            </div>
            {transaction.type === 'expense' && (
              <div className="receipt-row">
                <span className="receipt-label">Категорія</span>
                <span className="receipt-value">{catObj?.name || CATEGORY_NAMES[transaction.category] || transaction.category}</span>
              </div>
            )}
            <div className="receipt-row">
              <span className="receipt-label">Гаманець</span>
              <span className="receipt-value">{transaction.currency}</span>
            </div>
            {balanceAfter !== null && (
              <div className="receipt-row">
                <span className="receipt-label">Баланс після</span>
                <span className="receipt-value">{formatValue(balanceAfter, transaction.currency as Currency || 'EUR')}</span>
              </div>
            )}
            {transaction.description && (
              <>
                <div className="receipt-divider" style={{ margin: '15px 0' }} />
                <div style={{ width: '100%' }}>
                  <span className="receipt-label" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Коментар</span>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4' }}>{transaction.description}</p>
                </div>
              </>
            )}
          </div>
          <div className="receipt-footer">
            Дякуємо за використання Planer!<br/>
            t.me/planer0bot
          </div>
        </div>
      </div>
    </div>
  );
};
