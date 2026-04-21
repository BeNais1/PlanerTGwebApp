// History Screen — all transactions grouped by month
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { getAllTransactions, type Transaction } from '../../services/database';
import { Colors, Radius } from '../../constants/Theme';
import { TransactionItem } from '../../components/TransactionItem';

export default function HistoryScreen() {
  const { user } = useAuth();
  const { formatValue, CURRENCY_SYMBOLS } = useCurrency();
  const { icons: CATEGORY_ICONS, names: CATEGORY_NAMES } = useCategories();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setLoading(true);
      const allTxs = await getAllTransactions(user.id);
      setHistory(allTxs);
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  // Group by month
  const groupedHistory = history.reduce((acc, tx) => {
    const monthName = new Date(tx.date).toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    if (!acc[monthName]) acc[monthName] = [];
    acc[monthName].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Уся історія</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.blue} />
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Немає транзакцій</Text>
          <Text style={styles.emptySubtext}>Ваші витрати та доходи з'являться тут</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {Object.entries(groupedHistory).map(([monthStr, txs]) => (
            <View key={monthStr} style={styles.monthGroup}>
              <Text style={styles.monthTitle}>{monthStr}</Text>
              <View style={styles.txList}>
                {txs.map((item) => (
                  <TransactionItem
                    key={item.id}
                    transaction={item}
                    categoryIcons={CATEGORY_ICONS}
                    categoryNames={CATEGORY_NAMES}
                    currencySymbols={CURRENCY_SYMBOLS}
                    formatValue={formatValue}
                  />
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.textOnDark,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.textOnDarkSecondary,
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textOnDark,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textOnDarkTertiary,
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  monthGroup: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 15,
    color: Colors.textOnDarkSecondary,
    marginBottom: 8,
    paddingLeft: 4,
    fontWeight: '600',
  },
  txList: {
    gap: 8,
  },
});
