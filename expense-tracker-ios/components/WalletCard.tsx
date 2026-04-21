// Wallet card component for settings
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius } from '../constants/Theme';
import type { Currency } from '../hooks/useCurrency';

interface WalletCardProps {
  currency: Currency;
  balance: number;
  displayName: string;
  isMain: boolean;
  currencySymbols: Record<Currency, string>;
  onMakeMain: () => void;
  onDelete: () => void;
  exchangeRates: Record<Currency, number>;
}

const ALL_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

export const WalletCard = ({
  currency,
  balance,
  displayName,
  isMain,
  currencySymbols,
  onMakeMain,
  onDelete,
  exchangeRates,
}: WalletCardProps) => {
  const otherCurrencies = ALL_CURRENCIES.filter(c => c !== currency);

  const convertDirect = (amount: number, from: Currency, to: Currency) => {
    const inEur = amount / exchangeRates[from];
    return inEur * exchangeRates[to];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.displayName}>{displayName}</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.balance}>
        {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbols[currency]}
      </Text>

      <View style={styles.footer}>
        <View style={styles.conversions}>
          {otherCurrencies.map(otherC => (
            <Text key={otherC} style={styles.conversion}>
              ≈ {convertDirect(balance, currency, otherC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbols[otherC]}
            </Text>
          ))}
        </View>
        {isMain ? (
          <View style={styles.mainBadge}>
            <Text style={styles.mainBadgeText}>⭐️ Головний</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={onMakeMain}>
            <Text style={styles.makeMainBtn}>Зробити головним</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  displayName: {
    color: Colors.textOnDarkSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  deleteBtn: {
    color: Colors.textOnDarkTertiary,
    fontSize: 16,
    padding: 4,
  },
  balance: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  conversions: {
    flexDirection: 'row',
    gap: 12,
  },
  conversion: {
    color: Colors.textOnDarkSecondary,
    fontSize: 14,
  },
  mainBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  mainBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  makeMainBtn: {
    color: Colors.blue,
    fontSize: 13,
    fontWeight: '600',
  },
});
