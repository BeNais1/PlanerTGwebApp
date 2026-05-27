import { useState } from 'react';
import { CURRENCY_SYMBOLS } from '../../hooks/useCurrency';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import { WalletPicker, WalletButton } from '../WalletPicker';
import { type Wallet } from '../../services/database';
import { TransactionDateField } from './TransactionDateField';
import './Modals.css';

interface AddModalProps {
  onClose: () => void;
  onAdd: (amount: number, description: string, walletId: string, date: number) => void;
  isLoading?: boolean;
  wallets: Wallet[];
  defaultWalletId?: string | null;
}

export const AddModal = ({ onClose, onAdd, isLoading, wallets, defaultWalletId }: AddModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => Date.now());
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(defaultWalletId ?? wallets[0]?.id ?? null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const selectedWallet = wallets.find(w => w.id === selectedWalletId) ?? wallets[0] ?? null;
  const currencySymbol = selectedWallet
    ? ((CURRENCY_SYMBOLS as Record<string, string>)[selectedWallet.currency] ?? selectedWallet.currency)
    : '₴';

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount > 0 && selectedWallet) {
      onAdd(numAmount, description, selectedWallet.id!, transactionDate);
    }
  };

  return (
    <>
      <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className={`modal-content transaction-compose-modal transaction-income-modal ${isClosing ? 'closing' : ''}`}>
          <section className="transaction-compose-details">
            <div className="modal-header transaction-compose-header">
              <div>
                <span className="transaction-compose-kicker">Нова операція</span>
                <h2 className="modal-title">Дохід</h2>
                <p className="transaction-compose-description">Додайте надходження до обраного гаманця.</p>
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

            <div className="transaction-compose-note" role="note">
              <strong>Надходження</strong>
              <p>Після підтвердження сума одразу збільшить баланс вибраного гаманця.</p>
            </div>
          </section>

          <section className="transaction-compose-entry" aria-label="Сума доходу">
            <div className="transaction-compose-entry-head">
              <span>Введіть суму</span>
              <small>{selectedWallet?.name ?? 'Гаманець не обрано'}</small>
            </div>
            <NumericKeypad
              value={amount}
              onChange={setAmount}
              currencySymbol={currencySymbol}
              onSubmit={handleSubmit}
              submitLabel="Поповнити"
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
