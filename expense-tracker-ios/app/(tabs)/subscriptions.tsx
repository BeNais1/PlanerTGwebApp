// Subscriptions Screen — manage recurring payments
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import {
  type Subscription,
  subscribeToSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
} from '../../services/database';
import { Colors, Radius } from '../../constants/Theme';

const PRESET_SUBSCRIPTIONS = [
  { name: 'Spotify', icon: '🎵', category: 'subscriptions', amount: 9.99 },
  { name: 'Netflix', icon: '🍿', category: 'subscriptions', amount: 15.49 },
  { name: 'Apple Music', icon: '🎧', category: 'subscriptions', amount: 10.99 },
  { name: 'YouTube Premium', icon: '▶️', category: 'subscriptions', amount: 13.99 },
  { name: 'ChatGPT Plus', icon: '🤖', category: 'subscriptions', amount: 20.00 },
  { name: 'iCloud+', icon: '☁️', category: 'subscriptions', amount: 2.99 },
  { name: 'Apple TV+', icon: '📺', category: 'subscriptions', amount: 9.99 },
  { name: 'Disney+', icon: '🏰', category: 'subscriptions', amount: 13.99 },
  { name: 'Adobe CC', icon: '🎨', category: 'subscriptions', amount: 54.99 },
  { name: 'Notion', icon: '📝', category: 'subscriptions', amount: 10.00 },
  { name: 'Gym', icon: '💪', category: 'health', amount: 30.00 },
  { name: 'VPN', icon: '🔒', category: 'subscriptions', amount: 12.99 },
];

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Щотижня',
  monthly: 'Щомісяця',
  yearly: 'Щорічно',
};

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue, convertToMain } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState<Currency>(mainCurrency);
  const [formPeriod, setFormPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [formIcon, setFormIcon] = useState('🔄');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSubscriptions(user.id, (subs) => {
      setSubscriptions(subs);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    setFormCurrency(mainCurrency);
  }, [mainCurrency]);

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormPeriod('monthly');
    setFormIcon('🔄');
    setFormCurrency(mainCurrency);
  };

  const handleSelectPreset = (preset: typeof PRESET_SUBSCRIPTIONS[0]) => {
    setFormName(preset.name);
    setFormAmount(preset.amount.toString());
    setFormIcon(preset.icon);
    setIsAdding(true);
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!user || !formName || !formAmount) return;
    setIsSaving(true);

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setIsSaving(false); return; }

    const getDefaultNextDate = (period: string): number => {
      const now = new Date();
      if (period === 'weekly') now.setDate(now.getDate() + 7);
      else if (period === 'monthly') now.setMonth(now.getMonth() + 1);
      else now.setFullYear(now.getFullYear() + 1);
      return now.getTime();
    };

    const nextDate = getDefaultNextDate(formPeriod);

    if (editingSub?.id) {
      await updateSubscription(user.id, editingSub.id, {
        name: formName,
        amount,
        currency: formCurrency,
        period: formPeriod,
        nextDate,
        icon: formIcon,
        category: 'subscriptions',
      });
    } else {
      await addSubscription(user.id, {
        name: formName,
        amount,
        currency: formCurrency,
        category: 'subscriptions',
        icon: formIcon,
        period: formPeriod,
        nextDate,
        createdAt: Date.now(),
        isActive: true,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    setIsAdding(false);
    setEditingSub(null);
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteSubscription(user.id, id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setEditingSub(null);
    setIsAdding(false);
  };

  const handleEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setFormName(sub.name);
    setFormAmount(sub.amount.toString());
    setFormCurrency(sub.currency as Currency);
    setFormPeriod(sub.period);
    setFormIcon(sub.icon);
    setIsAdding(true);
    Haptics.selectionAsync();
  };

  // Monthly cost calculation
  const monthlyCost = subscriptions
    .filter(s => s.isActive)
    .reduce((acc, sub) => {
      let monthly = sub.amount;
      if (sub.period === 'weekly') monthly = sub.amount * 4.33;
      if (sub.period === 'yearly') monthly = sub.amount / 12;
      return acc + convertToMain(monthly, (sub.currency || 'EUR') as Currency);
    }, 0);

  const getDaysUntil = (timestamp: number) => {
    const diff = timestamp - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Прострочено';
    if (days === 0) return 'Сьогодні';
    if (days === 1) return 'Завтра';
    return `Через ${days} дн.`;
  };

  const handleAmountChange = (val: string) => {
    const sanitized = val.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (sanitized.split('.').length <= 2) setFormAmount(sanitized);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Підписки</Text>

          {/* Monthly Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ВИТРАТИ НА МІСЯЦЬ</Text>
            <Text style={styles.summaryAmount}>{formatValue(monthlyCost)}</Text>
            <Text style={styles.summaryCount}>
              {subscriptions.filter(s => s.isActive).length} активних підписок
            </Text>
          </View>

          {/* Add/Edit Form */}
          {isAdding ? (
            <View style={styles.formContainer}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{editingSub ? 'Редагувати' : 'Нова підписка'}</Text>
                <TouchableOpacity onPress={() => { setIsAdding(false); setEditingSub(null); resetForm(); }}>
                  <Text style={styles.formCloseBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formIconNameRow}>
                <TextInput
                  style={styles.formIconInput}
                  value={formIcon}
                  onChangeText={setFormIcon}
                  placeholder="🔄"
                />
                <TextInput
                  style={styles.formNameInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Назва підписки"
                  placeholderTextColor={Colors.textOnDarkTertiary}
                />
              </View>

              <TextInput
                style={styles.formAmountInput}
                value={formAmount}
                onChangeText={handleAmountChange}
                placeholder={`0.00 ${CURRENCY_SYMBOLS[formCurrency]}`}
                placeholderTextColor={Colors.textOnDarkTertiary}
                keyboardType="decimal-pad"
              />

              {/* Period */}
              <View style={styles.periodRow}>
                {(['weekly', 'monthly', 'yearly'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.periodBtn, formPeriod === p && styles.periodBtnActive]}
                    onPress={() => { setFormPeriod(p); Haptics.selectionAsync(); }}
                  >
                    <Text style={styles.periodBtnText}>{PERIOD_LABELS[p]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.formActions}>
                {editingSub && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => editingSub?.id && handleDelete(editingSub.id)}
                  >
                    <Text style={styles.deleteBtnText}>Видалити</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, (!formName || !formAmount) && { opacity: 0.5 }]}
                  disabled={isSaving || !formName || !formAmount}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>
                    {isSaving ? 'Збереження...' : editingSub ? 'Зберегти' : 'Додати'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => { resetForm(); setIsAdding(true); Haptics.selectionAsync(); }}
            >
              <Text style={styles.addButtonText}>+ Додати підписку</Text>
            </TouchableOpacity>
          )}

          {/* Active Subscriptions */}
          {subscriptions.filter(s => s.isActive).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Активні підписки</Text>
              <View style={styles.subsList}>
                {subscriptions.filter(s => s.isActive).map(sub => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.subItem}
                    onPress={() => handleEdit(sub)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subIcon}>
                      <Text style={{ fontSize: 22 }}>{sub.icon}</Text>
                    </View>
                    <View style={styles.subInfo}>
                      <Text style={styles.subName}>{sub.name}</Text>
                      <Text style={styles.subMeta}>
                        {PERIOD_LABELS[sub.period]} · {getDaysUntil(sub.nextDate)}
                      </Text>
                    </View>
                    <Text style={styles.subAmount}>
                      {formatValue(sub.amount, sub.currency as Currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Preset Suggestions */}
          {!isAdding && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Популярні підписки</Text>
              <View style={styles.presetsGrid}>
                {PRESET_SUBSCRIPTIONS
                  .filter(p => !subscriptions.some(s => s.name === p.name))
                  .map(preset => (
                    <TouchableOpacity
                      key={preset.name}
                      style={styles.presetItem}
                      onPress={() => handleSelectPreset(preset)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 20 }}>{preset.icon}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.presetName} numberOfLines={1}>{preset.name}</Text>
                        <Text style={styles.presetPrice}>
                          ~{convertToMain(preset.amount, 'EUR' as Currency).toFixed(2)} {CURRENCY_SYMBOLS[mainCurrency]}/міс
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  scrollView: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 34, fontWeight: '700', color: Colors.textOnDark, marginTop: 12, marginBottom: 20 },
  summaryCard: {
    padding: 20, borderRadius: 20, marginBottom: 24,
    backgroundColor: Colors.surface1, borderWidth: 1, borderColor: Colors.surface3,
  },
  summaryLabel: { color: Colors.textOnDarkSecondary, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  summaryAmount: { fontSize: 32, fontWeight: '700', color: Colors.white, marginTop: 8 },
  summaryCount: { color: Colors.textOnDarkTertiary, fontSize: 13, marginTop: 4 },
  formContainer: {
    backgroundColor: Colors.surface1, borderRadius: 20, padding: 20, marginBottom: 20, gap: 16,
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontSize: 18, fontWeight: '600', color: Colors.textOnDark },
  formCloseBtn: { fontSize: 20, color: Colors.textOnDarkTertiary, padding: 4 },
  formIconNameRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  formIconInput: {
    width: 48, height: 48, textAlign: 'center', fontSize: 24,
    backgroundColor: Colors.surface2, borderRadius: 14, color: Colors.white,
  },
  formNameInput: {
    flex: 1, padding: 14, backgroundColor: Colors.surface2, borderRadius: 14,
    color: Colors.white, fontSize: 16,
  },
  formAmountInput: {
    fontSize: 24, fontWeight: '600', textAlign: 'center', padding: 14,
    backgroundColor: Colors.surface2, borderRadius: 14, color: Colors.white,
  },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1, padding: 10, borderRadius: 12, backgroundColor: Colors.surface2, alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: Colors.blue },
  periodBtnText: { color: Colors.white, fontWeight: '500', fontSize: 13 },
  formActions: { flexDirection: 'row', gap: 10 },
  deleteBtn: {
    flex: 1, padding: 14, borderRadius: 14, backgroundColor: Colors.surface2, alignItems: 'center',
  },
  deleteBtnText: { color: Colors.destructive, fontWeight: '600', fontSize: 16 },
  saveBtn: {
    flex: 2, padding: 14, borderRadius: 14, backgroundColor: Colors.blue, alignItems: 'center',
  },
  saveBtnText: { color: Colors.white, fontWeight: '600', fontSize: 16 },
  addButton: {
    width: '100%', padding: 14, backgroundColor: Colors.surface1,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.surface3,
    borderRadius: 16, marginBottom: 20, alignItems: 'center',
  },
  addButtonText: { color: Colors.blue, fontWeight: '600', fontSize: 15 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, color: Colors.textOnDarkSecondary, marginBottom: 12, fontWeight: '600' },
  subsList: { gap: 8 },
  subItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, paddingHorizontal: 16, backgroundColor: Colors.surface1, borderRadius: 16,
  },
  subIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  subInfo: { flex: 1, minWidth: 0 },
  subName: { fontSize: 16, fontWeight: '500', color: Colors.white },
  subMeta: { fontSize: 13, color: Colors.textOnDarkTertiary },
  subAmount: { fontSize: 16, fontWeight: '600', color: Colors.white },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetItem: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: Colors.surface1, borderRadius: 14,
  },
  presetName: { fontSize: 14, fontWeight: '500', color: Colors.white },
  presetPrice: { fontSize: 12, color: Colors.textOnDarkTertiary },
});
