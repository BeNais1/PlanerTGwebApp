import type { Transaction, Wallet } from '../services/database';

export function getTransactionWalletDeltas(transaction: Transaction): Record<string, number> {
  if (transaction.excludeFromBalance) return {};

  if (transaction.type === 'transfer') {
    const deltas: Record<string, number> = {};
    if (transaction.fromWalletId) deltas[transaction.fromWalletId] = -transaction.amount;
    if (transaction.toWalletId) {
      deltas[transaction.toWalletId] = (deltas[transaction.toWalletId] || 0)
        + (transaction.convertedAmount ?? transaction.amount);
    }
    return deltas;
  }

  if (!transaction.walletId) return {};
  return {
    [transaction.walletId]: transaction.type === 'income' ? transaction.amount : -transaction.amount,
  };
}

export function applyTransactionToWalletBalances(
  balances: Record<string, number>,
  transaction: Transaction,
  direction: 'apply' | 'reverse' = 'apply',
): Record<string, number> {
  const multiplier = direction === 'apply' ? 1 : -1;
  const next = { ...balances };
  Object.entries(getTransactionWalletDeltas(transaction)).forEach(([walletId, delta]) => {
    next[walletId] = (next[walletId] || 0) + delta * multiplier;
  });
  return next;
}

export function calculateWalletBalanceAfterTransaction(
  wallet: Wallet,
  targetTransaction: Transaction,
  allTransactions: Transaction[],
): number | null {
  if (!wallet.id || !targetTransaction.id || !Number.isFinite(wallet.balance)) return null;

  const laterDelta = allTransactions.reduce((sum, transaction) => {
    if (!transaction.id || transaction.id === targetTransaction.id) return sum;
    const isLater = transaction.date > targetTransaction.date
      || (
        transaction.date === targetTransaction.date
        && transaction.id.localeCompare(targetTransaction.id!) > 0
      );
    return isLater
      ? sum + (getTransactionWalletDeltas(transaction)[wallet.id!] || 0)
      : sum;
  }, 0);

  return wallet.balance - laterDelta;
}
