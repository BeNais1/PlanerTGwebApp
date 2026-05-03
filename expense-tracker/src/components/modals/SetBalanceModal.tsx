import { useState } from 'react';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import './Modals.css';

interface SetBalanceModalProps {
  onSetBalance: (amount: number, currency?: Currency) => void;
  isLoading?: boolean;
}

export const SetBalanceModal = ({ onSetBalance, isLoading }: SetBalanceModalProps) => {
  const { currency: mainCurrency, CURRENCY_SYMBOLS } = useCurrency();
  const [amount, setAmount] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const handleSetBalance = (numAmount: number) => {
    setIsClosing(true);
    setTimeout(() => onSetBalance(numAmount, mainCurrency), 300);
  };

  const handleSubmit = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount >= 0) {
      handleSetBalance(numAmount);
    }
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ gap: '12px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Початковий баланс</h2>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '-8px' }}>
          Який у вас бюджет на цей місяць?
        </p>

        {/* Numeric Keypad */}
        <NumericKeypad
          value={amount}
          onChange={setAmount}
          currencySymbol={CURRENCY_SYMBOLS[mainCurrency]}
          onSubmit={handleSubmit}
          submitLabel={isLoading ? 'Збереження...' : 'Почати'}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
