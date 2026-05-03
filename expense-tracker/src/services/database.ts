import { database } from '../config/firebase';
import {
  ref,
  set,
  get,
  push,
  remove,
  onValue,
  query,
  orderByChild,
  equalTo,
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

export interface Transaction {
  id?: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  date: number;
  month: string; // "YYYY-MM"
  currency?: string; // e.g. "EUR" "USD"
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
  period: 'weekly' | 'monthly' | 'yearly';
  nextDate: number; // timestamp of next charge
  createdAt: number;
  isActive: boolean;
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
  walletNames?: Record<string, string>;
  customCategories?: Category[];
  hiddenCategories?: string[];
  customVendors?: CustomVendor[];
  vendorUsageCounts?: Record<string, number>; // vendorId -> usage count
  budgetLimit?: number; // Monthly spending limit in main currency
  budgetLimitIncludePrior?: boolean; // Whether to count expenses made before limit was set
  budgetLimitStartDate?: number | null; // Timestamp when limit was set (if not including prior)
  onboardingCompleted?: boolean;
  onboarding?: OnboardingData;
  theme?: 'dark' | 'light';
}

// ====== Helpers ======

export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
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

// ====== Transactions ======

export async function addTransaction(
  userId: number,
  transaction: Omit<Transaction, 'id'>
): Promise<string> {
  const txRef = ref(database, `users/${userId}/transactions`);
  const newRef = push(txRef);
  // Default legacy currency to EUR if not provided
  if (!transaction.currency) transaction.currency = 'EUR';
  await set(newRef, transaction);
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
  const { update } = await import('firebase/database');
  await update(txRef, data);
}

export async function deleteTransaction(
  userId: number,
  txId: string
): Promise<void> {
  const txRef = ref(database, `users/${userId}/transactions/${txId}`);
  await set(txRef, null);
}

// ====== Realtime Subscriptions ======

export function subscribeToTransactions(
  userId: number,
  month: string,
  callback: (transactions: Transaction[]) => void
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
  callback: (settings: UserSettings | null) => void
): Unsubscribe {
  const settingsRef = ref(database, `users/${userId}/settings`);
  return onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as UserSettings);
    } else {
      callback(null);
    }
  });
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
  callback: (settings: UserSettings) => void
): Unsubscribe {
  const settingsRef = ref(database, `users/${userId}/settings`);
  return onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as UserSettings);
    } else {
      callback({ currency: 'EUR' });
    }
  });
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
