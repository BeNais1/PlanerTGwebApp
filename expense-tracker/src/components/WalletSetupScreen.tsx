import { useState } from 'react';
import { NumericKeypad, getKeypadNumericValue } from './NumericKeypad';
import { CURRENCY_SYMBOLS } from '../hooks/useCurrency';
import './WalletSetupScreen.css';

const CURRENCIES = ['UAH', 'EUR', 'USD'] as const;
const FEATURES = ['Аналітика', 'Нагадування', 'Гаманці'];
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
    <div className={`wallet-setup-screen ${step === 'balance' ? 'is-balance-step' : ''}`}>
      {step === 'info' ? (
        <div className="wallet-setup-layout">
          <section className="wallet-setup-hero">
            <div className="wallet-setup-emoji" aria-hidden="true">💰</div>
            <h1 className="wallet-setup-brand">Planer</h1>
            <span className="wallet-setup-beta">BETA-ВЕРСІЯ</span>
            <p className="wallet-setup-description">
              Відстежуйте витрати, доходи та баланс по кожному гаманцю.
              Деякі функції ще тестуються.
            </p>

            <div className="wallet-setup-features">
              {FEATURES.map(feature => (
                <span key={feature}>{feature}</span>
              ))}
            </div>
          </section>

          <section className="wallet-setup-form">
            <span className="wallet-setup-mobile-kicker">Перший гаманець</span>
            <div className="wallet-setup-form-copy">
              <span className="wallet-setup-kicker">Перший гаманець</span>
              <h2>Створіть простір для грошей</h2>
              <p>Вкажіть назву та валюту. Баланс можна додати наступним кроком.</p>
            </div>

            <label className="wallet-setup-field">
              <span>Назва гаманця</span>
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Наприклад: Монобанк, Готівка..."
                maxLength={30}
              />
            </label>

            <div className="wallet-setup-currencies" aria-label="Валюта">
              {CURRENCIES.map(item => (
                <button
                  key={item}
                  type="button"
                  className={currency === item ? 'active' : ''}
                  onClick={() => setCurrency(item)}
                  aria-pressed={currency === item}
                >
                  {CURRENCY_SYMBOLS[item]} {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="wallet-setup-next"
              disabled={!canProceed}
              onClick={() => setStep('balance')}
            >
              Далі →
            </button>
          </section>
        </div>
      ) : (
        <div className="wallet-balance-layout">
          <section className="wallet-balance-intro">
            <button type="button" className="wallet-setup-back" onClick={() => setStep('info')}>
              ← Назад
            </button>
            <div className="wallet-balance-emoji" aria-hidden="true">💳</div>
            <span className="wallet-setup-kicker">Поточний баланс</span>
            <h1>{name}</h1>
            <p>Введіть поточний баланс гаманця. Цей крок необов'язковий.</p>
          </section>

          <section className="wallet-setup-keypad">
            <NumericKeypad
              value={balanceInput}
              onChange={setBalanceInput}
              currencySymbol={sym}
              onSubmit={handleCreate}
              submitLabel={isSaving ? 'Збереження...' : 'Створити гаманець'}
              isLoading={isSaving}
              allowZero
            />
          </section>
        </div>
      )}
    </div>
  );
};
