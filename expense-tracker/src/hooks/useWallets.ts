import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { useFamilyBudget } from '../context/useFamilyBudget';
import { subscribeToWallets, addWallet, updateWallet, deleteWallet, type Wallet } from '../services/database';
import { type Currency } from './useCurrency';

// Must match FALLBACK_RATES in useCurrency.ts to avoid calculation mismatches
const FALLBACK_RATES: Record<string, number> = { EUR: 1.0, USD: 1.12, UAH: 49.5 };

function loadRates(): Record<string, number> {
  try {
    const d = localStorage.getItem('nbu_rates_v2');
    if (d) return JSON.parse(d);
  } catch {
    return FALLBACK_RATES;
  }
  return FALLBACK_RATES;
}

export function useWallets() {
  const { user } = useAuth();
  const { dataOwnerId } = useFamilyBudget();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user || !dataOwnerId) return;
    const timeoutId = window.setTimeout(() => {
      console.warn('Wallet subscription timed out; continuing with empty wallets.');
      setIsLoaded(true);
    }, 8000);

    const unsub = subscribeToWallets(dataOwnerId, (ws) => {
      window.clearTimeout(timeoutId);
      setWallets(ws);
      setIsLoaded(true);
    }, (error) => {
      window.clearTimeout(timeoutId);
      console.error('Wallet subscription failed:', error);
      setWallets([]);
      setIsLoaded(true);
    });
    return () => {
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, [user, dataOwnerId]);

  // Total balance in EUR (base currency)
  const totalInBase = useCallback((): number => {
    const rates = loadRates();
    return wallets.reduce((sum, w) => {
      const rate = rates[w.currency] ?? 1;
      return sum + (w.balance || 0) / rate;
    }, 0);
  }, [wallets]);

  // Convert wallet balance to a target currency
  const walletBalanceInCurrency = useCallback(
    (wallet: Wallet, targetCurrency: Currency): number => {
      const rates = loadRates();
      const inBase = (wallet.balance || 0) / (rates[wallet.currency] ?? 1);
      return inBase * (rates[targetCurrency] ?? 1);
    },
    []
  );

  const createWallet = useCallback(
    async (name: string, currency: string, balance: number) => {
      if (!user || !dataOwnerId) return;
      await addWallet(dataOwnerId, { name, currency, balance, createdAt: Date.now() });
    },
    [user, dataOwnerId]
  );

  const renameWallet = useCallback(
    async (walletId: string, name: string) => {
      if (!user || !dataOwnerId) return;
      await updateWallet(dataOwnerId, walletId, { name });
    },
    [user, dataOwnerId]
  );

  const removeWallet = useCallback(
    async (walletId: string) => {
      if (!user || !dataOwnerId) return;
      await deleteWallet(dataOwnerId, walletId);
    },
    [user, dataOwnerId]
  );

  const adjustBalance = useCallback(
    async (walletId: string, newBalance: number) => {
      if (!user || !dataOwnerId) return;
      await updateWallet(dataOwnerId, walletId, { balance: newBalance });
    },
    [user, dataOwnerId]
  );

  return {
    wallets,
    isLoaded,
    totalInBase,
    walletBalanceInCurrency,
    createWallet,
    renameWallet,
    removeWallet,
    adjustBalance,
  };
}
