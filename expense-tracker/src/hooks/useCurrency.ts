import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useFamilyBudget } from '../context/useFamilyBudget';
import { subscribeToSettings, type UserSettings } from '../services/database';
import { convertCurrency } from '../domain/currency';

export type Currency = 'EUR' | 'USD' | 'UAH';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  UAH: '₴',
};

// Fallback rates (base: EUR). 1 EUR = USD_rate USD = UAH_rate UAH
// Updated: 2026-05 (1 USD ≈ 44.2 UAH, 1 EUR ≈ 1.12 USD → 1 EUR ≈ 49.5 UAH)
const FALLBACK_RATES: Record<Currency, number> = {
  EUR: 1.0,
  USD: 1.12,
  UAH: 49.5,
};

const CACHE_KEY = 'nbu_rates_v2'; // bumped to clear old stale cache
const CACHE_TIME_KEY = 'nbu_rates_time_v2';
const CACHE_TTL = 3_600_000; // 1 hour

function loadCachedRates(): Record<Currency, number> | null {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    const time = localStorage.getItem(CACHE_TIME_KEY);
    if (data && time && Date.now() - parseInt(time) < CACHE_TTL) {
      return JSON.parse(data);
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchNBURates(): Promise<Record<Currency, number>> {
  const cached = loadCachedRates();
  if (cached) return cached;

  try {
    const res = await fetch(
      'https://bank.gov.ua/NBUStatService/v1/statdatarows/exchange?json',
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data: Array<{ cc: string; rate: number }> = await res.json();

    // NBU rate = how many UAH for 1 unit of foreign currency
    const usdRate = data.find(e => e.cc === 'USD')?.rate;
    const eurRate = data.find(e => e.cc === 'EUR')?.rate;
    if (!usdRate || !eurRate) throw new Error('Missing USD or EUR in NBU response');

    // Store EUR-based rates: EUR=1, USD = how many USD per 1 EUR, UAH = how many UAH per 1 EUR
    const rates: Record<Currency, number> = {
      EUR: 1.0,
      USD: eurRate / usdRate,
      UAH: eurRate,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    console.log(`[NBU] rates updated: 1 USD = ${(eurRate/usdRate > 0 ? usdRate : 0).toFixed(2)} UAH, 1 EUR = ${eurRate.toFixed(2)} UAH`);
    return rates;
  } catch (err) {
    console.warn('[NBU] fetch failed, using fallback rates:', err);
    return FALLBACK_RATES;
  }
}

export const useCurrency = () => {
  const { user } = useAuth();
  const { dataOwnerId } = useFamilyBudget();
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [mainWalletId, setMainWalletId] = useState<string | null>(null);
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
    if (!user || !dataOwnerId) return;
    const unsubscribe = subscribeToSettings(dataOwnerId, (settings: UserSettings | null) => {
      setCurrency((settings?.currency as Currency) || 'EUR');
      setMainWalletId(settings?.mainWalletId || null);
      setWalletNames(settings?.walletNames || {});
    });
    return () => unsubscribe();
  }, [user, dataOwnerId]);

  const toTarget = useCallback((amountInEur: number, targetCurr: Currency) => {
    return amountInEur * exchangeRates[targetCurr];
  }, [exchangeRates]);

  const convertToMain = useCallback((amount: number, fromCurr: Currency) => {
    return convertCurrency(amount, fromCurr, currency, exchangeRates);
  }, [currency, exchangeRates]);

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
    mainWalletId,
    walletNames,
    convertToMain,
    formatValue,
    formatAmount,
    EXCHANGE_RATES: exchangeRates,
    CURRENCY_SYMBOLS,
  };
};
