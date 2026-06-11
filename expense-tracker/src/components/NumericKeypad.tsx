import { useState, useCallback } from 'react';
import './NumericKeypad.css';
import { DigitPopInText } from './AnimatedNumber';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  currencySymbol?: string;
  onSubmit: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  allowZero?: boolean;
}

type WebAppWithHaptics = NonNullable<Window['Telegram']>['WebApp'] & {
  HapticFeedback?: {
    impactOccurred: (style: 'light') => void;
  };
};

const BackspaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);

const parseSafeMathExpression = (expr: string): number | null => {
  const input = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (!input || input.length > 32 || /[^0-9+\-*/.]/.test(input)) return null;

  let index = 0;

  const parseNumber = (): number | null => {
    let sign = 1;
    if (input[index] === '+') {
      index += 1;
    } else if (input[index] === '-') {
      sign = -1;
      index += 1;
    }

    const start = index;
    let dots = 0;
    let digits = 0;

    while (index < input.length && /[0-9.]/.test(input[index])) {
      if (input[index] === '.') {
        dots += 1;
        if (dots > 1) return null;
      } else {
        digits += 1;
      }
      index += 1;
    }

    if (digits === 0) return null;
    const parsed = Number(input.slice(start, index));
    return Number.isFinite(parsed) ? sign * parsed : null;
  };

  const parseTerm = (): number | null => {
    let value = parseNumber();
    if (value === null) return null;

    while (input[index] === '*' || input[index] === '/') {
      const operator = input[index];
      index += 1;
      const right = parseNumber();
      if (right === null) return null;
      if (operator === '*') value *= right;
      if (operator === '/') {
        if (right === 0) return null;
        value /= right;
      }
    }

    return value;
  };

  let value = parseTerm();
  if (value === null) return null;

  while (input[index] === '+' || input[index] === '-') {
    const operator = input[index];
    index += 1;
    const right = parseTerm();
    if (right === null) return null;
    value = operator === '+' ? value + right : value - right;
  }

  if (index !== input.length || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
};

export const NumericKeypad = ({
  value,
  onChange,
  currencySymbol = '€',
  onSubmit,
  submitLabel = 'Підтвердити',
  isLoading = false,
  disabled = false,
  allowZero = false,
}: NumericKeypadProps) => {
  const [hasExpression, setHasExpression] = useState(false);

  const handleKey = useCallback((key: string) => {
    // Haptic feedback
    try {
      const tg = window.Telegram?.WebApp as WebAppWithHaptics | undefined;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    } catch { /* ignore */ }

    if (key === 'backspace') {
      const newVal = value.slice(0, -1);
      onChange(newVal);
      return;
    }

    if (key === ',') {
      // Only add dot if there isn't one in the current number segment
      const parts = value.split(/[+×÷-]/);
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) return;
      if (value === '' || /[+×÷-]$/.test(value)) {
        onChange(value + '0.');
      } else {
        onChange(value + '.');
      }
      return;
    }

    if (['+', '-', '×', '÷'].includes(key)) {
      // Don't allow operator at start (except minus for negative)
      if (value === '' && key !== '-') return;
      // Don't allow consecutive operators
      if (/[+×÷-]$/.test(value)) {
        onChange(value.slice(0, -1) + key);
        return;
      }
      onChange(value + key);
      setHasExpression(true);
      return;
    }

    // Digit
    // Prevent leading zeros (except for "0.")
    const parts = value.split(/[+×÷-]/);
    const lastPart = parts[parts.length - 1];
    if (lastPart === '0' && key !== '0') {
      onChange(value.slice(0, -1) + key);
      return;
    }
    if (lastPart === '0' && key === '0') return;

    // Limit decimal places to 2
    const dotIndex = lastPart.indexOf('.');
    if (dotIndex !== -1 && lastPart.length - dotIndex > 2) return;

    // Max length
    if (value.length >= 15) return;

    onChange(value + key);
  }, [value, onChange]);

  // Evaluate expression
  const evaluateExpression = (expr: string): number => {
    return parseSafeMathExpression(expr) ?? 0;
  };

  const formatThousands = (raw: string): string => {
    if (!raw) return '0';
    const parts = raw.split(/([+×÷-])/);
    return parts.map(part => {
      if (['+', '-', '×', '÷'].includes(part)) return part;
      const [integer, decimal] = part.split('.');
      const formattedInt = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return decimal !== undefined ? `${formattedInt}.${decimal}` : formattedInt;
    }).join('');
  };

  const displayValue = formatThousands(value);
  const numericResult = hasExpression ? evaluateExpression(value) : parseFloat(value || '0');
  const isValid = !isNaN(numericResult)
    && (allowZero ? numericResult >= 0 : numericResult > 0)
    && !/[+×÷-]$/.test(value);
  const needsSmallFont = (value || '0').length > 8;

  const keys = [
    ['1', '2', '3', '+'],
    ['4', '5', '6', '-'],
    ['7', '8', '9', '×'],
    [',', '0', 'backspace', '÷'],
  ];

  return (
    <div className="keypad-container">
      {/* Display */}
      <div className="keypad-display">
        <DigitPopInText
          text={displayValue}
          className={`keypad-display-value ${needsSmallFont ? 'small' : ''} ${!value ? 'empty' : ''}`}
        />
        <span className="keypad-display-currency">{currencySymbol}</span>
      </div>

      {/* Show evaluated result if expression */}
      {hasExpression && value && /[+×÷-]/.test(value) && !(/[+×÷-]$/.test(value)) && (
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: 'var(--text-tertiary)',
          marginTop: '-8px',
          marginBottom: '4px',
        }}>
          = <DigitPopInText text={formatThousands(String(numericResult % 1 === 0 ? numericResult : numericResult.toFixed(2)))} /> {currencySymbol}
        </div>
      )}

      {/* Grid */}
      <div className="keypad-grid">
        {keys.flat().map((key) => {
          if (key === 'backspace') {
            return (
              <button
                key={key}
                className="keypad-btn backspace"
                onClick={() => handleKey(key)}
                type="button"
              >
                <BackspaceIcon />
              </button>
            );
          }

          const isOp = ['+', '-', '×', '÷'].includes(key);
          return (
            <button
              key={key}
              className={`keypad-btn ${isOp ? 'op' : 'digit'}`}
              onClick={() => handleKey(key)}
              type="button"
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Submit */}
      <button
        className={`keypad-submit ${isLoading ? 'loading' : ''}`}
        onClick={() => {
          if (isValid && !isLoading && !disabled) onSubmit();
        }}
        disabled={!isValid || isLoading || disabled}
        type="button"
      >
        {isLoading ? 'Завантаження...' : submitLabel}
      </button>
    </div>
  );
};

// Hook helper: get numeric result from keypad value
// Existing helper is co-located so all keypad consumers use the same expression parsing.
// eslint-disable-next-line react-refresh/only-export-components
export const getKeypadNumericValue = (value: string): number => {
  return (parseSafeMathExpression(value) ?? parseFloat(value)) || 0;
};
