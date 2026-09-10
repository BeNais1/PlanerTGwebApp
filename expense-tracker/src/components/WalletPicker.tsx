import { type CSSProperties } from 'react';
import { type Wallet } from '../services/database';
import { CURRENCY_SYMBOLS } from '../hooks/useCurrency';
import './WalletPicker.css';

interface WalletPickerProps {
  wallets: Wallet[];
  selectedId: string | null;
  onSelect: (wallet: Wallet) => void;
  onClose: () => void;
  onAddWallet?: () => void;
}

const WALLET_COLORS: Record<string, string> = {
  UAH: '#283342',
  USD: '#293a35',
  EUR: '#3a3530',
};

// Wallet cards reuse the same currency gradient as picker items.
// eslint-disable-next-line react-refresh/only-export-components
export function walletColor(currency: string): string {
  return WALLET_COLORS[currency] ?? '#34343a';
}

const walletAccentStyle = (currency: string): CSSProperties => ({
  '--wallet-accent': walletColor(currency),
} as CSSProperties);

export const WalletPicker = ({
  wallets,
  selectedId,
  onSelect,
  onClose,
  onAddWallet,
}: WalletPickerProps) => {
  const sym = (currency: string) =>
    (CURRENCY_SYMBOLS as Record<string, string>)[currency] ?? currency;

  return (
    <div
      className="wallet-picker-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section className="wallet-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="wallet-picker-title">
        <div className="wallet-picker-handle" />

        <header className="wallet-picker-header">
          <div>
            
            <h2 id="wallet-picker-title">Оберіть гаманець</h2>
            
          </div>
          <button type="button" className="wallet-picker-close" onClick={onClose} aria-label="Закрити">
            ×
          </button>
        </header>

        <div className="wallet-picker-list">
          {wallets.map((wallet) => {
            const isSelected = wallet.id === selectedId;
            const balance = wallet.balance ?? 0;
            const currSym = sym(wallet.currency);
            return (
              <button
                type="button"
                key={wallet.id}
                onClick={() => { onSelect(wallet); onClose(); }}
                className={`wallet-picker-option ${isSelected ? 'is-selected' : ''}`}
              >
                <div className="wallet-picker-icon" style={walletAccentStyle(wallet.currency)}>
                  {wallet.name.charAt(0).toUpperCase()}
                </div>

                <div className="wallet-picker-copy">
                  <strong>{wallet.name}</strong>
                  <small>{wallet.currency}</small>
                </div>

                <div className="wallet-picker-balance">
                  <strong>
                    {balance.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currSym}
                  </strong>
                  {isSelected && (
                    <small>
                      Вибрано ✓
                    </small>
                  )}
                </div>
              </button>
            );
          })}

          {onAddWallet && (
            <button
              type="button"
              className="wallet-picker-add"
              onClick={() => { onClose(); onAddWallet(); }}
            >
              <span className="wallet-picker-add-icon">+</span>
              <span>Додати гаманець</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

// Inline trigger button — shows selected wallet or placeholder
interface WalletButtonProps {
  wallet: Wallet | null;
  onClick: () => void;
  placeholder?: string;
}

export const WalletButton = ({ wallet, onClick, placeholder = 'Оберіть гаманець' }: WalletButtonProps) => {
  const sym = wallet ? ((CURRENCY_SYMBOLS as Record<string, string>)[wallet.currency] ?? wallet.currency) : '';
  const balance = wallet?.balance ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="wallet-trigger"
    >
      {wallet ? (
        <>
          <span className="wallet-trigger-icon" style={walletAccentStyle(wallet.currency)}>
            {wallet.name.charAt(0).toUpperCase()}
          </span>
          <span className="wallet-trigger-copy">
            <strong>{wallet.name}</strong>
            <small>
              {balance.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
            </small>
          </span>
          <span className="wallet-trigger-arrow">›</span>
        </>
      ) : (
        <>
          <span className="wallet-trigger-icon is-placeholder">
            💳
          </span>
          <span className="wallet-trigger-placeholder">
            {placeholder}
          </span>
          <span className="wallet-trigger-arrow">›</span>
        </>
      )}
    </button>
  );
};
