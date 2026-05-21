import { useState } from 'react';
import { NumericKeypad, getKeypadNumericValue } from './NumericKeypad';
import { CURRENCY_SYMBOLS } from '../hooks/useCurrency';

const CURRENCIES = ['UAH', 'EUR', 'USD'] as const;
type Cur = typeof CURRENCIES[number];

interface WalletSetupScreenProps {
  onComplete: (name: string, currency: string, balance: number) => Promise<void>;
}

export const WalletSetupScreen = ({ onComplete }: WalletSetupScreenProps) => {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Cur>('UAH');
  const [balanceInput, setBalanceInput] = useState('');
  const [step, setStep] = useState<'info' | 'balance'>('info');
  const [isSaving, setIsSaving] = useState(false);

  const canProceed = name.trim().length > 0;

  const handleCreate = async () => {
    if (!canProceed || isSaving) return;
    setIsSaving(true);
    const balance = getKeypadNumericValue(balanceInput);
    await onComplete(name.trim(), currency, balance);
    setIsSaving(false);
  };

  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)',
      padding: 'calc(var(--safe-area-top, 44px) + 24px) 24px calc(var(--safe-area-bottom, 24px) + 24px)',
    }}>
      {step === 'info' ? (
        <>
          {/* Hero */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12 }}>
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 8 }}>💰</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Expense Tracker
            </h1>
            <p style={{ fontSize: 16, color: 'var(--apple-text-on-dark-secondary)', margin: 0, lineHeight: 1.5, maxWidth: 280 }}>
              Відстежуй витрати, доходи та баланс по кожному гаманцю — просто й зручно
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              {['📊 Аналітика', '🔔 Нагадування', '💳 Гаманці'].map(f => (
                <div key={f} style={{
                  padding: '8px 12px', borderRadius: 20,
                  background: 'var(--apple-surface-1)',
                  fontSize: 13, color: 'var(--apple-text-on-dark-secondary)', fontWeight: 500,
                }}>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--apple-text-on-dark-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Перший гаманець
            </div>

            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Наприклад: Монобанк, Готівка..."
              maxLength={30}
              style={{
                padding: '14px 16px', background: 'var(--apple-surface-1)',
                border: 'none', borderRadius: 14, color: 'var(--text-primary)',
                fontSize: 17, fontFamily: 'var(--font-text)', outline: 'none',
              }}
            />

            {/* Currency */}
            <div style={{ display: 'flex', gap: 8 }}>
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  style={{
                    flex: 1, padding: '12px 8px', border: 'none', borderRadius: 12,
                    background: currency === c ? 'var(--apple-blue)' : 'var(--apple-surface-1)',
                    color: currency === c ? '#fff' : 'var(--text-primary)',
                    fontWeight: 700, fontSize: 16, cursor: 'pointer',
                  }}
                >
                  {CURRENCY_SYMBOLS[c]} {c}
                </button>
              ))}
            </div>

            <button
              disabled={!canProceed}
              onClick={() => setStep('balance')}
              style={{
                padding: '16px', border: 'none', borderRadius: 14,
                background: canProceed ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
                color: canProceed ? '#fff' : 'var(--apple-text-on-dark-tertiary)',
                fontWeight: 700, fontSize: 17, cursor: canProceed ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
            >
              Далі →
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setStep('info')}
              style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', fontSize: 17, cursor: 'pointer', padding: '4px 0' }}>
              ← Назад
            </button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💳</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {name}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--apple-text-on-dark-secondary)', marginTop: 4 }}>
              Введіть поточний баланс гаманця (необов'язково)
            </p>
          </div>

          <NumericKeypad
            value={balanceInput}
            onChange={setBalanceInput}
            currencySymbol={sym}
            onSubmit={handleCreate}
            submitLabel={isSaving ? 'Збереження...' : 'Створити гаманець 🚀'}
            isLoading={isSaving}
          />
        </>
      )}
    </div>
  );
};
