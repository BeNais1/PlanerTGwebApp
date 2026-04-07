import { useState, useEffect, useRef } from "react";
import { type Transaction } from "../services/database";
import { type Currency, useCurrency } from "../hooks/useCurrency";

const CATEGORY_COLORS: Record<string, string> = {
  food: '#FF9500', // Orange
  transport: '#007AFF', // Blue
  home: '#34C759', // Green
  entertainment: '#AF52DE', // Purple
  shopping: '#FF2D55', // Pink
  health: '#FF3B30', // Red
  education: '#5856D6', // Indigo
  other: '#8E8E93', // Gray
};

const CATEGORY_NAMES: Record<string, string> = {
  food: 'Еда',
  transport: 'Транспорт',
  home: 'Жильё',
  entertainment: 'Развлечения',
  shopping: 'Покупки',
  health: 'Здоровье',
  education: 'Образование',
  other: 'Другое',
};

interface AnalyticsViewProps {
  transactions: Transaction[];
  walletBalances: Record<string, number>;
  mainCurrency: Currency;
  isActive: boolean;
}

export const AnalyticsView = ({ transactions, walletBalances, mainCurrency, isActive }: AnalyticsViewProps) => {
  const { formatValue, CURRENCY_SYMBOLS, convertToMain } = useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | 'ALL'>('ALL');
  const [animatedDasharray, setAnimatedDasharray] = useState<Record<string, number>>({});
  const chartRef = useRef<HTMLDivElement>(null);

  const availableCurrencies = Object.keys(walletBalances) as (Currency | 'ALL')[];

  // Filter transactions
  const expenses = transactions.filter(t => t.type === 'expense' && (selectedCurrency === 'ALL' || t.currency === selectedCurrency));

  // Aggregate by category
  const categoryTotals: Record<string, number> = {};
  let totalExpenses = 0;

  expenses.forEach(t => {
    let amount = t.amount;
    // Map to main currency if 'ALL' is selected, otherwise use native amount
    if (selectedCurrency === 'ALL' && t.currency !== mainCurrency) {
      amount = convertToMain(t.amount, (t.currency || 'EUR') as Currency);
    }
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amount;
    totalExpenses += amount;
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, amount]) => amount > 0);

  // Chart setup
  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animation effect
  useEffect(() => {
    if (isActive) {
      // Reset animation
      setAnimatedDasharray({});
      // Trigger animation after next frame
      requestAnimationFrame(() => {
        setTimeout(() => {
          const dasharrays: Record<string, number> = {};
          let currentOffset = 0;
          sortedCategories.forEach(([category, amount]) => {
            const percentage = amount / totalExpenses;
            const strokeLength = percentage * circumference;
            dasharrays[category] = strokeLength;
            currentOffset += strokeLength;
          });
          setAnimatedDasharray(dasharrays);
        }, 50);
      });
    }
  }, [isActive, totalExpenses, selectedCurrency]);

  if (!isActive) return null;

  let currentOffset = 0;

  return (
    <div className="analytics-view" style={{ padding: '0 20px 100px 20px', height: '100%', overflowY: 'auto' }}>
      <style>{`
        .segment {
          transition: stroke-dasharray 1s ease-out;
        }
      `}</style>
      
      <div className="analytics-header" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--apple-text-on-dark)' }}>Аналитика</h2>
      </div>

      {/* Currency Filter */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', margin: '0 -20px 20px -20px', padding: '0 20px 20px 20px' }}>
        <button
          onClick={() => setSelectedCurrency('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-pill)',
            background: selectedCurrency === 'ALL' ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
            color: selectedCurrency === 'ALL' ? 'white' : 'var(--apple-text-on-dark)',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            whiteSpace: 'nowrap'
          }}
        >
          Общий ({CURRENCY_SYMBOLS[mainCurrency]})
        </button>
        {availableCurrencies.filter(c => c !== 'ALL').map(cur => (
          <button
            key={cur}
            onClick={() => setSelectedCurrency(cur as Currency)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: selectedCurrency === cur ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
              color: selectedCurrency === cur ? 'white' : 'var(--apple-text-on-dark)',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap'
            }}
          >
            {cur} ({CURRENCY_SYMBOLS[cur as Currency]})
          </button>
        ))}
      </div>

      <div ref={chartRef} style={{ background: 'var(--apple-surface-1)', borderRadius: '24px', padding: '24px', position: 'relative' }}>
        {totalExpenses > 0 ? (
          <>
            <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 32px auto' }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {sortedCategories.map(([category, amount]) => {
                  const percentage = amount / totalExpenses;
                  const strokeLength = percentage * circumference;
                  const currentStrokeLength = animatedDasharray[category] || 0;
                  
                  // Calculate the offset for this segment
                  const segmentOffset = currentOffset;
                  // Increase offset for next segment
                  currentOffset += strokeLength;

                  return (
                    <circle
                      key={category}
                      className="segment"
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke={CATEGORY_COLORS[category] || CATEGORY_COLORS['other']}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${currentStrokeLength} ${circumference}`}
                      strokeDashoffset={-segmentOffset}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--apple-text-on-dark-secondary)' }}>Расход</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--apple-text-on-dark)' }}>
                  {formatValue(totalExpenses)}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--apple-text-on-dark-secondary)' }}>
                  {selectedCurrency === 'ALL' ? CURRENCY_SYMBOLS[mainCurrency] : CURRENCY_SYMBOLS[selectedCurrency as Currency]}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sortedCategories.map(([category, amount]) => {
                const percentage = ((amount / totalExpenses) * 100).toFixed(1);
                return (
                  <div key={category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: CATEGORY_COLORS[category] || CATEGORY_COLORS['other'] }} />
                      <span style={{ fontSize: '16px', color: 'var(--apple-text-on-dark)', fontWeight: '500' }}>
                        {CATEGORY_NAMES[category] || category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--apple-text-on-dark)' }}>
                        {formatValue(amount)} {selectedCurrency === 'ALL' ? CURRENCY_SYMBOLS[mainCurrency] : CURRENCY_SYMBOLS[selectedCurrency as Currency]}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-secondary)' }}>
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--apple-text-on-dark-secondary)' }}>
            Нет данных о расходах за этот период
          </div>
        )}
      </div>
    </div>
  );
};
