// Currency hook — adapted from web version
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { subscribeToSettings, type UserSettings } from '../services/database';

export type Currency = 'EUR' | 'USD' | 'UAH';

// Fixed Exchange Rates (Base: EUR) — identical to web
const EXCHANGE_RATES: Record<Currency, number> = {
  EUR: 1.0,
  USD: 1.08,
  UAH: 42.0,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  UAH: '₴',
};

export const useCurrency = () => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [walletNames, setWalletNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToSettings(user.id, (settings: UserSettings | null) => {
      setCurrency((settings?.currency as Currency) || 'EUR');
      setWalletNames(settings?.walletNames || {});
    });

    return () => unsubscribe();
  }, [user]);

  const toTarget = useCallback((amountInEur: number, targetCurr: Currency) => {
    return amountInEur * EXCHANGE_RATES[targetCurr];
  }, []);

  const toBase = useCallback((amount: number, fromCurr: Currency) => {
    return amount / EXCHANGE_RATES[fromCurr];
  }, []);

  const convertToMain = useCallback((amount: number, fromCurr: Currency) => {
    const inEur = toBase(amount, fromCurr);
    return toTarget(inEur, currency);
  }, [currency, toBase, toTarget]);

  const formatValue = useCallback((amount: number, curr: Currency = currency, includeSymbol: boolean = true) => {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (includeSymbol) return `${formatted} ${CURRENCY_SYMBOLS[curr]}`;
    return formatted;
  }, [currency]);

  const formatAmount = useCallback((amountInEur: number, targetCurrency: Currency = currency, includeSymbol: boolean = true) => {
    const converted = toTarget(amountInEur, targetCurrency);
    return formatValue(converted, targetCurrency, includeSymbol);
  }, [toTarget, formatValue, currency]);

  return {
    currency,
    walletNames,
    convertToMain,
    formatValue,
    formatAmount,
    EXCHANGE_RATES,
    CURRENCY_SYMBOLS
  };
};
