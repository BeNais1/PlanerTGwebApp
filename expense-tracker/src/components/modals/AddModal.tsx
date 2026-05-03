import { useState, useEffect } from 'react';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import './Modals.css';

interface AddModalProps {
  onClose: () => void;
  onAdd: (amount: number, description: string, currency: Currency) => void;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

export const AddModal = ({ onClose, onAdd, isLoading, walletBalances }: AddModalProps) => {
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue } = useCurrency();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(mainCurrency);
  const [isClosing, setIsClosing] = useState(false);

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
      onAdd(numAmount, description, selectedCurrency);
    }
  };

  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ gap: '12px' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: 'var(--accent)' }}>Дохід</h2>
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

        {/* Numeric Keypad */}
        <NumericKeypad
          value={amount}
          onChange={setAmount}
          currencySymbol={CURRENCY_SYMBOLS[selectedCurrency]}
          onSubmit={handleSubmit}
          submitLabel="Поповнити"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
