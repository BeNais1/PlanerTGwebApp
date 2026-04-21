// Spend modal — add expense transaction
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '../../constants/Theme';
import { CategoryGrid } from '../CategoryGrid';
import { useCategories } from '../../hooks/useCategories';
import { useCurrency, type Currency } from '../../hooks/useCurrency';

interface SpendModalProps {
  visible: boolean;
  onClose: () => void;
  onSpend: (amount: number, category: string, description: string, currency: Currency) => void;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

export const SpendModal = ({ visible, onClose, onSpend, isLoading, walletBalances }: SpendModalProps) => {
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue } = useCurrency();
  const { categories } = useCategories();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(mainCurrency);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].id);
    }
  }, [categories]);

  useEffect(() => {
    if (walletBalances[mainCurrency] !== undefined) {
      setSelectedCurrency(mainCurrency);
    } else if (Object.keys(walletBalances).length > 0) {
      setSelectedCurrency(Object.keys(walletBalances)[0] as Currency);
    }
  }, [mainCurrency]);

  const handleAmountChange = (val: string) => {
    const sanitized = val.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (sanitized.split('.').length <= 2) setAmount(sanitized);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSpend(numAmount, category, description, selectedCurrency);
      setAmount('');
      setDescription('');
    }
  };

  const isValid = parseFloat(amount) > 0;
  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Витрата</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          <TextInput
            style={styles.amountInput}
            placeholder={`0.00 ${CURRENCY_SYMBOLS[selectedCurrency]}`}
            placeholderTextColor={Colors.textOnDarkTertiary}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            autoFocus
          />

          {/* Wallet Selector */}
          <Text style={styles.label}>Гаманець</Text>
          <View style={styles.currencyRow}>
            {availableWallets.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.currencyBtn, selectedCurrency === c && styles.currencyBtnActive]}
                onPress={() => { setSelectedCurrency(c); Haptics.selectionAsync(); }}
              >
                <Text style={styles.currencyBtnText}>{c}</Text>
                <Text style={styles.currencyBtnSub}>{formatValue(walletBalances[c], c)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category */}
          <Text style={styles.label}>Категорія</Text>
          <CategoryGrid
            categories={categories}
            selectedId={category}
            onSelect={(id) => { setCategory(id); Haptics.selectionAsync(); }}
          />

          {/* Description */}
          <Text style={[styles.label, { marginTop: 16 }]}>Коментар (необов'язково)</Text>
          <TextInput
            style={styles.input}
            placeholder="Наприклад, кава з колегами"
            placeholderTextColor={Colors.textOnDarkTertiary}
            value={description}
            onChangeText={setDescription}
          />
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
          disabled={!isValid || isLoading}
          onPress={handleSubmit}
        >
          <Text style={styles.submitBtnText}>{isLoading ? 'Збереження...' : 'Витратити'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.surface1,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textOnDark,
  },
  closeBtn: {
    fontSize: 20,
    color: Colors.textOnDarkTertiary,
    padding: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '600',
    color: Colors.textOnDark,
    textAlign: 'center',
    paddingVertical: 20,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textOnDarkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  currencyBtn: {
    flex: 1,
    padding: 10,
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  currencyBtnActive: {
    backgroundColor: Colors.blue,
  },
  currencyBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  currencyBtnSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: 14,
    color: Colors.textOnDark,
    fontSize: 16,
    marginBottom: 16,
  },
  submitBtn: {
    margin: 20,
    padding: 16,
    backgroundColor: Colors.blue,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
});
