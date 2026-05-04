import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { type Transaction, getAllTransactions } from "../services/database";
import { type Currency, useCurrency } from "../hooks/useCurrency";
import { useCategories } from "../hooks/useCategories";

interface AnalyticsViewProps {
  walletBalances: Record<string, number>;
  mainCurrency: Currency;
  isActive: boolean;
}

type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';
type TxTypeFilter = 'expense' | 'income' | 'all';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Сьогодні',
  week: 'Тиждень',
  month: 'Місяць',
  quarter: 'Квартал',
  year: 'Рік',
  all: 'Весь час',
};

function getDateRangeStart(range: DateRange): number {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.getTime();
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d.getTime();
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d.getTime();
    }
    case 'year': {
      const d = new Date(now.getFullYear(), 0, 1);
      return d.getTime();
    }
    case 'all':
      return 0;
  }
}

export const AnalyticsView = ({ walletBalances, mainCurrency, isActive }: AnalyticsViewProps) => {
  const { user } = useAuth();
  const { formatValue, CURRENCY_SYMBOLS, convertToMain } = useCurrency();
  const { colors: CATEGORY_COLORS, names: CATEGORY_NAMES } = useCategories();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [txType, setTxType] = useState<TxTypeFilter>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [animatedDasharray, setAnimatedDasharray] = useState<Record<string, number>>({});
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const availableCurrencies = Object.keys(walletBalances) as (Currency | 'ALL')[];

  // Load ALL transactions when view becomes active
  useEffect(() => {
    if (!isActive || !user) return;
    setIsLoading(true);
    getAllTransactions(user.id).then(txs => {
      setAllTransactions(txs);
      setIsLoading(false);
    });
  }, [isActive, user]);

  // Filter transactions by date range, type, currency, category
  const filteredTransactions = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    return allTransactions.filter(t => {
      if (t.date < rangeStart) return false;
      if (txType !== 'all' && t.type !== txType) return false;
      if (selectedCurrency !== 'ALL' && t.currency !== selectedCurrency) return false;
      if (selectedCategory && t.category !== selectedCategory) return false;
      return true;
    });
  }, [allTransactions, dateRange, txType, selectedCurrency, selectedCategory]);

  // Aggregate by category
  const categoryTotals: Record<string, number> = {};
  let totalAmount = 0;

  filteredTransactions.forEach(t => {
    let amount = t.amount;
    if (selectedCurrency === 'ALL' && t.currency !== mainCurrency) {
      amount = convertToMain(t.amount, (t.currency || 'EUR') as Currency);
    }
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amount;
    totalAmount += amount;
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, amount]) => amount > 0);

  // Summary stats
  const totalExpenses = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    return allTransactions
      .filter(t => t.type === 'expense' && t.date >= rangeStart && (selectedCurrency === 'ALL' || t.currency === selectedCurrency))
      .reduce((acc, t) => {
        return acc + (selectedCurrency === 'ALL' ? convertToMain(t.amount, (t.currency || 'EUR') as Currency) : t.amount);
      }, 0);
  }, [allTransactions, dateRange, selectedCurrency, mainCurrency]);

  const totalIncome = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    return allTransactions
      .filter(t => t.type === 'income' && t.date >= rangeStart && (selectedCurrency === 'ALL' || t.currency === selectedCurrency))
      .reduce((acc, t) => {
        return acc + (selectedCurrency === 'ALL' ? convertToMain(t.amount, (t.currency || 'EUR') as Currency) : t.amount);
      }, 0);
  }, [allTransactions, dateRange, selectedCurrency, mainCurrency]);

  // Chart setup
  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animation effect
  useEffect(() => {
    if (isActive && sortedCategories.length > 0) {
      setAnimatedDasharray({});
      requestAnimationFrame(() => {
        setTimeout(() => {
          const dasharrays: Record<string, number> = {};
          sortedCategories.forEach(([category, amount]) => {
            const percentage = amount / totalAmount;
            dasharrays[category] = percentage * circumference;
          });
          setAnimatedDasharray(dasharrays);
        }, 50);
      });
    }
  }, [isActive, totalAmount, selectedCurrency, dateRange, txType, selectedCategory]);

  if (!isActive) return null;

  let currentOffset = 0;
  const currSymbol = selectedCurrency === 'ALL' ? CURRENCY_SYMBOLS[mainCurrency] : CURRENCY_SYMBOLS[selectedCurrency as Currency];

  return (
    <div className="analytics-view" style={{
      padding: '0 20px 100px 20px',
      paddingTop: 'calc(var(--safe-area-top, 50px) + 20px)',
      height: '100%',
      overflowY: 'auto'
    }}>
      <style>{`
        .segment { transition: stroke-dasharray 1s ease-out; }
        .filter-chip {
          padding: 7px 14px;
          border-radius: 980px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-text);
        }
        .filter-chip.active {
          background: var(--accent);
          color: white;
        }
        .filter-chip.inactive {
          background: var(--card-bg-2);
          color: var(--text-primary);
        }
      `}</style>

      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '34px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '-1px' }}>Аналітика</h2>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: '18px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Витрати</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {formatValue(totalExpenses)}
          </div>
        </div>
        <div style={{ background: 'var(--card-bg)', borderRadius: '18px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Доходи</span>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>
            {formatValue(totalIncome)}
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', margin: '0 -20px', padding: '0 20px 12px 20px' }}>
        {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(range => (
          <button key={range}
            className={`filter-chip ${dateRange === range ? 'active' : 'inactive'}`}
            onClick={() => setDateRange(range)}>
            {DATE_RANGE_LABELS[range]}
          </button>
        ))}
      </div>

      {/* Type Filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {([['expense', 'Витрати'], ['income', 'Доходи'], ['all', 'Усе']] as [TxTypeFilter, string][]).map(([type, label]) => (
          <button key={type}
            className={`filter-chip ${txType === type ? 'active' : 'inactive'}`}
            onClick={() => { setTxType(type); setSelectedCategory(null); }}>
            {label}
          </button>
        ))}
      </div>

      {/* Currency Filter */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '16px', margin: '0 -20px', padding: '0 20px 16px 20px' }}>
        <button
          className={`filter-chip ${selectedCurrency === 'ALL' ? 'active' : 'inactive'}`}
          onClick={() => setSelectedCurrency('ALL')}>
          Загальний ({CURRENCY_SYMBOLS[mainCurrency]})
        </button>
        {availableCurrencies.filter(c => c !== 'ALL').map(cur => (
          <button key={cur}
            className={`filter-chip ${selectedCurrency === cur ? 'active' : 'inactive'}`}
            onClick={() => setSelectedCurrency(cur as Currency)}>
            {cur} ({CURRENCY_SYMBOLS[cur as Currency]})
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={chartRef} style={{ background: 'var(--apple-surface-1)', borderRadius: '24px', padding: '24px', position: 'relative' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--apple-text-on-dark-secondary)' }}>
            Завантаження...
          </div>
        ) : totalAmount > 0 ? (
          <>
            <div style={{ position: 'relative', width: size, height: size, margin: '0 auto 32px auto' }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {sortedCategories.map(([category, amount]) => {
                  const percentage = amount / totalAmount;
                  const strokeLength = percentage * circumference;
                  const currentStrokeLength = animatedDasharray[category] || 0;
                  const segmentOffset = currentOffset;
                  currentOffset += strokeLength;

                  return (
                    <circle
                      key={category}
                      className="segment"
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke={CATEGORY_COLORS[category] || '#8E8E93'}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${currentStrokeLength} ${circumference}`}
                      strokeDashoffset={-segmentOffset}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--apple-text-on-dark-secondary)' }}>
                  {txType === 'expense' ? 'Витрата' : txType === 'income' ? 'Дохід' : 'Разом'}
                </span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--apple-text-on-dark)' }}>
                  {formatValue(totalAmount)}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--apple-text-on-dark-secondary)' }}>
                  {currSymbol}
                </span>
              </div>
            </div>

            {/* Category Filter Chips */}
            {sortedCategories.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <button
                  className={`filter-chip ${selectedCategory === null ? 'active' : 'inactive'}`}
                  onClick={() => setSelectedCategory(null)}>
                  Усі
                </button>
                {sortedCategories.map(([category]) => (
                  <button key={category}
                    className={`filter-chip ${selectedCategory === category ? 'active' : 'inactive'}`}
                    style={selectedCategory === category ? { background: CATEGORY_COLORS[category] || '#8E8E93' } : {}}
                    onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}>
                    {CATEGORY_NAMES[category] || category}
                  </button>
                ))}
              </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sortedCategories.map(([category, amount]) => {
                const percentage = ((amount / totalAmount) * 100).toFixed(1);
                return (
                  <div key={category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: CATEGORY_COLORS[category] || '#8E8E93' }} />
                      <span style={{ fontSize: '16px', color: 'var(--apple-text-on-dark)', fontWeight: '500' }}>
                        {CATEGORY_NAMES[category] || category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--apple-text-on-dark)' }}>
                        {formatValue(amount)} {currSymbol}
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
            Немає даних за обраний період
          </div>
        )}
      </div>
    </div>
  );
};
