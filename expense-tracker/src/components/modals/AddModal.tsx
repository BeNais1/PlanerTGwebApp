import { useState } from 'react';
import { CURRENCY_SYMBOLS } from '../../hooks/useCurrency';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import { WalletPicker, WalletButton } from '../WalletPicker';
import { type Wallet } from '../../services/database';
import './Modals.css';

interface AddModalProps {
  onClose: () => void;
  onAdd: (amount: number, description: string, walletId: string) => void;
  isLoading?: boolean;
  wallets: Wallet[];
  defaultWalletId?: string | null;
}

export const AddModal = ({ onClose, onAdd, isLoading, wallets, defaultWalletId }: AddModalProps) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
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
      onAdd(numAmount, description, selectedWallet.id!);
    }
  };

  return (
    <>
      <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ gap: '12px' }}>
          <div className="modal-header">
            <h2 className="modal-title" style={{ color: 'var(--accent)' }}>Дохід</h2>
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

          <NumericKeypad
            value={amount}
            onChange={setAmount}
            currencySymbol={currencySymbol}
            onSubmit={handleSubmit}
            submitLabel="Поповнити"
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
