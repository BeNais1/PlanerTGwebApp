import { useState, useEffect } from 'react';
import { type Wallet } from '../../services/database';
import { CURRENCY_SYMBOLS } from '../../hooks/useCurrency';
import { WalletPicker, WalletButton } from '../WalletPicker';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import './Modals.css';

const FALLBACK_RATES: Record<string, number> = { EUR: 1.0, USD: 1.08, UAH: 44.0 };

function loadRates(): Record<string, number> {
  try {
    const d = localStorage.getItem('nbu_rates_v2');
    if (d) return JSON.parse(d);
  } catch {}
  return FALLBACK_RATES;
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  const rates = loadRates();
  const inBase = amount / (rates[fromCurrency] ?? 1);
  return inBase * (rates[toCurrency] ?? 1);
}

interface TransferModalProps {
  onClose: () => void;
  onTransfer: (fromWalletId: string, toWalletId: string, amount: number, convertedAmount: number, description: string) => Promise<void>;
  wallets: Wallet[];
  defaultFromWalletId?: string | null;
}

export const TransferModal = ({ onClose, onTransfer, wallets, defaultFromWalletId }: TransferModalProps) => {
  const [fromWalletId, setFromWalletId] = useState<string | null>(defaultFromWalletId ?? wallets[0]?.id ?? null);
  const [toWalletId, setToWalletId] = useState<string | null>(
    wallets.find(w => w.id !== (defaultFromWalletId ?? wallets[0]?.id))?.id ?? null
  );
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const fromWallet = wallets.find(w => w.id === fromWalletId) ?? null;
  const toWallet = wallets.find(w => w.id === toWalletId) ?? null;

  const numAmount = getKeypadNumericValue(amount);
  const convertedAmount = fromWallet && toWallet
    ? convertAmount(numAmount, fromWallet.currency, toWallet.currency)
    : numAmount;

  const sym = (currency: string) =>
    (CURRENCY_SYMBOLS as Record<string, string>)[currency] ?? currency;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (fromWalletId && fromWalletId === toWalletId) {
      const other = wallets.find(w => w.id !== fromWalletId);
      setToWalletId(other?.id ?? null);
    }
  }, [fromWalletId, toWalletId, wallets]);

  const handleSubmit = async () => {
    if (!fromWallet || !toWallet || numAmount <= 0 || isLoading) return;
    setIsLoading(true);
    try {
      await onTransfer(fromWallet.id!, toWallet.id!, numAmount, convertedAmount, description);
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = fromWallet && toWallet && fromWallet.id !== toWallet.id && numAmount > 0;

  return (
    <>
      <div
        className={`modal-overlay ${isClosing ? 'closing' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <div className="modal-header">
            <h2 className="modal-title">Переказ між гаманцями</h2>
            <div className="modal-close" onClick={handleClose}>✕</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="modal-label">З гаманця</span>
              <WalletButton wallet={fromWallet} onClick={() => setFromPickerOpen(true)} placeholder="Оберіть гаманець" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', fontSize: 24, color: 'var(--apple-blue)' }}>
              ↕
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="modal-label">На гаманець</span>
              <WalletButton wallet={toWallet} onClick={() => setToPickerOpen(true)} placeholder="Оберіть гаманець" />
            </div>

            {fromWallet && toWallet && fromWallet.currency !== toWallet.currency && numAmount > 0 && (
              <div style={{
                background: 'var(--apple-surface-2)', borderRadius: 12, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'var(--apple-text-on-dark-secondary)' }}>Конвертація (НБУ)</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {numAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym(fromWallet.currency)}
                  {' → '}
                  {convertedAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym(toWallet.currency)}
                </span>
              </div>
            )}

            <input
              type="text"
              className="modal-input"
              placeholder="Примітка (необов'язково)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />

            <NumericKeypad
              value={amount}
              onChange={setAmount}
              currencySymbol={fromWallet ? sym(fromWallet.currency) : '₴'}
              onSubmit={handleSubmit}
              submitLabel={isLoading ? 'Переказ...' : 'Перекласти'}
              isLoading={isLoading || !canSubmit}
            />
          </div>
        </div>
      </div>

      {fromPickerOpen && (
        <WalletPicker
          wallets={wallets}
          selectedId={fromWalletId}
          onSelect={(w) => setFromWalletId(w.id!)}
          onClose={() => setFromPickerOpen(false)}
        />
      )}

      {toPickerOpen && (
        <WalletPicker
          wallets={wallets.filter(w => w.id !== fromWalletId)}
          selectedId={toWalletId}
          onSelect={(w) => setToWalletId(w.id!)}
          onClose={() => setToPickerOpen(false)}
        />
      )}
    </>
  );
};
