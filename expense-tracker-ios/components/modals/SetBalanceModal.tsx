// Set Balance Modal — for initial setup
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '../../constants/Theme';
import { useCurrency, type Currency } from '../../hooks/useCurrency';

interface SetBalanceModalProps {
  visible: boolean;
  onSetBalance: (amount: number, currency?: Currency) => void;
  isLoading?: boolean;
}

export const SetBalanceModal = ({ visible, onSetBalance, isLoading }: SetBalanceModalProps) => {
  const { currency: mainCurrency, CURRENCY_SYMBOLS } = useCurrency();
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(mainCurrency);

  const handleAmountChange = (val: string) => {
    const sanitized = val.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (sanitized.split('.').length <= 2) setAmount(sanitized);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSetBalance(numAmount, selectedCurrency);
    }
  };

  const isValid = parseFloat(amount) > 0;
  const ALL_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.title}>Встановити баланс</Text>
          <Text style={styles.subtitle}>
            Вкажіть ваш поточний баланс для початку
          </Text>

          <TextInput
            style={styles.amountInput}
            placeholder={`0.00 ${CURRENCY_SYMBOLS[selectedCurrency]}`}
            placeholderTextColor={Colors.textOnDarkTertiary}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            autoFocus
          />

          <View style={styles.currencyRow}>
            {ALL_CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.currencyBtn, selectedCurrency === c && styles.currencyBtnActive]}
                onPress={() => { setSelectedCurrency(c); Haptics.selectionAsync(); }}
              >
                <Text style={styles.currencyBtnText}>{c} {CURRENCY_SYMBOLS[c]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
            disabled={!isValid || isLoading}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>{isLoading ? 'Збереження...' : 'Почати'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: Colors.surface1,
    borderRadius: Radius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textOnDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textOnDarkSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '600',
    color: Colors.textOnDark,
    textAlign: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    marginBottom: 16,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  currencyBtn: {
    flex: 1,
    padding: 12,
    backgroundColor: Colors.surface2,
    borderRadius: 12,
    alignItems: 'center',
  },
  currencyBtnActive: {
    backgroundColor: Colors.blue,
  },
  currencyBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
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
