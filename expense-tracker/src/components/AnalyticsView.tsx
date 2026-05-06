import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { type Transaction, subscribeToAllTransactions } from "../services/database";
import { type Currency, useCurrency } from "../hooks/useCurrency";
import { useCategories } from "../hooks/useCategories";
import "./AnalyticsView.css";

interface AnalyticsViewProps {
  walletBalances: Record<string, number>;
  mainCurrency: Currency;
  isActive: boolean;
}

type DateRange = "week" | "month" | "quarter" | "year" | "all";
type TxTypeFilter = "expense" | "income" | "all";
type AnalyticsTab = "overview" | "categories" | "trends" | "wallets";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  week: "Тиждень",
  month: "Місяць",
  quarter: "Квартал",
  year: "Рік",
  all: "Весь час",
};

const TYPE_LABELS: Record<TxTypeFilter, string> = {
  expense: "Витрати",
  income: "Доходи",
  all: "Усе",
};

const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: "Огляд",
  categories: "Категорії",
  trends: "Тренди",
  wallets: "Гаманці",
};

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getRangeBounds(range: DateRange): { start: number; end: number; previousStart: number; previousEnd: number } {
  const now = new Date();
  const end = Date.now();

  if (range === "week") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    return { start, end, previousStart: start - 7 * 86400000, previousEnd: start - 1 };
  }

  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    return { start, end, previousStart, previousEnd: start - 1 };
  }

  if (range === "quarter") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
    return { start, end, previousStart: start - 90 * 86400000, previousEnd: start - 1 };
  }

  if (range === "year") {
    const start = new Date(now.getFullYear(), 0, 1).getTime();
    const previousStart = new Date(now.getFullYear() - 1, 0, 1).getTime();
    return { start, end, previousStart, previousEnd: start - 1 };
  }

  return { start: 0, end, previousStart: 0, previousEnd: 0 };
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

function daysInRange(start: number, end: number): number {
  if (start === 0) return 1;
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

export const AnalyticsView = ({ walletBalances, mainCurrency, isActive }: AnalyticsViewProps) => {
  const { user } = useAuth();
  const { formatValue, CURRENCY_SYMBOLS, convertToMain } = useCurrency();
  const {
    colors: CATEGORY_COLORS,
    icons: CATEGORY_ICONS,
    names: CATEGORY_NAMES,
  } = useCategories();

  const [selectedCurrency, setSelectedCurrency] = useState<Currency | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [txType, setTxType] = useState<TxTypeFilter>("expense");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isActive || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    return subscribeToAllTransactions(user.id, (transactions) => {
      setAllTransactions(transactions);
      setIsLoading(false);
    });
  }, [isActive, user]);

  const range = useMemo(() => getRangeBounds(dateRange), [dateRange]);

  const availableCurrencies = useMemo(() => {
    const fromTransactions = allTransactions.map((tx) => tx.currency || "EUR");
    return Array.from(new Set([...Object.keys(walletBalances), ...fromTransactions])) as Currency[];
  }, [allTransactions, walletBalances]);

  const currencySymbol = selectedCurrency === "ALL"
    ? CURRENCY_SYMBOLS[mainCurrency]
    : CURRENCY_SYMBOLS[selectedCurrency];

  const amountForView = (tx: Transaction) => {
    if (selectedCurrency === "ALL") return convertToMain(tx.amount, (tx.currency || "EUR") as Currency);
    return tx.amount;
  };

  const inCurrency = (tx: Transaction) => selectedCurrency === "ALL" || (tx.currency || "EUR") === selectedCurrency;

  const periodTransactions = useMemo(() => (
    allTransactions.filter((tx) => !tx.excludeFromBalance && tx.date >= range.start && tx.date <= range.end && inCurrency(tx))
  ), [allTransactions, range, selectedCurrency]);

  const previousTransactions = useMemo(() => {
    if (dateRange === "all") return [];
    return allTransactions.filter((tx) => tx.date >= range.previousStart && tx.date <= range.previousEnd && inCurrency(tx));
  }, [allTransactions, dateRange, range, selectedCurrency]);

  const visibleTransactions = useMemo(() => (
    periodTransactions.filter((tx) => {
      if (txType !== "all" && tx.type !== txType) return false;
      if (selectedCategory && tx.category !== selectedCategory) return false;
      return true;
    })
  ), [periodTransactions, selectedCategory, txType]);

  const totals = useMemo(() => {
    const sum = (items: Transaction[], type: "expense" | "income") =>
      items.filter((tx) => tx.type === type).reduce((acc, tx) => acc + amountForView(tx), 0);

    const expenses = sum(periodTransactions, "expense");
    const income = sum(periodTransactions, "income");
    const previousExpenses = sum(previousTransactions, "expense");
    const previousIncome = sum(previousTransactions, "income");
    const dailyAverage = expenses / daysInRange(range.start, range.end);

    return {
      expenses,
      income,
      net: income - expenses,
      count: periodTransactions.length,
      dailyAverage,
      previousExpenses,
      previousIncome,
      previousNet: previousIncome - previousExpenses,
      expensesDelta: previousExpenses > 0 ? ((expenses - previousExpenses) / previousExpenses) * 100 : 0,
      incomeDelta: previousIncome > 0 ? ((income - previousIncome) / previousIncome) * 100 : 0,
      netDelta: Math.abs(previousIncome - previousExpenses) > 0
        ? (((income - expenses) - (previousIncome - previousExpenses)) / Math.abs(previousIncome - previousExpenses)) * 100
        : 0,
    };
  }, [periodTransactions, previousTransactions, range, selectedCurrency]);

  const categoryRows = useMemo(() => {
    const rows = new Map<string, { category: string; amount: number; count: number }>();

    periodTransactions
      .filter((tx) => tx.type === txType || txType === "all")
      .forEach((tx) => {
        const key = tx.type === "income" ? "income" : tx.category;
        const current = rows.get(key) || { category: key, amount: 0, count: 0 };
        current.amount += amountForView(tx);
        current.count += 1;
        rows.set(key, current);
      });

    return Array.from(rows.values()).sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, selectedCurrency, txType]);

  const totalCategoryAmount = categoryRows.reduce((acc, row) => acc + row.amount, 0);
  const topCategory = categoryRows[0];

  const trendRows = useMemo(() => {
    const useMonths = dateRange === "year" || dateRange === "all";
    const source = visibleTransactions.length > 0 ? visibleTransactions : periodTransactions;
    const rows = new Map<string, { label: string; expense: number; income: number; date: number }>();

    source.forEach((tx) => {
      const date = new Date(tx.date);
      const key = useMonths
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const label = useMonths
        ? date.toLocaleDateString("uk-UA", { month: "short" })
        : date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
      const current = rows.get(key) || { label, expense: 0, income: 0, date: tx.date };
      current[tx.type] += amountForView(tx);
      current.date = Math.min(current.date, tx.date);
      rows.set(key, current);
    });

    return Array.from(rows.values()).sort((a, b) => a.date - b.date);
  }, [dateRange, periodTransactions, selectedCurrency, visibleTransactions]);

  const trendMax = Math.max(1, ...trendRows.map((row) => Math.max(row.expense, row.income)));

  const walletRows = useMemo(() => {
    const rows = new Map<string, { currency: string; expense: number; income: number; balance: number; count: number }>();

    periodTransactions.forEach((tx) => {
      const currency = tx.currency || "EUR";
      const current = rows.get(currency) || {
        currency,
        expense: 0,
        income: 0,
        balance: walletBalances[currency] || 0,
        count: 0,
      };
      current[tx.type] += tx.amount;
      current.count += 1;
      rows.set(currency, current);
    });

    Object.entries(walletBalances).forEach(([currency, balance]) => {
      if (!rows.has(currency)) rows.set(currency, { currency, expense: 0, income: 0, balance, count: 0 });
    });

    return Array.from(rows.values()).sort((a, b) => Math.abs(b.expense + b.income) - Math.abs(a.expense + a.income));
  }, [periodTransactions, walletBalances]);

  const insights = useMemo(() => {
    const items = [];
    if (topCategory && totalCategoryAmount > 0) {
      items.push({
        title: "Найбільша категорія",
        value: CATEGORY_NAMES[topCategory.category] || topCategory.category,
        detail: `${((topCategory.amount / totalCategoryAmount) * 100).toFixed(0)}% від вибраного періоду`,
      });
    }
    items.push({
      title: "Зміна витрат",
      value: dateRange === "all" ? "Без порівняння" : formatPercent(totals.expensesDelta),
      detail: dateRange === "all" ? "Для всього періоду порівняння вимкнене" : "порівняно з минулим періодом",
    });
    items.push({
      title: "Середній день",
      value: formatValue(totals.dailyAverage, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency),
      detail: "середні витрати за день",
    });
    return items;
  }, [CATEGORY_NAMES, dateRange, mainCurrency, selectedCurrency, topCategory, totalCategoryAmount, totals]);

  if (!isActive) return null;

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <div>
          <h2>Аналітика</h2>
          <p>Огляд витрат, доходів і звичок</p>
        </div>
        <select
          className="analytics-currency-select"
          value={selectedCurrency}
          onChange={(event) => {
            setSelectedCurrency(event.target.value as Currency | "ALL");
            setSelectedCategory(null);
          }}
        >
          <option value="ALL">Усі ({CURRENCY_SYMBOLS[mainCurrency]})</option>
          {availableCurrencies.map((currency) => (
            <option key={currency} value={currency}>{currency} ({CURRENCY_SYMBOLS[currency]})</option>
          ))}
        </select>
      </div>

      <div className="analytics-controls">
        <div className="analytics-segment">
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((rangeKey) => (
            <button
              key={rangeKey}
              className={dateRange === rangeKey ? "active" : ""}
              onClick={() => setDateRange(rangeKey)}
            >
              {DATE_RANGE_LABELS[rangeKey]}
            </button>
          ))}
        </div>
        <div className="analytics-segment compact">
          {(Object.keys(TYPE_LABELS) as TxTypeFilter[]).map((type) => (
            <button
              key={type}
              className={txType === type ? "active" : ""}
              onClick={() => {
                setTxType(type);
                setSelectedCategory(null);
              }}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-tabs">
        {(Object.keys(TAB_LABELS) as AnalyticsTab[]).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="analytics-empty">Завантаження...</div>
      ) : (
        <>
          {activeTab === "overview" && (
            <>
              <div className="analytics-summary-grid">
                <div className="analytics-metric primary">
                  <span>Баланс періоду</span>
                  <strong className={totals.net >= 0 ? "positive" : "negative"}>
                    {formatValue(totals.net, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)}
                  </strong>
                  <small>{dateRange === "all" ? `${totals.count} операцій` : `${formatPercent(totals.netDelta)} до минулого періоду`}</small>
                </div>
                <div className="analytics-metric">
                  <span>Витрати</span>
                  <strong>{formatValue(totals.expenses, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)}</strong>
                  <small>{dateRange === "all" ? "без порівняння" : formatPercent(totals.expensesDelta)}</small>
                </div>
                <div className="analytics-metric">
                  <span>Доходи</span>
                  <strong className="positive">{formatValue(totals.income, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)}</strong>
                  <small>{dateRange === "all" ? "без порівняння" : formatPercent(totals.incomeDelta)}</small>
                </div>
                <div className="analytics-metric">
                  <span>Середній день</span>
                  <strong>{formatValue(totals.dailyAverage, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)}</strong>
                  <small>{totals.count} операцій</small>
                </div>
              </div>

              <div className="analytics-insights">
                {insights.map((insight) => (
                  <div key={insight.title} className="analytics-insight">
                    <span>{insight.title}</span>
                    <strong>{insight.value}</strong>
                    <small>{insight.detail}</small>
                  </div>
                ))}
              </div>

              <TrendChart rows={trendRows} max={trendMax} formatValue={(value) => formatValue(value, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)} />
              <CategoryList
                rows={categoryRows.slice(0, 5)}
                total={totalCategoryAmount}
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
                names={CATEGORY_NAMES}
                icons={CATEGORY_ICONS}
                colors={CATEGORY_COLORS}
                formatAmount={(value) => `${formatValue(value, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)} ${currencySymbol || ""}`}
              />
            </>
          )}

          {activeTab === "categories" && (
            <CategoryList
              rows={categoryRows}
              total={totalCategoryAmount}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              names={CATEGORY_NAMES}
              icons={CATEGORY_ICONS}
              colors={CATEGORY_COLORS}
              formatAmount={(value) => `${formatValue(value, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)} ${currencySymbol || ""}`}
              expanded
            />
          )}

          {activeTab === "trends" && (
            <TrendDetails
              rows={trendRows}
              max={trendMax}
              formatAmount={(value) => formatValue(value, selectedCurrency === "ALL" ? mainCurrency : selectedCurrency)}
            />
          )}

          {activeTab === "wallets" && (
            <div className="analytics-panel">
              <div className="analytics-panel-header">
                <h3>Гаманці</h3>
                <span>{walletRows.length}</span>
              </div>
              <div className="wallet-list">
                {walletRows.map((wallet) => (
                  <div key={wallet.currency} className="wallet-row">
                    <div>
                      <strong>{wallet.currency}</strong>
                      <span>{wallet.count} операцій</span>
                    </div>
                    <div>
                      <strong>{formatValue(wallet.balance, wallet.currency as Currency)}</strong>
                      <span>-{formatValue(wallet.expense, wallet.currency as Currency)} / +{formatValue(wallet.income, wallet.currency as Currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {periodTransactions.length === 0 && (
            <div className="analytics-empty">
              <strong>За цей період ще немає операцій</strong>
              <span>Спробуйте інший період або іншу валюту.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface CategoryListProps {
  rows: { category: string; amount: number; count: number }[];
  total: number;
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  names: Record<string, string>;
  icons: Record<string, string>;
  colors: Record<string, string>;
  formatAmount: (value: number) => string;
  expanded?: boolean;
}

function CategoryList({ rows, total, selectedCategory, onSelect, names, icons, colors, formatAmount, expanded }: CategoryListProps) {
  return (
    <div className="analytics-panel">
      <div className="analytics-panel-header">
        <h3>{expanded ? "Усі категорії" : "Топ категорій"}</h3>
        {selectedCategory && <button onClick={() => onSelect(null)}>Скинути</button>}
      </div>

      {rows.length === 0 ? (
        <div className="analytics-empty inline">Немає даних для категорій</div>
      ) : (
        <div className="category-list">
          {rows.map((row) => {
            const percentage = total > 0 ? (row.amount / total) * 100 : 0;
            const color = colors[row.category] || "#8e8e93";
            return (
              <button
                key={row.category}
                className={`category-row ${selectedCategory === row.category ? "active" : ""}`}
                onClick={() => onSelect(selectedCategory === row.category ? null : row.category)}
              >
                <span className="category-icon-pill" style={{ background: color }}>
                  {icons[row.category] || (row.category === "income" ? "+" : "•")}
                </span>
                <span className="category-row-main">
                  <span>
                    <strong>{names[row.category] || (row.category === "income" ? "Доходи" : row.category)}</strong>
                    <small>{row.count} операцій</small>
                  </span>
                  <i>
                    <b style={{ width: `${Math.max(3, percentage)}%`, background: color }} />
                  </i>
                </span>
                <span className="category-row-side">
                  <strong>{formatAmount(row.amount)}</strong>
                  <small>{percentage.toFixed(0)}%</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrendChart({
  rows,
  max,
  formatValue,
  embedded = false,
}: {
  rows: { label: string; expense: number; income: number }[];
  max: number;
  formatValue: (value: number) => string;
  embedded?: boolean;
}) {
  const visibleRows = rows.slice(-14);
  return (
    <div className={`analytics-panel ${embedded ? "embedded" : ""}`}>
      {!embedded && (
        <div className="analytics-panel-header">
          <h3>Динаміка</h3>
          <span>{visibleRows.length ? formatValue(visibleRows.reduce((acc, row) => acc + row.expense, 0)) : ""}</span>
        </div>
      )}
      {visibleRows.length === 0 ? (
        <div className="analytics-empty inline">Немає даних для графіка</div>
      ) : (
        <div className="trend-chart">
          {visibleRows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="trend-bar">
              <div className="trend-bar-track">
                <span className="income" style={{ height: `${Math.max(3, (row.income / max) * 100)}%` }} />
                <span className="expense" style={{ height: `${Math.max(3, (row.expense / max) * 100)}%` }} />
              </div>
              <small>{row.label}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendDetails({ rows, max, formatAmount }: { rows: { label: string; expense: number; income: number }[]; max: number; formatAmount: (value: number) => string }) {
  return (
    <div className="analytics-panel">
      <div className="analytics-panel-header">
        <h3>Тренди</h3>
        <span>{rows.length} точок</span>
      </div>
      <TrendChart rows={rows} max={max} formatValue={formatAmount} embedded />
      <div className="trend-detail-list">
        {rows.slice().reverse().map((row, index) => (
          <div key={`${row.label}-${index}`} className="trend-detail-row">
            <strong>{row.label}</strong>
            <span>-{formatAmount(row.expense)}</span>
            <span className="positive">+{formatAmount(row.income)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
