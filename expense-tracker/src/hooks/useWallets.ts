import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToWallets, addWallet, updateWallet, deleteWallet, type Wallet } from '../services/database';
import { type Currency } from './useCurrency';

const FALLBACK_RATES: Record<string, number> = { EUR: 1.0, USD: 1.08, UAH: 44.0 };

function loadRates(): Record<string, number> {
  try {
    const d = localStorage.getItem('nbu_rates_v2');
    if (d) return JSON.parse(d);
  } catch {}
  return FALLBACK_RATES;
}

export function useWallets() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToWallets(user.id, (ws) => {
      setWallets(ws);
      setIsLoaded(true);
    });
    return () => unsub();
  }, [user]);

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
      if (!user) return;
      await addWallet(user.id, { name, currency, balance, createdAt: Date.now() });
    },
    [user]
  );

  const renameWallet = useCallback(
    async (walletId: string, name: string) => {
      if (!user) return;
      await updateWallet(user.id, walletId, { name });
    },
    [user]
  );

  const removeWallet = useCallback(
    async (walletId: string) => {
      if (!user) return;
      await deleteWallet(user.id, walletId);
    },
    [user]
  );

  const adjustBalance = useCallback(
    async (walletId: string, newBalance: number) => {
      if (!user) return;
      await updateWallet(user.id, walletId, { balance: newBalance });
    },
    [user]
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
