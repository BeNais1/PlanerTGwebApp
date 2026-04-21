import { useState } from 'react';
import './Modals.css';

interface SetBalanceModalProps {
  onSetBalance: (amount: number) => void;
  isLoading?: boolean;
}

export const SetBalanceModal = ({ onSetBalance, isLoading }: SetBalanceModalProps) => {
  const [amount, setAmount] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const handleSetBalance = (numAmount: number) => {
    setIsClosing(true);
    setTimeout(() => onSetBalance(numAmount), 300);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (val.split('.').length > 2) return;
    setAmount(val);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount >= 0) {
      handleSetBalance(numAmount);
    }
  };

  const isValid = amount !== '' && parseFloat(amount) >= 0;

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`}>
        <div className="modal-header">
          <h2 className="modal-title">Початковий баланс</h2>
        </div>

        <p className="modal-label" style={{ paddingLeft: 0, marginTop: '-10px', fontSize: '15px' }}>
          Який у вас бюджет на цей місяць?
        </p>

        <input
          type="text"
          className="modal-amount-input"
          placeholder="0.00 €"
          value={amount ? `${amount} €` : ''}
          onChange={handleAmountChange}
          inputMode="decimal"
        />

        <button
          className="modal-btn-primary"
          disabled={!isValid || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? 'Збереження...' : 'Почати'}
        </button>
      </div>
    </div>
  );
};
