import { describe, expect, it } from 'vitest';
import {
  applyTransactionToWalletBalances,
  calculateWalletBalanceAfterTransaction,
  getTransactionWalletDeltas,
} from '../src/domain/finance';
import type { Transaction, Wallet } from '../src/services/database';

const baseTransaction: Transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 25,
  category: 'food',
  description: 'Market',
  date: 1_000,
  month: '2026-07',
  currency: 'EUR',
  walletId: 'cash',
};

describe('wallet transaction calculations', () => {
  it('applies expenses and income to the selected wallet', () => {
    expect(getTransactionWalletDeltas(baseTransaction)).toEqual({ cash: -25 });
    expect(getTransactionWalletDeltas({ ...baseTransaction, type: 'income' })).toEqual({ cash: 25 });
  });

  it('applies both sides of a converted transfer', () => {
    const transfer: Transaction = {
      ...baseTransaction,
      type: 'transfer',
      amount: 100,
      walletId: 'eur',
      fromWalletId: 'eur',
      toWalletId: 'uah',
      convertedAmount: 4_950,
    };

    expect(applyTransactionToWalletBalances({ eur: 500, uah: 0 }, transfer)).toEqual({
      eur: 400,
      uah: 4_950,
    });
  });

  it('restores balances exactly after delete and undo', () => {
    const original = { cash: 200 };
    const afterCreate = applyTransactionToWalletBalances(original, baseTransaction);
    const afterDelete = applyTransactionToWalletBalances(afterCreate, baseTransaction, 'reverse');
    const afterUndo = applyTransactionToWalletBalances(afterDelete, baseTransaction);

    expect(afterCreate).toEqual({ cash: 175 });
    expect(afterDelete).toEqual(original);
    expect(afterUndo).toEqual(afterCreate);
  });

  it('ignores transactions explicitly excluded from balances', () => {
    expect(getTransactionWalletDeltas({ ...baseTransaction, excludeFromBalance: true })).toEqual({});
  });

  it('calculates the historical wallet balance after a transaction', () => {
    const wallet: Wallet = {
      id: 'cash',
      name: 'Cash',
      currency: 'EUR',
      balance: 140,
      createdAt: 0,
    };
    const laterExpense = { ...baseTransaction, id: 'tx-2', amount: 40, date: 2_000 };

    expect(calculateWalletBalanceAfterTransaction(wallet, baseTransaction, [
      baseTransaction,
      laterExpense,
    ])).toBe(180);
  });
});
