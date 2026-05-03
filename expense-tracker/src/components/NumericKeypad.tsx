import { useState, useCallback } from 'react';
import './NumericKeypad.css';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  currencySymbol?: string;
  onSubmit: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

const BackspaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);

export const NumericKeypad = ({
  value,
  onChange,
  currencySymbol = '€',
  onSubmit,
  submitLabel = 'Підтвердити',
  isLoading = false,
  disabled = false,
}: NumericKeypadProps) => {
  const [hasExpression, setHasExpression] = useState(false);

  const handleKey = useCallback((key: string) => {
    // Haptic feedback
    try {
      const tg = (window as any).Telegram?.WebApp;
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
      const parts = value.split(/[\+\-\×\÷]/);
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) return;
      if (value === '' || /[\+\-\×\÷]$/.test(value)) {
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
      if (/[\+\-\×\÷]$/.test(value)) {
        onChange(value.slice(0, -1) + key);
        return;
      }
      onChange(value + key);
      setHasExpression(true);
      return;
    }

    // Digit
    // Prevent leading zeros (except for "0.")
    const parts = value.split(/[\+\-\×\÷]/);
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
    try {
      // Replace visual operators with JS operators
      const jsExpr = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/');
      // Simple safe eval using Function
      const result = new Function('return ' + jsExpr)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100) / 100;
      }
    } catch { /* ignore */ }
    return 0;
  };

  const displayValue = value || '0';
  const numericResult = hasExpression ? evaluateExpression(value) : parseFloat(value || '0');
  const isValid = !isNaN(numericResult) && numericResult > 0 && !/[\+\-\×\÷]$/.test(value);
  const needsSmallFont = displayValue.length > 8;

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
        <span className={`keypad-display-value ${needsSmallFont ? 'small' : ''} ${!value ? 'empty' : ''}`}>
          {displayValue}
        </span>
        <span className="keypad-display-currency">{currencySymbol}</span>
      </div>

      {/* Show evaluated result if expression */}
      {hasExpression && value && /[\+\-\×\÷]/.test(value) && !(/[\+\-\×\÷]$/.test(value)) && (
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: 'var(--text-tertiary)',
          marginTop: '-8px',
          marginBottom: '4px',
        }}>
          = {numericResult.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {currencySymbol}
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
export const getKeypadNumericValue = (value: string): number => {
  try {
    const jsExpr = value.replace(/×/g, '*').replace(/÷/g, '/');
    const result = new Function('return ' + jsExpr)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
  } catch { /* ignore */ }
  return parseFloat(value) || 0;
};
