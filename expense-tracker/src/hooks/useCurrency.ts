import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToSettings, type UserSettings } from '../services/database';

export type Currency = 'EUR' | 'USD' | 'UAH';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  UAH: '₴',
};

// Fallback rates (base: EUR) used until NBU responds
const FALLBACK_RATES: Record<Currency, number> = {
  EUR: 1.0,
  USD: 1.08,
  UAH: 44.0,
};

const CACHE_KEY = 'nbu_rates';
const CACHE_TIME_KEY = 'nbu_rates_time';
const CACHE_TTL = 3_600_000; // 1 hour

function loadCachedRates(): Record<Currency, number> | null {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    const time = localStorage.getItem(CACHE_TIME_KEY);
    if (data && time && Date.now() - parseInt(time) < CACHE_TTL) {
      return JSON.parse(data);
    }
  } catch {}
  return null;
}

async function fetchNBURates(): Promise<Record<Currency, number>> {
  const cached = loadCachedRates();
  if (cached) return cached;

  try {
    const res = await fetch(
      'https://bank.gov.ua/NBUStatService/v1/statdatarows/exchange?json',
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data: Array<{ cc: string; rate: number }> = await res.json();

    // NBU rate = how many UAH for 1 unit of foreign currency
    const usdRate = data.find(e => e.cc === 'USD')?.rate;
    const eurRate = data.find(e => e.cc === 'EUR')?.rate;
    if (!usdRate || !eurRate) throw new Error('Missing USD or EUR in NBU response');

    // Convert to EUR-based rates so existing conversion logic stays unchanged
    // 1 EUR = (eurRate / usdRate) USD
    // 1 EUR = eurRate UAH
    const rates: Record<Currency, number> = {
      EUR: 1.0,
      USD: eurRate / usdRate,
      UAH: eurRate,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    return rates;
  } catch (err) {
    console.warn('NBU fetch failed, using fallback rates:', err);
    return FALLBACK_RATES;
  }
}

export const useCurrency = () => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [walletNames, setWalletNames] = useState<Record<string, string>>({});
  // Init synchronously from cache so first render already has real rates
  const [exchangeRates, setExchangeRates] = useState<Record<Currency, number>>(
    () => loadCachedRates() ?? FALLBACK_RATES
  );

  // Fetch fresh rates on mount (no-op if cache is still valid)
  useEffect(() => {
    fetchNBURates().then(setExchangeRates);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToSettings(user.id, (settings: UserSettings | null) => {
      setCurrency((settings?.currency as Currency) || 'EUR');
      setWalletNames(settings?.walletNames || {});
    });
    return () => unsubscribe();
  }, [user]);

  const toBase = useCallback((amount: number, fromCurr: Currency) => {
    return amount / exchangeRates[fromCurr];
  }, [exchangeRates]);

  const toTarget = useCallback((amountInEur: number, targetCurr: Currency) => {
    return amountInEur * exchangeRates[targetCurr];
  }, [exchangeRates]);

  const convertToMain = useCallback((amount: number, fromCurr: Currency) => {
    return toTarget(toBase(amount, fromCurr), currency);
  }, [currency, toBase, toTarget]);

  const formatValue = useCallback((amount: number, curr: Currency = currency, includeSymbol = true) => {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return includeSymbol ? `${formatted} ${CURRENCY_SYMBOLS[curr]}` : formatted;
  }, [currency]);

  const formatAmount = useCallback((amountInEur: number, targetCurrency: Currency = currency, includeSymbol = true) => {
    return formatValue(toTarget(amountInEur, targetCurrency), targetCurrency, includeSymbol);
  }, [toTarget, formatValue, currency]);

  return {
    currency,
    walletNames,
    convertToMain,
    formatValue,
    formatAmount,
    EXCHANGE_RATES: exchangeRates,
    CURRENCY_SYMBOLS,
  };
};
