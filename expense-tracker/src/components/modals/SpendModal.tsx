import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].id);
    }
  }, [categories]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSubmit = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount > 0 && selectedWallet) {
      onSpend(numAmount, category, description, selectedWallet.id!, transactionDate);
    }
  };

  return (
    <>
      <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ gap: '12px' }}>
          <div className="modal-header">
            <h2 className="modal-title">Витрата</h2>
            <div className="modal-close" onClick={handleClose}>✕</div>
          </div>

          <WalletButton wallet={selectedWallet} onClick={() => setWalletPickerOpen(true)} placeholder="Оберіть гаманець" />

          <input
            type="text"
            className="modal-input"
            placeholder="Коментар..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ fontSize: '14px', padding: '10px 14px' }}
          />

          <TransactionDateField value={transactionDate} onChange={setTransactionDate} />

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '6px 10px', borderRadius: '12px', border: 'none',
                  background: category === cat.id ? 'var(--accent)' : 'var(--card-bg-2)',
                  color: category === cat.id ? 'white' : 'var(--text-primary)', fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          <NumericKeypad
            value={amount}
            onChange={setAmount}
            currencySymbol={currencySymbol}
            onSubmit={handleSubmit}
            submitLabel="Витратити"
            isLoading={isLoading}
          />
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
