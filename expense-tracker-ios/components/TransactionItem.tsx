// Transaction item component for lists
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Theme';
import type { Transaction } from '../services/database';
import type { Currency } from '../hooks/useCurrency';

interface TransactionItemProps {
  transaction: Transaction;
  categoryIcons: Record<string, string>;
  categoryNames: Record<string, string>;
  currencySymbols: Record<Currency, string>;
  formatValue: (amount: number, currency?: Currency) => string;
  onPress?: (transaction: Transaction) => void;
}

export const TransactionItem = ({
  transaction,
  categoryIcons,
  categoryNames,
  currencySymbols,
  formatValue,
  onPress,
}: TransactionItemProps) => {
  const isIncome = transaction.type === 'income';
  const icon = isIncome ? '↓' : categoryIcons[transaction.category] || '📦';
  const name = isIncome ? 'Дохід' : categoryNames[transaction.category] || 'Витрата';
  const currency = (transaction.currency || 'EUR') as Currency;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(transaction)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, isIncome && styles.incomeIcon]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description || new Date(transaction.date).toLocaleDateString()}
        </Text>
      </View>
      <Text style={[styles.amount, isIncome && styles.incomeAmount]}>
        {isIncome ? '+' : '-'}{formatValue(transaction.amount, currency)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 14,
    backgroundColor: Colors.surface1,
    borderRadius: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: Colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeIcon: {
    backgroundColor: Colors.blue,
  },
  iconText: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textOnDark,
  },
  description: {
    fontSize: 12,
    color: Colors.textOnDarkTertiary,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textOnDark,
    marginLeft: 'auto',
  },
  incomeAmount: {
    color: Colors.blue,
  },
});
