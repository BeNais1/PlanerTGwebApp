import { useState } from 'react';
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
  } catch {
    return FALLBACK_RATES;
  }
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

  const handleFromWalletSelect = (wallet: Wallet) => {
    setFromWalletId(wallet.id!);
    if (wallet.id === toWalletId) {
      setToWalletId(wallets.find((item) => item.id !== wallet.id)?.id ?? null);
    }
  };

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
        <div className={`modal-content transfer-compose-modal ${isClosing ? 'closing' : ''}`}>
          <section className="transfer-compose-details">
            <div className="modal-header transfer-compose-header">
              <div>
                <span className="transfer-compose-kicker">Нова операція</span>
                <h2 className="modal-title">Переказ</h2>
                <p className="transfer-compose-description">Перемістіть кошти між своїми гаманцями.</p>
              </div>
              <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрити">
                ✕
              </button>
            </div>

            <div className="transfer-beta-notice" role="note">
              <span className="transfer-beta-badge">BETA</span>
              <p>
                Розрахунок курсу валют ще тестується. Перевірте суму перед підтвердженням.
              </p>
            </div>

            <div className="transfer-route">
              <div className="transfer-wallet-field">
                <span className="modal-label">З гаманця</span>
                <WalletButton wallet={fromWallet} onClick={() => setFromPickerOpen(true)} placeholder="Оберіть гаманець" />
              </div>

              <div className="transfer-direction" aria-hidden="true">→</div>

              <div className="transfer-wallet-field">
                <span className="modal-label">На гаманець</span>
                <WalletButton wallet={toWallet} onClick={() => setToPickerOpen(true)} placeholder="Оберіть гаманець" />
              </div>
            </div>

            {fromWallet && toWallet && fromWallet.currency !== toWallet.currency && numAmount > 0 && (
              <div className="transfer-conversion">
                <span>Конвертація за курсом НБУ</span>
                <strong>
                  {numAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym(fromWallet.currency)}
                  {' → '}
                  {convertedAmount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym(toWallet.currency)}
                </strong>
              </div>
            )}

            <label className="transfer-note-field">
              <span className="modal-label">Примітка</span>
              <input
                type="text"
                className="modal-input"
                placeholder="Необов'язково"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </label>
          </section>

          <section className="transfer-compose-entry" aria-label="Сума переказу">
            <div className="transfer-compose-entry-head">
              <span>Сума переказу</span>
              <small>{fromWallet ? `З ${fromWallet.name}` : 'Оберіть гаманець'}</small>
            </div>
            <NumericKeypad
              value={amount}
              onChange={setAmount}
              currencySymbol={fromWallet ? sym(fromWallet.currency) : '₴'}
              onSubmit={handleSubmit}
              submitLabel={isLoading ? 'Переказуємо...' : 'Переказати'}
              isLoading={isLoading}
              disabled={!canSubmit}
            />
          </section>
        </div>
      </div>

      {fromPickerOpen && (
        <WalletPicker
          wallets={wallets}
          selectedId={fromWalletId}
          onSelect={handleFromWalletSelect}
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
