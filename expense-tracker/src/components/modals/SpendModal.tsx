import { useState } from 'react';
import { CURRENCY_SYMBOLS } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import { WalletPicker, WalletButton } from '../WalletPicker';
import { type Wallet } from '../../services/database';
import { TransactionDateField } from './TransactionDateField';
import './Modals.css';

interface SpendModalProps {
  onClose: () => void;
  onSpend: (amount: number, category: string, description: string, walletId: string, date: number) => void;
  isLoading?: boolean;
  wallets: Wallet[];
  defaultWalletId?: string | null;
}

export const SpendModal = ({ onClose, onSpend, isLoading, wallets, defaultWalletId }: SpendModalProps) => {
  const { categories } = useCategories();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => Date.now());
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(defaultWalletId ?? wallets[0]?.id ?? null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const selectedWallet = wallets.find(w => w.id === selectedWalletId) ?? wallets[0] ?? null;
  const currencySymbol = selectedWallet
    ? ((CURRENCY_SYMBOLS as Record<string, string>)[selectedWallet.currency] ?? selectedWallet.currency)
    : '₴';
  const selectedCategory = category || categories[0]?.id || '';

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount > 0 && selectedWallet && selectedCategory) {
      onSpend(numAmount, selectedCategory, description, selectedWallet.id!, transactionDate);
    }
  };

  return (
    <>
      <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className={`modal-content transaction-compose-modal transaction-expense-modal ${isClosing ? 'closing' : ''}`}>
          <section className="transaction-compose-details">
            <div className="modal-header transaction-compose-header">
              <div>
                <span className="transaction-compose-kicker">Нова операція</span>
                <h2 className="modal-title">Витрата</h2>
                <p className="transaction-compose-description">Зафіксуйте покупку та оберіть її категорію.</p>
              </div>
              <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрити">
                ✕
              </button>
            </div>

            <div className="transaction-compose-field">
              <span className="transaction-compose-field-label">Гаманець</span>
              <WalletButton wallet={selectedWallet} onClick={() => setWalletPickerOpen(true)} placeholder="Оберіть гаманець" />
            </div>

            <label className="transaction-compose-field">
              <span className="transaction-compose-field-label">Коментар</span>
              <input
                type="text"
                className="modal-input"
                placeholder="Коментар..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="transaction-compose-field">
              <TransactionDateField value={transactionDate} onChange={setTransactionDate} />
            </div>

            <div className="transaction-compose-field transaction-compose-category-field">
              <span className="transaction-compose-field-label">Категорія</span>
              <div className="transaction-compose-categories">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`transaction-compose-category ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="transaction-compose-entry" aria-label="Сума витрати">
            <div className="transaction-compose-entry-head">
              <span>Введіть суму</span>
              <small>{selectedWallet?.name ?? 'Гаманець не обрано'}</small>
            </div>
            <NumericKeypad
              value={amount}
              onChange={setAmount}
              currencySymbol={currencySymbol}
              onSubmit={handleSubmit}
              submitLabel="Витратити"
              isLoading={isLoading}
            />
          </section>
        </div>
      </div>

      {walletPickerOpen && (
        <WalletPicker
          wallets={wallets}
          selectedId={selectedWalletId}
          onSelect={(w) => setSelectedWalletId(w.id!)}
          onClose={() => setWalletPickerOpen(false)}
        />
      )}
    </>
  );
};
