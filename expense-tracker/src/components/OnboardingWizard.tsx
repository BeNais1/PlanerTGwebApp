import { useState, useCallback } from 'react';
import { NumericKeypad, getKeypadNumericValue } from './NumericKeypad';
import { useAuth } from '../context/AuthContext';
import {
  updateUserSettings,
  setMonthlyBalance,
  getCurrentMonth,
  type OnboardingData,
} from '../services/database';
import type { Category } from '../config/categories';
import './OnboardingWizard.css';

type Currency = 'EUR' | 'USD' | 'UAH';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  UAH: '₴',
};

const TOTAL_STEPS = 6;

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { user } = useAuth();

  // Step state
  const [step, setStep] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Answers
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [ageGroup, setAgeGroup] = useState<'<18' | '18+' | '25+' | '50+' | null>(null);
  const [married, setMarried] = useState<boolean | null>(null);
  const [pets, setPets] = useState<('cat' | 'dog')[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('EUR');
  const [balanceInput, setBalanceInput] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSaving, setIsSaving] = useState(false);

  const goNext = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setStep(prev => prev + 1);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating]);

  const goBack = useCallback(() => {
    if (isAnimating || step <= 1) return;
    setIsAnimating(true);
    setTimeout(() => {
      setStep(prev => prev - 1);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, step]);

  const togglePet = (pet: 'cat' | 'dog') => {
    setPets(prev => {
      if (prev.includes(pet)) {
        return prev.filter(p => p !== pet);
      }
      return [...prev, pet];
    });
  };

  const clearPets = () => {
    setPets([]);
  };

  const handleFinish = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);

    try {
      // Build pet categories
      const petCategories: Category[] = [];
      if (pets.includes('cat')) {
        petCategories.push({ id: 'pet_cat', icon: '🐱', name: 'Кіт', color: '#FFB347', isCustom: true });
      }
      if (pets.includes('dog')) {
        petCategories.push({ id: 'pet_dog', icon: '🐶', name: 'Собака', color: '#87CEEB', isCustom: true });
      }

      const onboardingData: OnboardingData = {
        gender: gender!,
        ageGroup: ageGroup!,
        married: married!,
        pets,
        theme,
      };

      // Save settings
      await updateUserSettings(user.id, {
        currency: selectedCurrency,
        onboardingCompleted: true,
        onboarding: onboardingData,
        theme,
        ...(petCategories.length > 0 ? { customCategories: petCategories } : {}),
      });

      // Set initial balance
      const amount = getKeypadNumericValue(balanceInput);
      if (amount > 0) {
        await setMonthlyBalance(user.id, getCurrentMonth(), amount, selectedCurrency);
      }

      // Apply theme
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('app-theme', theme);

      // Update Telegram header colors
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          const headerColor = theme === 'light' ? '#F2F2F7' : '#000000';
          const bgColor = theme === 'light' ? '#F2F2F7' : '#000000';
          if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
          if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
        }
      } catch (e) { /* ignore */ }

      onComplete();
    } catch (err) {
      console.error('Onboarding save error:', err);
      setIsSaving(false);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return gender !== null;
      case 2: return ageGroup !== null;
      case 3: return married !== null;
      case 4: return true; // pets can be empty (none)
      case 5: return true; // balance can be 0
      case 6: return true;
      default: return false;
    }
  };

  const progressWidth = `${(step / TOTAL_STEPS) * 100}%`;

  // Dynamic marriage text based on gender
  const marriedLabel = gender === 'female' ? 'Заміжня' : 'Одружений';
  const notMarriedLabel = gender === 'female' ? 'Не заміжня' : 'Не одружений';

  return (
    <div className="onboarding-wizard">
      {/* Progress bar */}
      <div className="onboarding-progress">
        <div className="onboarding-progress-fill" style={{ width: progressWidth }} />
      </div>

      {/* Step 1: Gender */}
      {step === 1 && (
        <div className="onboarding-step" key="step-1">
          <span className="onboarding-emoji">👤</span>
          <h1 className="onboarding-title">Хто ви?</h1>
          <p className="onboarding-subtitle">Оберіть вашу стать</p>

          <div className="onboarding-options grid-2">
            <div
              className={`onboarding-option ${gender === 'male' ? 'selected' : ''}`}
              onClick={() => setGender('male')}
            >
              <span className="onboarding-option-emoji">👨</span>
              <span className="onboarding-option-label">Чоловік</span>
            </div>
            <div
              className={`onboarding-option ${gender === 'female' ? 'selected' : ''}`}
              onClick={() => setGender('female')}
            >
              <span className="onboarding-option-emoji">👩</span>
              <span className="onboarding-option-label">Жінка</span>
            </div>
          </div>

          <div className="onboarding-nav">
            <button
              className="onboarding-next-btn"
              disabled={!canProceed()}
              onClick={goNext}
            >
              Далі
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Age */}
      {step === 2 && (
        <div className="onboarding-step" key="step-2">
          <span className="onboarding-emoji">🎂</span>
          <h1 className="onboarding-title">Скільки вам років?</h1>
          <p className="onboarding-subtitle">Оберіть вашу вікову категорію</p>

          <div className="onboarding-options grid-2">
            <div
              className={`onboarding-option ${ageGroup === '<18' ? 'selected' : ''}`}
              onClick={() => setAgeGroup('<18')}
            >
              <span className="onboarding-option-emoji">🧒</span>
              <span className="onboarding-option-label">Менше 18</span>
            </div>
            <div
              className={`onboarding-option ${ageGroup === '18+' ? 'selected' : ''}`}
              onClick={() => setAgeGroup('18+')}
            >
              <span className="onboarding-option-emoji">🧑</span>
              <span className="onboarding-option-label">18+</span>
            </div>
            <div
              className={`onboarding-option ${ageGroup === '25+' ? 'selected' : ''}`}
              onClick={() => setAgeGroup('25+')}
            >
              <span className="onboarding-option-emoji">👨‍💼</span>
              <span className="onboarding-option-label">25+</span>
            </div>
            <div
              className={`onboarding-option ${ageGroup === '50+' ? 'selected' : ''}`}
              onClick={() => setAgeGroup('50+')}
            >
              <span className="onboarding-option-emoji">👴</span>
              <span className="onboarding-option-label">50+</span>
            </div>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-back-btn" onClick={goBack}>←</button>
            <button
              className="onboarding-next-btn"
              disabled={!canProceed()}
              onClick={goNext}
            >
              Далі
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Marriage */}
      {step === 3 && (
        <div className="onboarding-step" key="step-3">
          <span className="onboarding-emoji">💍</span>
          <h1 className="onboarding-title">Сімейний стан</h1>
          <p className="onboarding-subtitle">
            {gender === 'female' ? 'Ви заміжня?' : 'Ви одружені?'}
          </p>

          <div className="onboarding-options grid-2">
            <div
              className={`onboarding-option ${married === true ? 'selected' : ''}`}
              onClick={() => setMarried(true)}
            >
              <span className="onboarding-option-emoji">💑</span>
              <span className="onboarding-option-label">{marriedLabel}</span>
            </div>
            <div
              className={`onboarding-option ${married === false ? 'selected' : ''}`}
              onClick={() => setMarried(false)}
            >
              <span className="onboarding-option-emoji">🙋</span>
              <span className="onboarding-option-label">{notMarriedLabel}</span>
            </div>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-back-btn" onClick={goBack}>←</button>
            <button
              className="onboarding-next-btn"
              disabled={!canProceed()}
              onClick={goNext}
            >
              Далі
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Pets */}
      {step === 4 && (
        <div className="onboarding-step" key="step-4">
          <span className="onboarding-emoji">🐾</span>
          <h1 className="onboarding-title">Домашні улюбленці</h1>
          <p className="onboarding-subtitle">Є кіт чи собака? Додамо категорію витрат</p>

          <div className="onboarding-options grid-3">
            <div
              className={`onboarding-option ${pets.includes('cat') ? 'selected' : ''}`}
              onClick={() => togglePet('cat')}
            >
              <span className="onboarding-option-emoji">🐱</span>
              <span className="onboarding-option-label">Кіт</span>
            </div>
            <div
              className={`onboarding-option ${pets.includes('dog') ? 'selected' : ''}`}
              onClick={() => togglePet('dog')}
            >
              <span className="onboarding-option-emoji">🐶</span>
              <span className="onboarding-option-label">Собака</span>
            </div>
            <div
              className={`onboarding-option ${pets.length === 0 ? 'selected' : ''}`}
              onClick={clearPets}
            >
              <span className="onboarding-option-emoji">❌</span>
              <span className="onboarding-option-label">Немає</span>
            </div>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-back-btn" onClick={goBack}>←</button>
            <button
              className="onboarding-next-btn"
              onClick={goNext}
            >
              Далі
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Currency & Balance */}
      {step === 5 && (
        <div className="onboarding-step" key="step-5">
          <span className="onboarding-emoji">💰</span>
          <h1 className="onboarding-title">Ваш гаманець</h1>
          <p className="onboarding-subtitle">Оберіть валюту та введіть початковий баланс</p>

          <div className="onboarding-currency-selector">
            {(['EUR', 'USD', 'UAH'] as Currency[]).map(cur => (
              <button
                key={cur}
                className={`onboarding-currency-btn ${selectedCurrency === cur ? 'active' : ''}`}
                onClick={() => setSelectedCurrency(cur)}
              >
                {CURRENCY_SYMBOLS[cur]} {cur}
              </button>
            ))}
          </div>

          <div className="onboarding-keypad-wrapper">
            <NumericKeypad
              value={balanceInput}
              onChange={setBalanceInput}
              currencySymbol={CURRENCY_SYMBOLS[selectedCurrency]}
              onSubmit={goNext}
              submitLabel="Далі"
            />
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-back-btn" onClick={goBack}>←</button>
          </div>
        </div>
      )}

      {/* Step 6: Theme */}
      {step === 6 && (
        <div className="onboarding-step" key="step-6">
          <span className="onboarding-emoji">🎨</span>
          <h1 className="onboarding-title">Оберіть тему</h1>
          <p className="onboarding-subtitle">Можна змінити пізніше в налаштуваннях</p>

          <div className="onboarding-options grid-2">
            <div
              className={`onboarding-option ${theme === 'dark' ? 'selected' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <span className="onboarding-option-emoji">🌙</span>
              <div className="onboarding-theme-preview dark-preview">
                <div className="theme-preview-bar" />
                <div className="theme-preview-bar-short" />
                <div className="theme-preview-bar" />
              </div>
              <span className="onboarding-option-label">Темна</span>
            </div>
            <div
              className={`onboarding-option ${theme === 'light' ? 'selected' : ''}`}
              onClick={() => setTheme('light')}
            >
              <span className="onboarding-option-emoji">☀️</span>
              <div className="onboarding-theme-preview light-preview">
                <div className="theme-preview-bar" />
                <div className="theme-preview-bar-short" />
                <div className="theme-preview-bar" />
              </div>
              <span className="onboarding-option-label">Світла</span>
            </div>
          </div>

          <div className="onboarding-nav">
            <button className="onboarding-back-btn" onClick={goBack}>←</button>
            <button
              className="onboarding-next-btn finish"
              onClick={handleFinish}
              disabled={isSaving}
            >
              {isSaving ? 'Зберігаємо...' : 'Почати! 🚀'}
            </button>
          </div>
        </div>
      )}

      {/* Step dots */}
      <div className="onboarding-dots">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`onboarding-dot ${step === i + 1 ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
};
