import { useState, useEffect } from 'react';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
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

  // Set default category once categories load
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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (val.split('.').length > 2) return;
    setAmount(val);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      onSpend(numAmount, category, description, selectedCurrency);
    }
  };

  const isValid = parseFloat(amount) > 0;
  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`}>
        <div className="modal-header">
          <h2 className="modal-title">Витрата</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        <input
          type="text"
          className="modal-amount-input"
          placeholder={`0.00 ${CURRENCY_SYMBOLS[selectedCurrency]}`}
          value={amount}
          onChange={handleAmountChange}
          inputMode="decimal"
        />

        <div className="modal-input-group">
          <label className="modal-label">Гаманець</label>
          <div className="currency-selector" style={{ flexWrap: 'wrap' }}>
            {availableWallets.map((c) => (
              <button
                key={c}
                className={`currency-btn ${selectedCurrency === c ? 'active' : ''}`}
                style={{ padding: '8px 4px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                onClick={() => setSelectedCurrency(c)}
              >
                <span>{c}</span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>{formatValue(walletBalances[c], c)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-input-group">
          <label className="modal-label">Категорія</label>
          <div className="categories-grid">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`category-item ${category === cat.id ? 'active' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                <div className="category-icon">{cat.icon}</div>
                <span className="category-name">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-input-group">
          <label className="modal-label">Коментар (необов'язково)</label>
          <input
            type="text"
            className="modal-input"
            placeholder="Наприклад, кава з колегами"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          className="modal-btn-primary"
          disabled={!isValid || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? 'Збереження...' : 'Витратити'}
        </button>
      </div>
    </div>
  );
};
