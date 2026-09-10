import { ReceiptScanner } from '../ReceiptScanner';
import { TagInput } from '../TagInput';
import { normalizeTags } from '../../domain/planning';
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
  onSpend: (amount: number, category: string, description: string, walletId: string, date: number, tags?: string[]) => void;
  isLoading?: boolean;
  wallets: Wallet[];
  defaultWalletId?: string | null;
}

export const SpendModal = ({ onClose, onSpend, isLoading, wallets, defaultWalletId }: SpendModalProps) => {
  const { categories } = useCategories();
  const [amount, setAmount] = useState('');
  const [tags, setTags] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState('');
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
    if (!scanning && !isLoading && numAmount > 0 && selectedWallet && selectedCategory) {
      onSpend(numAmount, selectedCategory, description, selectedWallet.id!, transactionDate, normalizeTags(tags));
    }
  };

  return (
    <>
      <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className={`modal-content transaction-compose-modal transaction-expense-modal ${isClosing ? 'closing' : ''}`}>
          <section className="transaction-compose-details">
            <div className="modal-header transaction-compose-header">
              <div>
                <h2 className="modal-title">Витрата</h2>
              </div>
              <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрити">
                ✕
              </button>
            </div>

            <ReceiptScanner onBusyChange={setScanning} onRecognized={draft => {
              setDetailsOpen(true);
              setAmount(draft.amount ? String(draft.amount) : '');
              setDescription(draft.description);
              if (draft.date) setTransactionDate(draft.date);
              const matchingWallet = wallets.find(wallet => wallet.currency === draft.currency);
              if (matchingWallet?.id) setSelectedWalletId(matchingWallet.id);
              setScanNotice(`${draft.amount ? 'Перевірте суму, дату та категорію.' : 'Суму не знайдено — введіть її вручну.'}${draft.currency && !matchingWallet ? ` Валюта чека: ${draft.currency}. Оберіть відповідний гаманець.` : ''}`);
            }} />
            {scanNotice && <p role="status" className="field-hint">{scanNotice}</p>}
            <div className="transaction-compose-field">
              <span className="transaction-compose-field-label">Гаманець</span>
              <WalletButton wallet={selectedWallet} onClick={() => setWalletPickerOpen(true)} placeholder="Оберіть гаманець" />
            </div>

            <label className="transaction-compose-field">
              <span className="transaction-compose-field-label">Категорія</span>
              <select className="modal-input" aria-label="Категорія" value={selectedCategory} onChange={event => setCategory(event.target.value)}>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
              </select>
            </label>
            <details className="minimal-disclosure" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary>Деталі{tags ? ` · ${normalizeTags(tags).length} тегів` : ''}</summary>
            <TagInput value={tags} onChange={setTags} />
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

            </details>

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
              isLoading={isLoading || scanning}
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
