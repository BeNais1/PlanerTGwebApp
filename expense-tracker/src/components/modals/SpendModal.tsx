import { useState, useEffect } from 'react';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import './Modals.css';

interface SpendModalProps {
  onClose: () => void;
  onSpend: (amount: number, category: string, description: string, currency: Currency) => void;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

export const SpendModal = ({ onClose, onSpend, isLoading, walletBalances }: SpendModalProps) => {
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue } = useCurrency();
  const { categories } = useCategories();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(mainCurrency);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].id);
    }
  }, [categories]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (walletBalances[mainCurrency] !== undefined) {
       setSelectedCurrency(mainCurrency);
    } else if (Object.keys(walletBalances).length > 0) {
       setSelectedCurrency(Object.keys(walletBalances)[0] as Currency);
    }
  }, [mainCurrency]);

  const handleSubmit = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount > 0) {
      onSpend(numAmount, category, description, selectedCurrency);
    }
  };

  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ gap: '12px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Витрата</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        {/* Wallet selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {availableWallets.map((c) => (
            <button
              key={c}
              className={`currency-btn ${selectedCurrency === c ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '12px' }}
              onClick={() => setSelectedCurrency(c)}
            >
              <span style={{ fontWeight: 600 }}>{c}</span>
              <span style={{ opacity: 0.7, fontSize: '11px' }}>{formatValue(walletBalances[c], c)}</span>
            </button>
          ))}
        </div>

        {/* Description */}
        <input
          type="text"
          className="modal-input"
          placeholder="Коментар..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ fontSize: '14px', padding: '10px 14px' }}
        />

        {/* Categories - horizontal scroll */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 10px', borderRadius: '12px', border: 'none',
                background: category === cat.id ? 'var(--accent)' : 'var(--card-bg-2)',
                color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Numeric Keypad */}
        <NumericKeypad
          value={amount}
          onChange={setAmount}
          currencySymbol={CURRENCY_SYMBOLS[selectedCurrency]}
          onSubmit={handleSubmit}
          submitLabel="Витратити"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
