// Home Screen — balance display, action buttons, today's transactions
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import {
  getCurrentMonth,
  subscribeToMonthlyBalance,
  subscribeToTransactions,
  setMonthlyBalance,
  addTransaction,
  type Transaction,
  type MonthData,
} from '../../services/database';
import { Colors, Radius, Spacing } from '../../constants/Theme';
import { AnimatedBalance } from '../../components/AnimatedBalance';
import { TransactionItem } from '../../components/TransactionItem';
import { SpendModal } from '../../components/modals/SpendModal';
import { AddIncomeModal } from '../../components/modals/AddIncomeModal';
import { SetBalanceModal } from '../../components/modals/SetBalanceModal';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currency: mainCurrency, formatValue, convertToMain, CURRENCY_SYMBOLS } = useCurrency();
  const { icons: CATEGORY_ICONS, names: CATEGORY_NAMES } = useCategories();
  const currentMonth = getCurrentMonth();

  // State
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSpendOpen, setIsSpendOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load data from Firebase
  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;

    const unsubBalance = subscribeToMonthlyBalance(user.id, currentMonth, (data) => {
      if (isSubscribed) {
        setMonthData(data);
        setIsDataLoaded(true);
      }
    });

    const unsubTx = subscribeToTransactions(user.id, currentMonth, (txs) => {
      if (isSubscribed) {
        setTransactions(txs);
      }
    });

    return () => {
      isSubscribed = false;
      unsubBalance();
      unsubTx();
    };
  }, [user, currentMonth]);

  // Wallet balances calculation (identical to web)
  const walletBalances: Record<string, number> = {};
  if (monthData) {
    if (monthData.initialBalance) {
      walletBalances['EUR'] = monthData.initialBalance;
    }
    if (monthData.balances) {
      Object.entries(monthData.balances).forEach(([cur, amount]) => {
        walletBalances[cur] = (walletBalances[cur] || 0) + amount;
      });
    }
  }
  if (Object.keys(walletBalances).length === 0) {
    walletBalances['EUR'] = 0;
  }

  transactions.forEach(t => {
    const cur = t.currency || 'EUR';
    if (walletBalances[cur] === undefined) walletBalances[cur] = 0;
    if (t.type === 'expense') walletBalances[cur] -= t.amount;
    if (t.type === 'income') walletBalances[cur] += t.amount;
  });

  let currentBalance = 0;
  Object.entries(walletBalances).forEach(([cur, amount]) => {
    currentBalance += convertToMain(amount, cur as Currency);
  });

  // Handlers
  const handleSetInitialBalance = async (amount: number, currency: Currency = mainCurrency) => {
    if (!user) return;
    setIsSaving(true);
    await setMonthlyBalance(user.id, currentMonth, amount, currency);
    setIsSaving(false);
  };

  const handleSpend = async (amount: number, category: string, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    await addTransaction(user.id, {
      type: 'expense', amount, category, description,
      date: Date.now(), month: currentMonth, currency,
    });
    setIsSaving(false);
    setIsSpendOpen(false);
  };

  const handleAdd = async (amount: number, description: string, currency: Currency) => {
    if (!user) return;
    setIsSaving(true);
    await addTransaction(user.id, {
      type: 'income', amount, category: 'income', description,
      date: Date.now(), month: currentMonth, currency,
    });
    setIsSaving(false);
    setIsAddOpen(false);
  };

  const monthName = new Date().toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
  const todayDateStr = new Date().toLocaleDateString();
  const todaysTransactions = transactions.filter(t =>
    new Date(t.date).toLocaleDateString() === todayDateStr
  );

  const needsSetup = monthData === null || monthData === undefined;

  if (!isDataLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Set Balance Modal */}
      <SetBalanceModal
        visible={needsSetup && isDataLoaded}
        onSetBalance={handleSetInitialBalance}
        isLoading={isSaving}
      />

      {/* Spend Modal */}
      <SpendModal
        visible={isSpendOpen}
        onClose={() => setIsSpendOpen(false)}
        onSpend={handleSpend}
        isLoading={isSaving}
        walletBalances={walletBalances}
      />

      {/* Add Income Modal */}
      <AddIncomeModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={handleAdd}
        isLoading={isSaving}
        walletBalances={walletBalances}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{monthName}</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => { Haptics.selectionAsync(); router.push('/settings'); }}
        >
          <Ionicons name="settings-outline" size={20} color={Colors.textOnDark} />
        </TouchableOpacity>
      </View>

      {/* Balance Section */}
      <View style={styles.balanceSection}>
        <AnimatedBalance
          value={walletBalances[mainCurrency] || 0}
          formatter={formatValue}
          style={styles.balanceAmount}
        />
        <View style={styles.balanceSubRow}>
          <Text style={styles.balanceSub}>Загальний капітал: </Text>
          <AnimatedBalance
            value={currentBalance}
            formatter={formatValue}
            style={styles.balanceSub}
          />
        </View>
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsSpendOpen(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-up" size={22} color={Colors.textOnDark} />
            <Text style={styles.actionBtnText}>Витрата</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsAddOpen(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-down" size={22} color={Colors.textOnDark} />
            <Text style={styles.actionBtnText}>Дохід</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Transactions */}
        <View style={styles.paymentHistory}>
          <View style={styles.paymentHeader}>
            <Text style={styles.paymentHeaderTitle}>Сьогодні</Text>
          </View>

          <ScrollView style={styles.paymentList} showsVerticalScrollIndicator={false}>
            {todaysTransactions.length === 0 ? (
              <Text style={styles.emptyText}>Немає транзакцій сьогодні</Text>
            ) : (
              todaysTransactions.map((item) => (
                <TransactionItem
                  key={item.id}
                  transaction={item}
                  categoryIcons={CATEGORY_ICONS}
                  categoryNames={CATEGORY_NAMES}
                  currencySymbols={CURRENCY_SYMBOLS}
                  formatValue={formatValue}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textOnDarkSecondary,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textOnDark,
    letterSpacing: -0.374,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 120,
    gap: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '600',
    color: Colors.textOnDark,
    letterSpacing: -0.28,
  },
  balanceSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceSub: {
    fontSize: 14,
    color: Colors.textOnDarkTertiary,
    letterSpacing: -0.224,
  },
  bottomCard: {
    padding: 16,
    backgroundColor: Colors.surface1,
    borderRadius: Radius.xl,
    marginHorizontal: 12,
    marginBottom: 8,
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textOnDark,
  },
  paymentHistory: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    padding: 14,
    flex: 1,
    minHeight: 0,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  paymentHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textOnDark,
  },
  paymentList: {
    flex: 1,
    gap: 4,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: Colors.textOnDarkTertiary,
    fontSize: 13,
  },
});
