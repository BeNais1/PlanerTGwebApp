import { database } from '../config/firebase';
import {
  ref,
  set,
  get,
  push,
  remove,
  onValue,
  update,
  query,
  orderByChild,
  equalTo,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import type { Category } from '../config/categories';

// ====== Types ======

export interface UserData {
  firstName: string;
  lastName: string;
  username: string;
  registeredAt: number;
}

export const ADMIN_TELEGRAM_ID = 7801680802;

export const ACTIVE_SESSION_STALE_MS = 45000;

const TRANSACTIONS_CHANGED_EVENT = 'expense-tracker:transactions-changed';

function notifyTransactionsChanged(userId: number | string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT, {
    detail: { userId: String(userId) },
  }));
}

export function onTransactionsChanged(userId: number | string, callback: () => void): Unsubscribe {
  if (typeof window === 'undefined') return () => {};
  const targetUserId = String(userId);
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ userId?: string }>).detail;
    if (detail?.userId === targetUserId) callback();
  };

  window.addEventListener(TRANSACTIONS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, handler);
}

export interface ActiveSession {
  deviceId: string;
  sessionId: string;
  deviceName: string;
  claimedAt: number;
  lastSeenAt: number;
}

export interface AdminStats {
  userCount: number;
  usersWithWallets: number;
  walletCount: number;
  transactionCount: number;
  totalCapitalByCurrency: Record<string, number>;
  totalSpentByCurrency: Record<string, number>;
  spentTodayByCurrency: Record<string, number>;
  spentThisMonthByCurrency: Record<string, number>;
  lastExpenseAt: number | null;
  receivedAt: number;
}

export interface Wallet {
  id?: string;
  name: string;
  currency: string; // 'EUR' | 'USD' | 'UAH'
  balance: number;
  createdAt: number;
}

export interface Transaction {
  id?: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category: string;
  description: string;
  date: number;
  month: string; // "YYYY-MM"
  currency?: string;
  walletId?: string;           // source wallet
  fromWalletId?: string;       // transfer: source
  toWalletId?: string;         // transfer: destination
  convertedAmount?: number;    // transfer: amount in destination currency
  jointCheckId?: string;
  isJointCheck?: boolean;
  excludeFromBalance?: boolean;
}

export interface MonthData {
  initialBalance?: number; // legacy
  balances?: Record<string, number>; // Currency code -> amount
}

export interface Subscription {
  id?: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  icon: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDate: number; // timestamp of next charge
  time?: string; // "HH:mm" — hour of day for the charge
  walletId?: string; // wallet currency key (e.g. "EUR")
  createdAt: number;
  isActive: boolean;
}

export interface SmartGoal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  currency: string;
  dueDate?: number;
  category?: string;
  createdAt: number;
}

export interface DebtItem {
  id: string;
  person: string;
  amount: number;
  currency: string;
  direction: 'owed_to_me' | 'i_owe';
  dueDate?: number;
  note?: string;
  isPaid: boolean;
  createdAt: number;
}

export interface CustomVendor {
  id: string;
  name: string;
  category: string;
  icon: string;
}

export interface OnboardingData {
  gender: 'male' | 'female';
  ageGroup: '<18' | '18+' | '25+' | '50+';
  married: boolean;
  pets: ('cat' | 'dog')[];
  theme: 'dark' | 'light';
}

export interface UserSettings {
  currency?: string;
  mainWalletId?: string;
  walletNames?: Record<string, string>;
  customCategories?: Category[];
  hiddenCategories?: string[];
  customVendors?: CustomVendor[];
  vendorUsageCounts?: Record<string, number>; // vendorId -> usage count
  budgetLimit?: number; // Spending limit in main currency
  budgetLimitPeriod?: 'day' | 'week' | 'month'; // the period for the limit
  budgetLimitIncludePrior?: boolean; // Whether to count expenses made before limit was set
  budgetLimitStartDate?: number | null; // Timestamp when limit was set (if not including prior)
  onboardingCompleted?: boolean;
  onboarding?: OnboardingData;
  theme?: 'dark' | 'light';
  smartGoals?: SmartGoal[];
  debts?: DebtItem[];
  monthlyPlanAmount?: number;
  monthlyPlanCurrency?: string;
  categoryOrder?: string[];
}

// Legacy — kept for backward compat with old deep links
export interface SharedReceipt {
  id: string;
  creatorId: string;
  transaction: Transaction;
  createdAt: number;
  allowSave?: boolean;
}

// ====== New Receipt Sharing System ======

export type PrivacyMode = 'public' | 'anonymous';

export interface ReceiptAmountChange {
  id?: string;
  changedAt: number;
  oldAmount: number;
  newAmount: number;
  oldCurrency?: string;
  newCurrency?: string;
}

export interface ReceiptShare {
  id: string;               // === shareCode
  receiptId: string;        // transaction.id
  ownerId: string;
  shareCode: string;        // 8-char code
  isActive: boolean;
  privacyMode: PrivacyMode;
  transaction: Transaction;  // snapshot at creation time
  ownerName?: string | null;       // shown if privacyMode === 'public'
  ownerUsername?: string | null;
  createdAt: number;
  updatedAt: number;
  amountHistory?: Record<string, ReceiptAmountChange> | ReceiptAmountChange[];
}

export interface SavedSharedReceipt {
  id: string;               // === shareCode
  userId: string;
  shareCode: string;
  receiptId: string;
  ownerId: string;
  savedAt: number;
}

export interface ReceiptSaver {
  userId: string;
  displayName: string;
  savedAt: number;
}

export interface JointCheckParticipant {
  userId: string;
  displayName: string;
  username?: string;
  addedAt: number;
}

export interface JointCheckPayment {
  id?: string;
  userId: string;
  displayName: string;
  amount: number;
  paidAt: number;
}

export interface JointCheck {
  id: string;
  creatorId: string;
  totalAmount: number;
  remainingAmount: number;
  currency: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isClosed: boolean;
  participants: Record<string, JointCheckParticipant>;
  payments?: Record<string, JointCheckPayment>;
  transactionIds?: Record<string, string>;
}

export interface TemporaryUserCode {
  code: string;
  userId: string;
  displayName: string;
  username?: string;
  expiresAt: number;
  createdAt: number;
}

// ====== Helpers ======

export function getCurrentMonth(date: number | Date = new Date()): string {
  const now = date instanceof Date ? date : new Date(date);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export const SHARE_CODE_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
const TELEGRAM_USER_ID_PATTERN = /^\d{1,20}$/;
const SHARE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function isValidShareCode(value: unknown): value is string {
  return typeof value === 'string' && SHARE_CODE_PATTERN.test(value);
}

export function isValidTelegramUserId(value: unknown): boolean {
  return (typeof value === 'string' || typeof value === 'number')
    ? TELEGRAM_USER_ID_PATTERN.test(String(value))
    : false;
}

function getSecureRandomIndex(maxExclusive: number): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generator is unavailable.');
  }

  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buffer = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(buffer);
  } while (buffer[0] >= limit);

  return buffer[0] % maxExclusive;
}

// ====== User Operations ======

export async function registerUser(
  userId: number,
  firstName: string,
  lastName: string,
  username: string
): Promise<void> {
  const userRef = ref(database, `users/${userId}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    await set(userRef, {
      firstName,
      lastName,
      username,
      registeredAt: Date.now(),
    });
  }
}

export async function getUserData(userId: number): Promise<UserData | null> {
  const userRef = ref(database, `users/${userId}`);
  const snapshot = await get(userRef);
  return snapshot.exists() ? (snapshot.val() as UserData) : null;
}

// ====== Active Device Session ======

export function subscribeToActiveSession(
  userId: number,
  callback: (session: ActiveSession | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const sessionRef = ref(database, `users/${userId}/activeSession`);
  return onValue(sessionRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as ActiveSession) : null);
  }, onError);
}

export async function claimActiveSession(
  userId: number,
  nextSession: ActiveSession,
  force = false
): Promise<ActiveSession | null> {
  const sessionRef = ref(database, `users/${userId}/activeSession`);
  const result = await runTransaction(sessionRef, (current: ActiveSession | null) => {
    const isMine = current?.deviceId === nextSession.deviceId;
    const isStale = !current || Date.now() - (current.lastSeenAt || 0) > ACTIVE_SESSION_STALE_MS;

    if (!current || isMine || isStale || force) {
      return nextSession;
    }

    return;
  });

  return result.committed && result.snapshot.exists()
    ? (result.snapshot.val() as ActiveSession)
    : null;
}

export async function updateActiveSessionHeartbeat(
  userId: number,
  deviceId: string,
  sessionId: string
): Promise<void> {
  const sessionRef = ref(database, `users/${userId}/activeSession`);
  await runTransaction(sessionRef, (current: ActiveSession | null) => {
    if (!current || current.deviceId !== deviceId || current.sessionId !== sessionId) {
      return;
    }

    return {
      ...current,
      lastSeenAt: Date.now(),
    };
  });
}

export async function releaseActiveSession(
  userId: number,
  deviceId: string,
  sessionId: string
): Promise<void> {
  const sessionRef = ref(database, `users/${userId}/activeSession`);
  await runTransaction(sessionRef, (current: ActiveSession | null) => {
    if (!current || current.deviceId !== deviceId || current.sessionId !== sessionId) {
      return;
    }

    return null;
  });
}

// ====== Admin Dashboard ======

interface AdminStoredUser {
  wallets?: Record<string, Partial<Wallet>>;
  transactions?: Record<string, Partial<Transaction>>;
}

function addCurrencyTotal(target: Record<string, number>, currency: string, amount: number) {
  target[currency] = (target[currency] || 0) + amount;
}

export function subscribeToAdminStats(
  requestingUserId: number,
  callback: (stats: AdminStats) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (requestingUserId !== ADMIN_TELEGRAM_ID) {
    onError?.(new Error('Admin access denied'));
    return () => undefined;
  }

  return onValue(ref(database, 'users'), (snapshot) => {
    const users = snapshot.exists()
      ? snapshot.val() as Record<string, AdminStoredUser>
      : {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const stats: AdminStats = {
      userCount: Object.keys(users).length,
      usersWithWallets: 0,
      walletCount: 0,
      transactionCount: 0,
      totalCapitalByCurrency: {},
      totalSpentByCurrency: {},
      spentTodayByCurrency: {},
      spentThisMonthByCurrency: {},
      lastExpenseAt: null,
      receivedAt: Date.now(),
    };

    Object.values(users).forEach((storedUser) => {
      const wallets = Object.values(storedUser.wallets || {});
      if (wallets.length > 0) stats.usersWithWallets += 1;
      stats.walletCount += wallets.length;

      wallets.forEach((wallet) => {
        if (typeof wallet.balance !== 'number') return;
        addCurrencyTotal(stats.totalCapitalByCurrency, wallet.currency || 'EUR', wallet.balance);
      });

      Object.values(storedUser.transactions || {}).forEach((transaction) => {
        stats.transactionCount += 1;
        if (
          transaction.type !== 'expense'
          || transaction.excludeFromBalance === true
          || typeof transaction.amount !== 'number'
        ) return;

        const currency = transaction.currency || 'EUR';
        addCurrencyTotal(stats.totalSpentByCurrency, currency, transaction.amount);

        if (typeof transaction.date === 'number') {
          if (transaction.date >= monthStart) {
            addCurrencyTotal(stats.spentThisMonthByCurrency, currency, transaction.amount);
          }
          if (transaction.date >= todayStart) {
            addCurrencyTotal(stats.spentTodayByCurrency, currency, transaction.amount);
          }
          if (stats.lastExpenseAt === null || transaction.date > stats.lastExpenseAt) {
            stats.lastExpenseAt = transaction.date;
          }
        }
      });
    });

    callback(stats);
  }, (error) => onError?.(error));
}

// ====== Monthly Balance ======

export async function setMonthlyBalance(
  userId: number,
  month: string,
  amount: number,
  currency: string = 'EUR'
): Promise<void> {
  const monthRef = ref(database, `users/${userId}/months/${month}`);
  const snapshot = await get(monthRef);
  
  let currentData: MonthData = {};
  if (snapshot.exists()) {
    currentData = snapshot.val() as MonthData;
  }
  
  const balances = currentData.balances || {};
  balances[currency] = amount;
  
  await set(monthRef, { ...currentData, balances });
}

export async function addWalletBalance(
  userId: number,
  month: string,
  currency: string,
  amount: number
): Promise<void> {
  await setMonthlyBalance(userId, month, amount, currency);
}

export async function deleteWalletData(
  userId: number,
  month: string,
  currency: string
): Promise<void> {
  const { update } = await import('firebase/database');
  
  // 1. Remove from month balances
  const monthRef = ref(database, `users/${userId}/months/${month}`);
  const monthSnap = await get(monthRef);
  if (monthSnap.exists()) {
    const data = monthSnap.val() as MonthData;
    let changed = false;
    if (currency === 'EUR' && data.initialBalance) {
      data.initialBalance = 0;
      changed = true;
    }
    if (data.balances && data.balances[currency] !== undefined) {
      delete data.balances[currency];
      changed = true;
    }
    if (changed) await set(monthRef, data);
  }

  // 2. Remove transactions with that currency in this month
  const txRef = ref(database, `users/${userId}/transactions`);
  const txQuery = query(txRef, orderByChild('month'), equalTo(month));
  const txSnap = await get(txQuery);
  if (txSnap.exists()) {
    const txData = txSnap.val();
    const updates: Record<string, any> = {};
    Object.entries(txData).forEach(([id, tx]: [string, any]) => {
      const txCur = tx.currency || 'EUR';
      if (txCur === currency) {
        updates[id] = null;
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(txRef, updates);
    }
  }

  // 3. Remove wallet name
  const settingsRef = ref(database, `users/${userId}/settings`);
  const setSnap = await get(settingsRef);
  if (setSnap.exists()) {
    const settings = setSnap.val() as UserSettings;
    if (settings.walletNames && settings.walletNames[currency]) {
      const newSettings = { ...settings };
      if (newSettings.walletNames) {
        delete newSettings.walletNames[currency];
      }
      await set(settingsRef, newSettings);
    }
  }
}

export async function getMonthlyBalance(
  userId: number,
  month: string
): Promise<MonthData | null> {
  const monthRef = ref(database, `users/${userId}/months/${month}`);
  const snapshot = await get(monthRef);
  if (snapshot.exists()) {
    return snapshot.val() as MonthData;
  }
  return null;
}

// ====== Wallets ======

export async function addWallet(
  userId: number,
  wallet: Omit<Wallet, 'id'>
): Promise<string> {
  const walletsRef = ref(database, `users/${userId}/wallets`);
  const newRef = push(walletsRef);
  await set(newRef, wallet);
  return newRef.key!;
}

export async function updateWallet(
  userId: number,
  walletId: string,
  data: Partial<Omit<Wallet, 'id'>>
): Promise<void> {
  const walletRef = ref(database, `users/${userId}/wallets/${walletId}`);
  await update(walletRef, data);
}

export async function deleteWallet(
  userId: number,
  walletId: string
): Promise<void> {
  const walletRef = ref(database, `users/${userId}/wallets/${walletId}`);
  await remove(walletRef);
}

export function subscribeToWallets(
  userId: number,
  callback: (wallets: Wallet[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const walletsRef = ref(database, `users/${userId}/wallets`);
  return onValue(walletsRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const data = snapshot.val();
    const wallets: Wallet[] = Object.entries(data).map(([id, w]) => ({
      id,
      ...(w as Omit<Wallet, 'id'>),
    }));
    wallets.sort((a, b) => a.createdAt - b.createdAt);
    callback(wallets);
  }, onError);
}

export async function getWallets(userId: number): Promise<Wallet[]> {
  const walletsRef = ref(database, `users/${userId}/wallets`);
  const snap = await get(walletsRef);
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .map(([id, w]) => ({ id, ...(w as Omit<Wallet, 'id'>) }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ====== Transactions ======

async function adjustWalletBalance(
  userId: number,
  walletId: string,
  delta: number,
  updates: Record<string, unknown>
): Promise<void> {
  const walletSnap = await get(ref(database, `users/${userId}/wallets/${walletId}`));
  if (walletSnap.exists()) {
    const wallet = walletSnap.val() as Wallet;
    updates[`users/${userId}/wallets/${walletId}/balance`] = (wallet.balance || 0) + delta;
  }
}

export async function addTransaction(
  userId: number,
  transaction: Omit<Transaction, 'id'>
): Promise<string> {
  const txsRef = ref(database, `users/${userId}/transactions`);
  const newRef = push(txsRef);
  const txToSave = transaction.currency ? transaction : { ...transaction, currency: 'EUR' };

  const updates: Record<string, unknown> = {};
  updates[`users/${userId}/transactions/${newRef.key}`] = txToSave;

  if (transaction.walletId && !transaction.excludeFromBalance && transaction.type !== 'transfer') {
    const delta = transaction.type === 'income' ? transaction.amount : -transaction.amount;
    await adjustWalletBalance(userId, transaction.walletId, delta, updates);
  }

  await update(ref(database), updates);
  notifyTransactionsChanged(userId);
  return newRef.key!;
}

export async function addTransfer(
  userId: number,
  {
    fromWalletId, toWalletId, amount, convertedAmount, description, date,
  }: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    convertedAmount: number;
    description?: string;
    date: number;
  }
): Promise<string> {
  const [fromSnap, toSnap] = await Promise.all([
    get(ref(database, `users/${userId}/wallets/${fromWalletId}`)),
    get(ref(database, `users/${userId}/wallets/${toWalletId}`)),
  ]);
  if (!fromSnap.exists() || !toSnap.exists()) throw new Error('Wallet not found');
  const fromWallet = fromSnap.val() as Wallet;
  const toWallet = toSnap.val() as Wallet;

  const month = new Date(date).toISOString().slice(0, 7);
  const txsRef = ref(database, `users/${userId}/transactions`);
  const newRef = push(txsRef);

  const tx: Omit<Transaction, 'id'> = {
    type: 'transfer',
    amount,
    currency: fromWallet.currency,
    category: 'transfer',
    description: description || `${fromWallet.name} → ${toWallet.name}`,
    date,
    month,
    walletId: fromWalletId,
    fromWalletId,
    toWalletId,
    convertedAmount,
  };

  const updates: Record<string, unknown> = {};
  updates[`users/${userId}/transactions/${newRef.key}`] = tx;
  updates[`users/${userId}/wallets/${fromWalletId}/balance`] = (fromWallet.balance || 0) - amount;
  updates[`users/${userId}/wallets/${toWalletId}/balance`] = (toWallet.balance || 0) + convertedAmount;

  await update(ref(database), updates);
  notifyTransactionsChanged(userId);
  return newRef.key!;
}

export async function getTransactions(
  userId: number,
  month: string
): Promise<Transaction[]> {
  const txRef = ref(database, `users/${userId}/transactions`);
  const txQuery = query(txRef, orderByChild('month'), equalTo(month));
  const snapshot = await get(txQuery);

  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.entries(data).map(([id, tx]) => ({
    id,
    ...(tx as Omit<Transaction, 'id'>),
  }));
}

export async function updateTransaction(
  userId: number,
  txId: string,
  data: Partial<Omit<Transaction, 'id'>>
): Promise<void> {
  const txRef = ref(database, `users/${userId}/transactions/${txId}`);
  const beforeSnap = await get(txRef);
  if (!beforeSnap.exists()) {
    await update(txRef, data);
    notifyTransactionsChanged(userId);
    return;
  }

  const before = { id: txId, ...(beforeSnap.val() as Omit<Transaction, 'id'>) } as Transaction;
  const after: Transaction = { ...before, ...data, id: txId };

  const updates: Record<string, unknown> = {};
  updates[`users/${userId}/transactions/${txId}`] = after;

  // Reverse old balance delta, apply new — only for non-transfer regular transactions
  const isBalanceTx = (tx: Transaction) =>
    tx.type !== 'transfer' && tx.walletId && !tx.excludeFromBalance;

  if (isBalanceTx(before)) {
    const oldDelta = before.type === 'income' ? before.amount : -before.amount;
    const walletSnap = await get(ref(database, `users/${userId}/wallets/${before.walletId!}`));
    if (walletSnap.exists()) {
      const w = walletSnap.val() as Wallet;
      let newBal = (w.balance || 0) - oldDelta; // reverse old
      if (after.walletId === before.walletId && isBalanceTx(after)) {
        const newDelta = after.type === 'income' ? after.amount : -after.amount;
        newBal += newDelta;
      }
      updates[`users/${userId}/wallets/${before.walletId!}/balance`] = newBal;
    }
  }
  // If wallet changed, apply delta to new wallet
  if (isBalanceTx(after) && after.walletId !== before.walletId) {
    const walletSnap = await get(ref(database, `users/${userId}/wallets/${after.walletId!}`));
    if (walletSnap.exists()) {
      const w = walletSnap.val() as Wallet;
      const newDelta = after.type === 'income' ? after.amount : -after.amount;
      updates[`users/${userId}/wallets/${after.walletId!}/balance`] = (w.balance || 0) + newDelta;
    }
  }

  await update(ref(database), updates);
  notifyTransactionsChanged(userId);

  // Sync shared receipt if exists
  try {
    const mappingSnap = await get(ref(database, `user_shares/${String(userId)}/${txId}`));
    if (!mappingSnap.exists()) return;
    const shareCode = mappingSnap.val() as string;
    if (!isValidShareCode(shareCode)) return;
    await update(ref(database, `shared_receipts/${shareCode}`), { transaction: after, updatedAt: Date.now() });
    const oldCur = before.currency || 'EUR';
    const newCur = after.currency || 'EUR';
    if (before.amount !== after.amount || oldCur !== newCur) {
      await set(push(ref(database, `shared_receipts/${shareCode}/amountHistory`)), {
        changedAt: Date.now(), oldAmount: before.amount, newAmount: after.amount,
        oldCurrency: oldCur, newCurrency: newCur,
      } satisfies ReceiptAmountChange);
    }
  } catch (err) {
    console.warn('Failed to sync shared receipt after transaction update:', err);
  }
}

export async function deleteTransaction(
  userId: number,
  txId: string
): Promise<void> {
  const txRef = ref(database, `users/${userId}/transactions/${txId}`);
  const txSnap = await get(txRef);

  const updates: Record<string, unknown> = {};
  updates[`users/${userId}/transactions/${txId}`] = null;

  if (txSnap.exists()) {
    const tx = txSnap.val() as Transaction;
    // Reverse wallet balance
    if (tx.walletId && !tx.excludeFromBalance) {
      if (tx.type !== 'transfer') {
        const wSnap = await get(ref(database, `users/${userId}/wallets/${tx.walletId}`));
        if (wSnap.exists()) {
          const w = wSnap.val() as Wallet;
          const delta = tx.type === 'income' ? -tx.amount : tx.amount; // reverse
          updates[`users/${userId}/wallets/${tx.walletId}/balance`] = (w.balance || 0) + delta;
        }
      } else {
        // Reverse transfer
        const [fromSnap, toSnap] = await Promise.all([
          tx.fromWalletId ? get(ref(database, `users/${userId}/wallets/${tx.fromWalletId}`)) : Promise.resolve(null),
          tx.toWalletId ? get(ref(database, `users/${userId}/wallets/${tx.toWalletId}`)) : Promise.resolve(null),
        ]);
        if (fromSnap?.exists()) {
          const w = fromSnap.val() as Wallet;
          updates[`users/${userId}/wallets/${tx.fromWalletId!}/balance`] = (w.balance || 0) + tx.amount;
        }
        if (toSnap?.exists()) {
          const w = toSnap.val() as Wallet;
          updates[`users/${userId}/wallets/${tx.toWalletId!}/balance`] = (w.balance || 0) - (tx.convertedAmount ?? tx.amount);
        }
      }
    }
  }

  await update(ref(database), updates);
  notifyTransactionsChanged(userId);

  try {
    const mappingRef = ref(database, `user_shares/${userId}/${txId}`);
    const mappingSnap = await get(mappingRef);
    if (mappingSnap.exists()) {
      const shareCode = mappingSnap.val() as string;
      if (!isValidShareCode(shareCode)) return;
      await update(ref(database, `shared_receipts/${shareCode}`), {
        isActive: false, disabledReason: 'receipt_deleted', updatedAt: Date.now(),
      });
      await set(mappingRef, null);
    }
  } catch (err) {
    console.warn('Failed to deactivate share on delete:', err);
  }
}

// ====== Legacy Shared Receipts (backward compat) ======

export async function getSharedReceipt(receiptId: string): Promise<SharedReceipt | null> {
  if (!isValidShareCode(receiptId)) return null;
  const receiptRef = ref(database, `shared_receipts/${receiptId}`);
  const snapshot = await get(receiptRef);
  return snapshot.exists() ? (snapshot.val() as SharedReceipt) : null;
}

// ====== New Receipt Sharing System ======

function generateShareCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += SHARE_CODE_CHARS.charAt(getSecureRandomIndex(SHARE_CODE_CHARS.length));
  }
  return code;
}

function generateTemporaryCode(): string {
  return String(100000 + getSecureRandomIndex(900000));
}

export function getUserQrPayload(userId: string | number, displayName: string, username?: string): string {
  return JSON.stringify({
    type: 'planer_user',
    userId: String(userId),
    displayName,
    username: username || '',
  });
}

export function parseUserQrPayload(rawValue: string): JointCheckParticipant | null {
  try {
    const parsed = JSON.parse(rawValue);
    if (
      parsed?.type !== 'planer_user'
      || !isValidTelegramUserId(parsed.userId)
      || typeof parsed.displayName !== 'string'
      || parsed.displayName.length > 128
    ) return null;

    return {
      userId: String(parsed.userId),
      displayName: String(parsed.displayName),
      username: parsed.username ? String(parsed.username) : undefined,
      addedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function getOrCreateTemporaryUserCode(
  userId: string | number,
  displayName: string,
  username?: string
): Promise<TemporaryUserCode> {
  const userIdStr = String(userId);
  const userCodeRef = ref(database, `user_temp_codes/${userIdStr}`);
  const existingSnap = await get(userCodeRef);
  const now = Date.now();

  if (existingSnap.exists()) {
    const existing = existingSnap.val() as TemporaryUserCode;
    if (existing.expiresAt > now) return existing;
    await remove(ref(database, `temp_codes/${existing.code}`));
  }

  let code = generateTemporaryCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const codeSnap = await get(ref(database, `temp_codes/${code}`));
    if (!codeSnap.exists()) break;
    const existingCode = codeSnap.val() as TemporaryUserCode;
    if (existingCode.expiresAt <= now) {
      await remove(ref(database, `temp_codes/${code}`));
      break;
    }
    code = generateTemporaryCode();
  }

  const tempCode: TemporaryUserCode = {
    code,
    userId: userIdStr,
    displayName,
    username: username || '',
    createdAt: now,
    expiresAt: now + 60 * 60 * 1000,
  };

  await set(userCodeRef, tempCode);
  await set(ref(database, `temp_codes/${code}`), tempCode);
  return tempCode;
}

export async function getParticipantByTemporaryCode(code: string): Promise<JointCheckParticipant | null> {
  const cleanCode = code.replace(/\D/g, '');
  if (cleanCode.length !== 6) return null;

  const codeRef = ref(database, `temp_codes/${cleanCode}`);
  const snapshot = await get(codeRef);
  if (!snapshot.exists()) return null;

  const tempCode = snapshot.val() as TemporaryUserCode;
  if (tempCode.expiresAt <= Date.now()) {
    await remove(codeRef);
    await remove(ref(database, `user_temp_codes/${tempCode.userId}`));
    return null;
  }

  return {
    userId: tempCode.userId,
    displayName: tempCode.displayName,
    username: tempCode.username,
    addedAt: Date.now(),
  };
}

/** Find an existing active share for a transaction via user_shares mapping */
export async function getExistingShare(
  ownerId: string | number,
  transactionId: string
): Promise<ReceiptShare | null> {
  try {
    // Look up shareCode from the user_shares mapping
    const mappingRef = ref(database, `user_shares/${String(ownerId)}/${transactionId}`);
    const mappingSnap = await get(mappingRef);
    if (!mappingSnap.exists()) return null;
    
    const shareCode = mappingSnap.val() as string;
    if (!isValidShareCode(shareCode)) return null;
    // Fetch the actual share data
    const shareRef = ref(database, `shared_receipts/${shareCode}`);
    const shareSnap = await get(shareRef);
    if (!shareSnap.exists()) return null;
    
    return shareSnap.val() as ReceiptShare;
  } catch (err) {
    console.warn('getExistingShare failed:', err);
    return null;
  }
}

/** Create a new share link, or return existing active one */
export async function createReceiptShare(
  userId: string | number,
  transaction: Transaction,
  privacyMode: PrivacyMode,
  displayName?: string,
  username?: string
): Promise<ReceiptShare> {
  // Try to find existing share via mapping
  if (transaction.id) {
    try {
      const existing = await getExistingShare(userId, transaction.id);
      if (existing) {
        if (!isValidShareCode(existing.shareCode)) {
          throw new Error('Invalid existing share code');
        }
        const shareRef = ref(database, `shared_receipts/${existing.shareCode}`);
        // Update privacy mode if changed
        if (existing.privacyMode !== privacyMode) {
          await update(shareRef, {
            privacyMode,
            transaction,
            ownerName: privacyMode === 'public' ? (displayName || '') : null,
            ownerUsername: privacyMode === 'public' ? (username || '') : null,
            updatedAt: Date.now(),
          });
          existing.privacyMode = privacyMode;
          existing.transaction = transaction;
        } else if (JSON.stringify(existing.transaction) !== JSON.stringify(transaction)) {
          await update(shareRef, {
            transaction,
            updatedAt: Date.now(),
          });
          existing.transaction = transaction;
        }
        return existing;
      }
    } catch (err) {
      console.warn('Existing share lookup failed, creating new:', err);
    }
  }
  
  const shareCode = generateShareCode();
  const now = Date.now();
  
  const shareData: ReceiptShare = {
    id: shareCode,
    receiptId: transaction.id || '',
    ownerId: String(userId),
    shareCode,
    isActive: true,
    privacyMode,
    transaction,
    ownerName: privacyMode === 'public' ? (displayName || '') : null,
    ownerUsername: privacyMode === 'public' ? (username || '') : null,
    createdAt: now,
    updatedAt: now,
  };
  
  // Write the share data
  await set(ref(database, `shared_receipts/${shareCode}`), shareData);
  
  // Write the mapping: user_shares/{userId}/{transactionId} → shareCode
  if (transaction.id) {
    await set(ref(database, `user_shares/${String(userId)}/${transaction.id}`), shareCode);
  }
  
  return shareData;
}

/** Get a receipt share by shareCode (validates original transaction still exists) */
export async function getReceiptShare(shareCode: string): Promise<ReceiptShare | null> {
  if (!isValidShareCode(shareCode)) return null;
  const shareRef = ref(database, `shared_receipts/${shareCode}`);
  const snapshot = await get(shareRef);
  if (!snapshot.exists()) return null;
  
  const share = snapshot.val() as ReceiptShare;
  
  // Variant A: validate original transaction still exists
  if (share.isActive && share.ownerId && share.receiptId) {
    try {
      const txRef = ref(database, `users/${share.ownerId}/transactions/${share.receiptId}`);
      const txSnap = await get(txRef);
      if (!txSnap.exists()) {
        // Transaction was deleted — auto-deactivate
        await update(shareRef, {
          isActive: false,
          disabledReason: 'receipt_deleted',
          updatedAt: Date.now(),
        });
        share.isActive = false;
      } else {
        const liveTransaction = {
          id: share.receiptId,
          ...(txSnap.val() as Omit<Transaction, 'id'>),
        } as Transaction;
        const oldCurrency = share.transaction?.currency || 'EUR';
        const newCurrency = liveTransaction.currency || 'EUR';
        const amountChanged =
          share.transaction &&
          (share.transaction.amount !== liveTransaction.amount || oldCurrency !== newCurrency);

        if (JSON.stringify(share.transaction) !== JSON.stringify(liveTransaction)) {
          await update(shareRef, {
            transaction: liveTransaction,
            updatedAt: Date.now(),
          });
          if (amountChanged) {
            const historyRef = push(ref(database, `shared_receipts/${share.shareCode}/amountHistory`));
            const change: ReceiptAmountChange = {
              changedAt: Date.now(),
              oldAmount: share.transaction.amount,
              newAmount: liveTransaction.amount,
              oldCurrency,
              newCurrency,
            };
            await set(historyRef, change);
            share.amountHistory = {
              ...(Array.isArray(share.amountHistory) ? {} : share.amountHistory || {}),
              [historyRef.key || String(change.changedAt)]: change,
            };
          }
          share.transaction = liveTransaction;
          share.updatedAt = Date.now();
        }
      }
    } catch (err) {
      // If we can't verify, still return the share (snapshot data exists)
      console.warn('Could not verify transaction existence:', err);
    }
  }
  
  return share;
}

/** Quick status check for TransactionDetailModal (no heavy validation) */
export async function getShareStatus(
  userId: string | number,
  transactionId: string
): Promise<{ exists: boolean; isActive: boolean; privacyMode: PrivacyMode; shareCode: string; shareUrl: string } | null> {
  try {
    const mappingRef = ref(database, `user_shares/${String(userId)}/${transactionId}`);
    const mappingSnap = await get(mappingRef);
    if (!mappingSnap.exists()) return null;
    
    const shareCode = mappingSnap.val() as string;
    if (!isValidShareCode(shareCode)) return null;
    const shareRef = ref(database, `shared_receipts/${shareCode}`);
    const shareSnap = await get(shareRef);
    if (!shareSnap.exists()) return null;
    
    const share = shareSnap.val() as ReceiptShare;
    return {
      exists: true,
      isActive: share.isActive,
      privacyMode: share.privacyMode,
      shareCode: share.shareCode,
      shareUrl: `https://t.me/planer0bot?start=receipt_${share.shareCode}`,
    };
  } catch (err) {
    console.warn('getShareStatus failed:', err);
    return null;
  }
}

/** Toggle the active state of a share link */
export async function toggleReceiptShare(shareCode: string, isActive: boolean): Promise<void> {
  if (!isValidShareCode(shareCode)) {
    throw new Error('Invalid share code');
  }
  const shareRef = ref(database, `shared_receipts/${shareCode}`);
  await update(shareRef, { isActive, updatedAt: Date.now() });
}

/** Save someone else's shared receipt (dual write) */
export async function saveSharedReceipt(
  userId: string | number,
  displayName: string,
  shareCode: string
): Promise<void> {
  if (!isValidShareCode(shareCode)) return;
  const userIdStr = String(userId);
  
  // Check if already saved
  const existingRef = ref(database, `saved_receipts/${userIdStr}/${shareCode}`);
  const existing = await get(existingRef);
  if (existing.exists()) return; // Already saved, no-op
  
  // Get the share data
  const share = await getReceiptShare(shareCode);
  if (!share || !share.isActive) return;
  
  const now = Date.now();
  
  // Write 1: saved_receipts/{userId}/{shareCode}
  const savedData: SavedSharedReceipt = {
    id: shareCode,
    userId: userIdStr,
    shareCode,
    receiptId: share.receiptId,
    ownerId: share.ownerId,
    savedAt: now,
  };
  await set(existingRef, savedData);
  
  // Write 2: receipt_savers/{shareCode}/{userId}
  const saverData: ReceiptSaver = {
    userId: userIdStr,
    displayName,
    savedAt: now,
  };
  await set(ref(database, `receipt_savers/${shareCode}/${userIdStr}`), saverData);
}

/** Remove a saved receipt */
export async function unsaveSharedReceipt(
  userId: string | number,
  shareCode: string
): Promise<void> {
  if (!isValidShareCode(shareCode)) return;
  const userIdStr = String(userId);
  await remove(ref(database, `saved_receipts/${userIdStr}/${shareCode}`));
  await remove(ref(database, `receipt_savers/${shareCode}/${userIdStr}`));
}

/** Subscribe to the user's saved receipts */
export function subscribeToSavedReceipts(
  userId: number,
  callback: (receipts: SavedSharedReceipt[]) => void
): Unsubscribe {
  const savedRef = ref(database, `saved_receipts/${userId}`);
  return onValue(savedRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const receipts = Object.values(data) as SavedSharedReceipt[];
    receipts.sort((a, b) => b.savedAt - a.savedAt);
    callback(receipts);
  });
}

/** Get list of users who saved a receipt (owner only — enforced in UI) */
export async function getReceiptSavers(shareCode: string): Promise<ReceiptSaver[]> {
  if (!isValidShareCode(shareCode)) return [];
  try {
    const saversRef = ref(database, `receipt_savers/${shareCode}`);
    const snapshot = await get(saversRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.values(data) as ReceiptSaver[];
  } catch (error) {
    console.warn('getReceiptSavers failed:', error);
    return [];
  }
}

/** Check if the current user has already saved a share */
export async function checkIfSavedByMe(
  userId: string | number,
  shareCode: string
): Promise<boolean> {
  if (!isValidShareCode(shareCode)) return false;
  const savedRef = ref(database, `saved_receipts/${String(userId)}/${shareCode}`);
  const snapshot = await get(savedRef);
  return snapshot.exists();
}

// ====== Joint Checks ======

export async function createJointCheck(
  creatorId: string | number,
  creatorDisplayName: string,
  creatorUsername: string | undefined,
  totalAmount: number,
  currency: string,
  participants: JointCheckParticipant[],
  title = 'Спільний чек'
): Promise<JointCheck> {
  const creatorIdStr = String(creatorId);
  const now = Date.now();
  const month = getCurrentMonth();
  const jointCheckRef = push(ref(database, 'joint_checks'));
  const jointCheckId = jointCheckRef.key!;

  const participantMap: Record<string, JointCheckParticipant> = {};
  [
    {
      userId: creatorIdStr,
      displayName: creatorDisplayName,
      username: creatorUsername || '',
      addedAt: now,
    },
    ...participants,
  ].forEach((participant) => {
    participantMap[participant.userId] = {
      ...participant,
      userId: String(participant.userId),
      addedAt: participant.addedAt || now,
    };
  });

  const jointCheck: JointCheck = {
    id: jointCheckId,
    creatorId: creatorIdStr,
    totalAmount,
    remainingAmount: totalAmount,
    currency,
    title,
    createdAt: now,
    updatedAt: now,
    isClosed: false,
    participants: participantMap,
    payments: {},
    transactionIds: {},
  };

  await set(jointCheckRef, jointCheck);

  const transactionIds: Record<string, string> = {};
  await Promise.all(Object.keys(participantMap).map(async (participantId) => {
    const txRef = push(ref(database, `users/${participantId}/transactions`));
    transactionIds[participantId] = txRef.key!;
    await set(txRef, {
      type: 'expense',
      amount: totalAmount,
      category: 'joint_check',
      description: title,
      date: now,
      month,
      currency,
      jointCheckId,
      isJointCheck: true,
      excludeFromBalance: true,
    } satisfies Omit<Transaction, 'id'>);
  }));

  await update(jointCheckRef, { transactionIds });
  Object.keys(participantMap).forEach((participantId) => notifyTransactionsChanged(participantId));
  jointCheck.transactionIds = transactionIds;
  return jointCheck;
}

export function subscribeToJointCheck(
  jointCheckId: string,
  callback: (jointCheck: JointCheck | null) => void
): Unsubscribe {
  const jointCheckRef = ref(database, `joint_checks/${jointCheckId}`);
  return onValue(jointCheckRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as JointCheck) : null);
  });
}

export async function addJointCheckPayment(
  jointCheckId: string,
  userId: string | number,
  displayName: string,
  amount: number
): Promise<void> {
  const jointCheckRef = ref(database, `joint_checks/${jointCheckId}`);
  const snapshot = await get(jointCheckRef);
  if (!snapshot.exists()) throw new Error('Joint check not found');

  const jointCheck = snapshot.val() as JointCheck;
  const safeAmount = Math.min(amount, jointCheck.remainingAmount);
  if (safeAmount <= 0) throw new Error('Invalid payment amount');

  const paymentRef = push(ref(database, `joint_checks/${jointCheckId}/payments`));
  const remainingAmount = Math.max(0, jointCheck.remainingAmount - safeAmount);
  const updates: Record<string, any> = {
    remainingAmount,
    updatedAt: Date.now(),
    isClosed: remainingAmount === 0,
    [`payments/${paymentRef.key}`]: {
      userId: String(userId),
      displayName,
      amount: safeAmount,
      paidAt: Date.now(),
    } satisfies JointCheckPayment,
  };

  await update(jointCheckRef, updates);

  await addTransaction(Number(userId), {
    type: 'expense',
    amount: safeAmount,
    category: 'joint_check_payment',
    description: `Погашення: ${jointCheck.title}`,
    date: Date.now(),
    month: getCurrentMonth(),
    currency: jointCheck.currency,
  });

  const transactionIds = jointCheck.transactionIds || {};
  await Promise.all(Object.entries(transactionIds).map(([participantId, txId]) => (
    update(ref(database, `users/${participantId}/transactions/${txId}`), {
      amount: remainingAmount,
      description: remainingAmount === 0 ? `${jointCheck.title} · закрито` : jointCheck.title,
    })
  )));
  Object.keys(transactionIds).forEach((participantId) => notifyTransactionsChanged(participantId));
}

// ====== Realtime Subscriptions ======

export function subscribeToTransactions(
  userId: number,
  month: string,
  callback: (transactions: Transaction[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const txRef = ref(database, `users/${userId}/transactions`);
  const txQuery = query(txRef, orderByChild('month'), equalTo(month));

  return onValue(txQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const transactions = Object.entries(data).map(([id, tx]) => ({
      id,
      ...(tx as Omit<Transaction, 'id'>),
    }));
    transactions.sort((a, b) => b.date - a.date);
    callback(transactions);
  }, onError);
}

export function subscribeToAllTransactions(
  userId: number,
  callback: (transactions: Transaction[]) => void
): Unsubscribe {
  const txRef = ref(database, `users/${userId}/transactions`);

  return onValue(txRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const data = snapshot.val();
    const transactions = Object.entries(data).map(([id, tx]) => ({
      id,
      ...(tx as Omit<Transaction, 'id'>),
    }));
    transactions.sort((a, b) => b.date - a.date);
    callback(transactions);
  });
}

export function subscribeToMonthlyBalance(
  userId: number,
  month: string,
  callback: (data: MonthData | null) => void
): Unsubscribe {
  const monthRef = ref(database, `users/${userId}/months/${month}`);
  return onValue(monthRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as MonthData);
    } else {
      callback(null);
    }
  });
}

// ====== Settings ======

export function subscribeToSettings(
  userId: number,
  callback: (settings: UserSettings | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const settingsRef = ref(database, `users/${userId}/settings`);
  return onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as UserSettings);
    } else {
      callback(null);
    }
  }, onError);
}

export async function getUserSettings(userId: number): Promise<UserSettings> {
  const settingsRef = ref(database, `users/${userId}/settings`);
  const snapshot = await get(settingsRef);
  return snapshot.exists() ? snapshot.val() : { currency: 'EUR' };
}

export async function updateUserSettings(
  userId: number,
  settings: Partial<UserSettings>
): Promise<void> {
  const settingsRef = ref(database, `users/${userId}/settings`);
  const snapshot = await get(settingsRef);
  let current = {};
  if (snapshot.exists()) current = snapshot.val();
  await set(settingsRef, { ...current, ...settings });
}

export function subscribeToUserSettings(
  userId: number,
  callback: (settings: UserSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const settingsRef = ref(database, `users/${userId}/settings`);
  return onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as UserSettings);
    } else {
      callback({ currency: 'EUR' });
    }
  }, onError);
}

// ====== All Transactions ======

export async function getAllTransactions(userId: number): Promise<Transaction[]> {
  const txRef = ref(database, `users/${userId}/transactions`);
  const snapshot = await get(txRef);

  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  const transactions = Object.entries(data).map(([id, tx]) => ({
    id,
    ...(tx as Omit<Transaction, 'id'>),
  }));
  transactions.sort((a, b) => b.date - a.date);
  return transactions;
}

// ====== Subscriptions (Auto-charges) ======

export async function addSubscription(
  userId: number,
  subscription: Omit<Subscription, 'id'>
): Promise<string> {
  const subRef = ref(database, `users/${userId}/subscriptions`);
  const newRef = push(subRef);
  await set(newRef, subscription);
  return newRef.key!;
}

export async function updateSubscription(
  userId: number,
  subId: string,
  data: Partial<Omit<Subscription, 'id'>>
): Promise<void> {
  const subRef = ref(database, `users/${userId}/subscriptions/${subId}`);
  const { update } = await import('firebase/database');
  await update(subRef, data);
}

export async function deleteSubscription(
  userId: number,
  subId: string
): Promise<void> {
  const subRef = ref(database, `users/${userId}/subscriptions/${subId}`);
  await remove(subRef);
}

export function subscribeToSubscriptions(
  userId: number,
  callback: (subscriptions: Subscription[]) => void
): Unsubscribe {
  const subRef = ref(database, `users/${userId}/subscriptions`);
  return onValue(subRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const subs = Object.entries(data).map(([id, sub]) => ({
      id,
      ...(sub as Omit<Subscription, 'id'>),
    }));
    subs.sort((a, b) => a.nextDate - b.nextDate);
    callback(subs);
  });
}

// ====== Vendor Usage Tracking ======

export async function incrementVendorUsage(
  userId: number,
  vendorId: string
): Promise<void> {
  const settingsRef = ref(database, `users/${userId}/settings`);
  const snapshot = await get(settingsRef);
  const current: UserSettings = snapshot.exists() ? snapshot.val() : {};
  const counts = current.vendorUsageCounts || {};
  counts[vendorId] = (counts[vendorId] || 0) + 1;
  await set(settingsRef, { ...current, vendorUsageCounts: counts });
}

export async function deleteUserAccount(userId: number): Promise<void> {
  const userRef = ref(database, `users/${userId}`);
  await remove(userRef);
}
