import { type Wallet } from '../services/database';
import { CURRENCY_SYMBOLS } from '../hooks/useCurrency';

interface WalletPickerProps {
  wallets: Wallet[];
  selectedId: string | null;
  onSelect: (wallet: Wallet) => void;
  onClose: () => void;
  onAddWallet?: () => void;
}

const WALLET_COLORS = [
  'linear-gradient(135deg,#1e3a6e,#2563eb)',
  'linear-gradient(135deg,#064e3b,#059669)',
  'linear-gradient(135deg,#3b1f0d,#b45309)',
  'linear-gradient(135deg,#2d1b69,#7c3aed)',
  'linear-gradient(135deg,#7c1f1f,#dc2626)',
  'linear-gradient(135deg,#1a3a4a,#0891b2)',
];

export function walletColor(index: number): string {
  return WALLET_COLORS[index % WALLET_COLORS.length];
}

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
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--apple-surface-1)',
        borderRadius: '20px 20px 0 0',
        padding: '12px 0 32px',
        maxHeight: '70vh',
        overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--apple-surface-3)', margin: '0 auto 16px' }} />

        <div style={{ padding: '0 16px', marginBottom: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
            Оберіть гаманець
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {wallets.map((wallet, idx) => {
            const isSelected = wallet.id === selectedId;
            const balance = wallet.balance ?? 0;
            const currSym = sym(wallet.currency);
            return (
              <button
                key={wallet.id}
                onClick={() => { onSelect(wallet); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 16px',
                  background: isSelected ? 'var(--apple-surface-2)' : 'transparent',
                  border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: walletColor(idx),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff',
                }}>
                  {wallet.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {wallet.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--apple-text-on-dark-tertiary)', marginTop: 2 }}>
                    {wallet.currency}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {balance.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currSym}
                  </div>
                  {isSelected && (
                    <div style={{ fontSize: 11, color: 'var(--apple-blue)', fontWeight: 600, marginTop: 2 }}>
                      Вибрано ✓
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {onAddWallet && (
            <button
              onClick={() => { onClose(); onAddWallet(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px', background: 'transparent', border: 'none',
                cursor: 'pointer', width: '100%', textAlign: 'left', marginTop: 4,
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: 'var(--apple-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: 'var(--apple-blue)',
              }}>
                +
              </div>
              <span style={{ fontSize: 16, color: 'var(--apple-blue)', fontWeight: 500 }}>
                Додати гаманець
              </span>
            </button>
          )}
        </div>
      </div>
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
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: 'var(--apple-surface-2)',
        border: 'none', borderRadius: 14, cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {wallet ? (
        <>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--apple-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>
            {wallet.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{wallet.name}</div>
            <div style={{ fontSize: 12, color: 'var(--apple-text-on-dark-tertiary)' }}>
              {balance.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
            </div>
          </div>
          <span style={{ color: 'var(--apple-text-on-dark-tertiary)', fontSize: 18 }}>›</span>
        </>
      ) : (
        <>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--apple-surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'var(--apple-text-on-dark-tertiary)',
          }}>
            💳
          </div>
          <span style={{ fontSize: 15, color: 'var(--apple-text-on-dark-secondary)', flex: 1 }}>
            {placeholder}
          </span>
          <span style={{ color: 'var(--apple-text-on-dark-tertiary)', fontSize: 18 }}>›</span>
        </>
      )}
    </button>
  );
};
