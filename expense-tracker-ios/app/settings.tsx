// Settings Screen — wallet management & categories
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import { useCategories } from '../hooks/useCategories';
import {
  updateUserSettings,
  addWalletBalance,
  deleteWalletData,
  getCurrentMonth,
  subscribeToMonthlyBalance,
  subscribeToTransactions,
  type MonthData,
  type Transaction,
} from '../services/database';
import { Colors, Radius } from '../constants/Theme';
import { WalletCard } from '../components/WalletCard';
import { AnimatedBalance } from '../components/AnimatedBalance';

const ALL_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currency, walletNames, CURRENCY_SYMBOLS, EXCHANGE_RATES } = useCurrency();
  const { categories, addCategory, removeCategory, restoreCategory, hiddenCategoryIds, defaultCategories } = useCategories();
  const currentMonth = getCurrentMonth();

  const [activeTab, setActiveTab] = useState<'wallets' | 'categories'>('wallets');

  // Wallet data
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [newWalletCurrency, setNewWalletCurrency] = useState<Currency>('USD');
  const [newWalletAmount, setNewWalletAmount] = useState('');

  // Category add
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newCatColor, setNewCatColor] = useState('#007AFF');

  const COLORS = ['#FF9500', '#007AFF', '#34C759', '#AF52DE', '#FF2D55', '#FF3B30', '#5856D6', '#5AC8FA', '#A2845E', '#8E8E93'];

  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeToMonthlyBalance(user.id, currentMonth, setMonthData);
    const unsub2 = subscribeToTransactions(user.id, currentMonth, setTransactions);
    return () => { unsub1(); unsub2(); };
  }, [user, currentMonth]);

  // Calculate wallet balances
  const walletBalances: Record<string, number> = {};
  if (monthData?.initialBalance) walletBalances['EUR'] = monthData.initialBalance;
  if (monthData?.balances) {
    Object.entries(monthData.balances).forEach(([cur, amt]) => {
      walletBalances[cur] = (walletBalances[cur] || 0) + amt;
    });
  }
  if (Object.keys(walletBalances).length === 0) walletBalances['EUR'] = 0;
  transactions.forEach(t => {
    const cur = t.currency || 'EUR';
    if (walletBalances[cur] === undefined) walletBalances[cur] = 0;
    if (t.type === 'expense') walletBalances[cur] -= t.amount;
    if (t.type === 'income') walletBalances[cur] += t.amount;
  });

  const availableWallets = Object.keys(walletBalances) as Currency[];

  // Totals
  const totalEur = Object.entries(walletBalances).reduce((acc, [cur, amt]) =>
    acc + (amt / EXCHANGE_RATES[cur as Currency]), 0);
  const totalUsd = totalEur * EXCHANGE_RATES['USD'];
  const totalUah = totalEur * EXCHANGE_RATES['UAH'];

  const handleCurrencyChange = async (newCurrency: Currency) => {
    if (!user) return;
    Haptics.selectionAsync();
    await updateUserSettings(user.id, { currency: newCurrency });
  };

  const handleAddWallet = async () => {
    if (!user || !newWalletAmount) return;
    const amount = parseFloat(newWalletAmount);
    if (!isNaN(amount) && amount > 0) {
      await addWalletBalance(user.id, currentMonth, newWalletCurrency, amount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsAddingWallet(false);
      setNewWalletAmount('');
    }
  };

  const handleDeleteWallet = async (c: Currency) => {
    if (!user) return;
    Alert.alert(
      'Видалити гаманець?',
      `Всі транзакції в ${c} за цей місяць будуть видалені.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити', style: 'destructive',
          onPress: async () => {
            await deleteWalletData(user.id, currentMonth, c);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleAddCategory = async () => {
    if (!newCatName) return;
    await addCategory({
      id: `custom_${Date.now()}`,
      name: newCatName,
      icon: newCatIcon,
      color: newCatColor,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewCatName('');
    setNewCatIcon('📌');
    setNewCatColor('#007AFF');
    setIsAddingCategory(false);
  };

  const hiddenDefaults = defaultCategories.filter(c => hiddenCategoryIds.includes(c.id));

  const fmt = (v: number, sym: string) =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Налаштування</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textOnDark} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['wallets', 'categories'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'wallets' ? 'Гаманці' : 'Категорії'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'wallets' ? (
            <>
              {/* Total Summary */}
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>ЗАГАЛЬНИЙ БАЛАНС</Text>
                <View style={styles.totalRow}>
                  <Text style={styles.totalCurrLabel}>В Євро</Text>
                  <AnimatedBalance value={totalEur} formatter={(v) => fmt(v, CURRENCY_SYMBOLS['EUR'])} style={styles.totalValue} />
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalCurrLabel}>В Доларах</Text>
                  <AnimatedBalance value={totalUsd} formatter={(v) => fmt(v, CURRENCY_SYMBOLS['USD'])} style={styles.totalValue} />
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalCurrLabel}>В Гривні</Text>
                  <AnimatedBalance value={totalUah} formatter={(v) => fmt(v, CURRENCY_SYMBOLS['UAH'])} style={styles.totalValue} />
                </View>
              </View>

              {/* Wallet Cards */}
              <View style={styles.walletsSection}>
                {availableWallets.map(c => (
                  <WalletCard
                    key={c}
                    currency={c}
                    balance={walletBalances[c]}
                    displayName={walletNames[c] || `Гаманець ${c}`}
                    isMain={c === currency}
                    currencySymbols={CURRENCY_SYMBOLS}
                    onMakeMain={() => handleCurrencyChange(c)}
                    onDelete={() => handleDeleteWallet(c)}
                    exchangeRates={EXCHANGE_RATES}
                  />
                ))}

                {!isAddingWallet ? (
                  <TouchableOpacity style={styles.addWalletBtn} onPress={() => setIsAddingWallet(true)}>
                    <Text style={styles.addWalletBtnText}>➕ Додати гаманець</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.addWalletForm}>
                    <View style={styles.addWalletRow}>
                      <View style={styles.pickerContainer}>
                        {ALL_CURRENCIES.map(c => (
                          <TouchableOpacity
                            key={c}
                            style={[styles.pickerItem, newWalletCurrency === c && styles.pickerItemActive]}
                            onPress={() => setNewWalletCurrency(c)}
                          >
                            <Text style={styles.pickerItemText}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={styles.addWalletInput}
                        placeholder="Сума"
                        placeholderTextColor={Colors.textOnDarkTertiary}
                        value={newWalletAmount}
                        onChangeText={setNewWalletAmount}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.addWalletActions}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddingWallet(false)}>
                        <Text style={styles.cancelBtnText}>Скасувати</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmBtn} onPress={handleAddWallet} disabled={!newWalletAmount}>
                        <Text style={styles.confirmBtnText}>Додати</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.categoriesSection}>
              {/* Active categories */}
              <Text style={styles.sectionLabel}>АКТИВНІ КАТЕГОРІЇ</Text>
              <View style={styles.catList}>
                {categories.map(cat => (
                  <View key={cat.id} style={styles.catItem}>
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text style={styles.catName}>{cat.name}</Text>
                    {cat.isCustom && <Text style={styles.catCustomBadge}>Власна</Text>}
                    <TouchableOpacity onPress={() => { removeCategory(cat.id); Haptics.selectionAsync(); }} hitSlop={8}>
                      <Text style={styles.catDeleteBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Hidden categories */}
              {hiddenDefaults.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ПРИХОВАНІ КАТЕГОРІЇ</Text>
                  <View style={styles.catList}>
                    {hiddenDefaults.map(cat => (
                      <View key={cat.id} style={[styles.catItem, { opacity: 0.6 }]}>
                        <Text style={styles.catIcon}>{cat.icon}</Text>
                        <Text style={[styles.catName, { flex: 1 }]}>{cat.name}</Text>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => { restoreCategory(cat.id); Haptics.selectionAsync(); }}
                        >
                          <Text style={styles.restoreBtnText}>Повернути</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Add custom */}
              {isAddingCategory ? (
                <View style={styles.addCatForm}>
                  <View style={styles.addCatRow}>
                    <TextInput
                      style={styles.addCatIconInput}
                      value={newCatIcon}
                      onChangeText={setNewCatIcon}
                    />
                    <TextInput
                      style={styles.addCatNameInput}
                      value={newCatName}
                      onChangeText={setNewCatName}
                      placeholder="Назва категорії"
                      placeholderTextColor={Colors.textOnDarkTertiary}
                      autoFocus
                    />
                  </View>
                  <View style={styles.colorSelector}>
                    {COLORS.map(color => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorDot,
                          { backgroundColor: color },
                          newCatColor === color && styles.colorDotSelected,
                        ]}
                        onPress={() => setNewCatColor(color)}
                      />
                    ))}
                  </View>
                  <View style={styles.addWalletActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddingCategory(false)}>
                      <Text style={styles.cancelBtnText}>Скасувати</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, !newCatName && { opacity: 0.5 }]}
                      onPress={handleAddCategory}
                      disabled={!newCatName}
                    >
                      <Text style={styles.confirmBtnText}>Створити</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.addCatBtn} onPress={() => setIsAddingCategory(true)}>
                  <Text style={styles.addCatBtnText}>+ Створити категорію</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textOnDark },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: Colors.surface2, borderRadius: 12, padding: 3, marginHorizontal: 20, marginBottom: 16 },
  tab: { flex: 1, padding: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.surface3 },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textOnDarkSecondary },
  tabTextActive: { color: Colors.white },
  scrollView: { flex: 1, paddingHorizontal: 20 },
  // Total card
  totalCard: { backgroundColor: Colors.surface2, borderRadius: Radius.lg, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.surface3 },
  totalLabel: { color: Colors.textOnDarkSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalCurrLabel: { color: Colors.textOnDarkSecondary, fontSize: 15 },
  totalValue: { fontSize: 20, fontWeight: '700', color: Colors.white },
  // Wallets
  walletsSection: { gap: 16 },
  addWalletBtn: { padding: 12, backgroundColor: Colors.surface3, borderRadius: Radius.md, alignItems: 'center' },
  addWalletBtnText: { color: Colors.blue, fontWeight: '600' },
  addWalletForm: { backgroundColor: Colors.surface3, padding: 14, borderRadius: Radius.md, gap: 10 },
  addWalletRow: { flexDirection: 'row', gap: 10 },
  pickerContainer: { flexDirection: 'row', gap: 4 },
  pickerItem: { padding: 10, backgroundColor: Colors.surface2, borderRadius: 10 },
  pickerItemActive: { backgroundColor: Colors.blue },
  pickerItemText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
  addWalletInput: { flex: 1, backgroundColor: Colors.surface2, borderRadius: 10, padding: 10, color: Colors.white },
  addWalletActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: Colors.surface2, alignItems: 'center' },
  cancelBtnText: { color: Colors.textOnDark },
  confirmBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: Colors.blue, alignItems: 'center' },
  confirmBtnText: { color: Colors.white, fontWeight: '600' },
  // Categories
  categoriesSection: { gap: 12 },
  sectionLabel: { fontSize: 13, color: Colors.textOnDarkSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  catList: { gap: 6 },
  catItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, backgroundColor: Colors.surface2, borderRadius: 14 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catIcon: { fontSize: 20 },
  catName: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.white },
  catCustomBadge: { fontSize: 11, color: Colors.textOnDarkTertiary, backgroundColor: Colors.surface3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  catDeleteBtn: { fontSize: 14, color: Colors.textOnDarkTertiary, padding: 4 },
  restoreBtn: { backgroundColor: Colors.blue, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  restoreBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  addCatBtn: { padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.surface3, borderRadius: 14, alignItems: 'center' },
  addCatBtnText: { color: Colors.blue, fontSize: 14, fontWeight: '600' },
  addCatForm: { backgroundColor: Colors.surface2, padding: 14, borderRadius: 16, gap: 10 },
  addCatRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addCatIconInput: { width: 42, height: 42, textAlign: 'center', fontSize: 20, backgroundColor: Colors.surface3, borderRadius: 10, color: Colors.white },
  addCatNameInput: { flex: 1, padding: 10, backgroundColor: Colors.surface3, borderRadius: 10, color: Colors.white, fontSize: 15 },
  colorSelector: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorDotSelected: { borderColor: Colors.white },
});
