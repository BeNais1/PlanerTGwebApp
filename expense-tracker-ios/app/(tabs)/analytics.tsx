// Analytics Screen — donut chart with category breakdown
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import {
  getAllTransactions,
  getCurrentMonth,
  subscribeToMonthlyBalance,
  subscribeToTransactions,
  type Transaction,
  type MonthData,
} from '../../services/database';
import { Colors, Radius } from '../../constants/Theme';
import { FilterChip } from '../../components/FilterChip';
import { DonutChart } from '../../components/DonutChart';

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
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d.getTime();
    }
    case 'year':
      return new Date(now.getFullYear(), 0, 1).getTime();
    case 'all':
      return 0;
  }
}

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, CURRENCY_SYMBOLS, convertToMain } = useCurrency();
  const { colors: CATEGORY_COLORS, names: CATEGORY_NAMES } = useCategories();

  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [txType, setTxType] = useState<TxTypeFilter>('expense');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Wallet balances for currency filter
  const currentMonth = getCurrentMonth();
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [monthTxs, setMonthTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeToMonthlyBalance(user.id, currentMonth, setMonthData);
    const unsub2 = subscribeToTransactions(user.id, currentMonth, setMonthTxs);
    return () => { unsub1(); unsub2(); };
  }, [user, currentMonth]);

  const walletBalances: Record<string, number> = {};
  if (monthData?.balances) {
    Object.entries(monthData.balances).forEach(([cur, amt]) => {
      walletBalances[cur] = (walletBalances[cur] || 0) + amt;
    });
  }
  if (Object.keys(walletBalances).length === 0) walletBalances['EUR'] = 0;

  // Load all transactions
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    getAllTransactions(user.id).then(txs => {
      setAllTransactions(txs);
      setIsLoading(false);
    });
  }, [user]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    return allTransactions.filter(t => {
      if (t.date < rangeStart) return false;
      if (txType !== 'all' && t.type !== txType) return false;
      return true;
    });
  }, [allTransactions, dateRange, txType]);

  // Aggregate by category
  const categoryTotals: Record<string, number> = {};
  let totalAmount = 0;

  filteredTransactions.forEach(t => {
    let amount = t.amount;
    if (t.currency !== mainCurrency) {
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
      .filter(t => t.type === 'expense' && t.date >= rangeStart)
      .reduce((acc, t) => acc + convertToMain(t.amount, (t.currency || 'EUR') as Currency), 0);
  }, [allTransactions, dateRange, mainCurrency]);

  const totalIncome = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    return allTransactions
      .filter(t => t.type === 'income' && t.date >= rangeStart)
      .reduce((acc, t) => acc + convertToMain(t.amount, (t.currency || 'EUR') as Currency), 0);
  }, [allTransactions, dateRange, mainCurrency]);

  const currSymbol = CURRENCY_SYMBOLS[mainCurrency];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Аналітика</Text>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ВИТРАТИ</Text>
            <Text style={styles.summaryValue}>{formatValue(totalExpenses)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ДОХОДИ</Text>
            <Text style={[styles.summaryValue, { color: Colors.blue }]}>{formatValue(totalIncome)}</Text>
          </View>
        </View>

        {/* Date Range Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(range => (
            <FilterChip
              key={range}
              label={DATE_RANGE_LABELS[range]}
              isActive={dateRange === range}
              onPress={() => setDateRange(range)}
              style={{ marginRight: 6 }}
            />
          ))}
        </ScrollView>

        {/* Type Filter */}
        <View style={styles.typeFilterRow}>
          {([['expense', 'Витрати'], ['income', 'Доходи'], ['all', 'Усе']] as [TxTypeFilter, string][]).map(([type, label]) => (
            <FilterChip
              key={type}
              label={label}
              isActive={txType === type}
              onPress={() => setTxType(type)}
              style={{ marginRight: 6 }}
            />
          ))}
        </View>

        {/* Chart Section */}
        <View style={styles.chartContainer}>
          {isLoading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="large" color={Colors.blue} />
              <Text style={styles.chartLoadingText}>Завантаження...</Text>
            </View>
          ) : totalAmount > 0 ? (
            <>
              <View style={styles.chartWrapper}>
                <DonutChart
                  data={sortedCategories.map(([category, amount]) => ({
                    category,
                    amount,
                    color: CATEGORY_COLORS[category] || '#8E8E93',
                  }))}
                  totalAmount={totalAmount}
                  centerLabel={txType === 'expense' ? 'Витрата' : txType === 'income' ? 'Дохід' : 'Разом'}
                  centerValue={formatValue(totalAmount)}
                  centerSub={currSymbol}
                />
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                {sortedCategories.map(([category, amount]) => {
                  const percentage = ((amount / totalAmount) * 100).toFixed(1);
                  return (
                    <View key={category} style={styles.legendItem}>
                      <View style={styles.legendLeft}>
                        <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[category] || '#8E8E93' }]} />
                        <Text style={styles.legendName}>{CATEGORY_NAMES[category] || category}</Text>
                      </View>
                      <View style={styles.legendRight}>
                        <Text style={styles.legendAmount}>
                          {formatValue(amount)} {currSymbol}
                        </Text>
                        <Text style={styles.legendPercent}>{percentage}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Немає даних за обраний період</Text>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  scrollView: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 34, fontWeight: '700', color: Colors.textOnDark, marginTop: 12, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: Colors.surface1, borderRadius: 16, padding: 16 },
  summaryLabel: { fontSize: 12, color: Colors.textOnDarkTertiary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 20, fontWeight: '700', color: Colors.white, marginTop: 4 },
  filterRow: { marginBottom: 12, flexGrow: 0 },
  typeFilterRow: { flexDirection: 'row', marginBottom: 16 },
  chartContainer: { backgroundColor: Colors.surface1, borderRadius: 24, padding: 24 },
  chartLoading: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  chartLoadingText: { color: Colors.textOnDarkSecondary, fontSize: 14 },
  chartWrapper: { alignItems: 'center', marginBottom: 32 },
  legend: { gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendName: { fontSize: 16, color: Colors.textOnDark, fontWeight: '500' },
  legendRight: { alignItems: 'flex-end' },
  legendAmount: { fontSize: 16, fontWeight: '700', color: Colors.textOnDark },
  legendPercent: { fontSize: 13, color: Colors.textOnDarkSecondary },
  emptyText: { textAlign: 'center', paddingVertical: 40, color: Colors.textOnDarkSecondary, fontSize: 14 },
});
