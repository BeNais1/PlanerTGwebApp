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
  budgetLimit?: number; // Spending limit in main currency
  budgetLimitPeriod?: 'day' | 'week' | 'month'; // the period for the limit
  budgetLimitIncludePrior?: boolean; // Whether to count expenses made before limit was set
  budgetLimitStartDate?: number | null; // Timestamp when limit was set (if not including prior)
  onboardingCompleted?: boolean;
  onboarding?: OnboardingData;
  theme?: 'dark' | 'light';
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
  
  // Deactivate any shared receipt link for this transaction
  try {
    const mappingRef = ref(database, `user_shares/${userId}/${txId}`);
    const mappingSnap = await get(mappingRef);
    if (mappingSnap.exists()) {
      const shareCode = mappingSnap.val() as string;
      const shareRef = ref(database, `shared_receipts/${shareCode}`);
      await update(shareRef, {
        isActive: false,
        disabledReason: 'receipt_deleted',
        updatedAt: Date.now(),
      });
      // Remove the mapping
      await set(mappingRef, null);
    }
  } catch (err) {
    console.warn('Failed to deactivate share on delete:', err);
  }
}

// ====== Legacy Shared Receipts (backward compat) ======

export async function getSharedReceipt(receiptId: string): Promise<SharedReceipt | null> {
  const receiptRef = ref(database, `shared_receipts/${receiptId}`);
  const snapshot = await get(receiptRef);
  return snapshot.exists() ? (snapshot.val() as SharedReceipt) : null;
}

// ====== New Receipt Sharing System ======

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
        // Update privacy mode if changed
        if (existing.privacyMode !== privacyMode) {
          const shareRef = ref(database, `shared_receipts/${existing.shareCode}`);
          await update(shareRef, {
            privacyMode,
            ownerName: privacyMode === 'public' ? (displayName || '') : null,
            ownerUsername: privacyMode === 'public' ? (username || '') : null,
            updatedAt: Date.now(),
          });
          existing.privacyMode = privacyMode;
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
  const shareRef = ref(database, `shared_receipts/${shareCode}`);
  await update(shareRef, { isActive, updatedAt: Date.now() });
}

/** Save someone else's shared receipt (dual write) */
export async function saveSharedReceipt(
  userId: string | number,
  displayName: string,
  shareCode: string
): Promise<void> {
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
  const saversRef = ref(database, `receipt_savers/${shareCode}`);
  const snapshot = await get(saversRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as ReceiptSaver[];
}

/** Check if the current user has already saved a share */
export async function checkIfSavedByMe(
  userId: string | number,
  shareCode: string
): Promise<boolean> {
  const savedRef = ref(database, `saved_receipts/${String(userId)}/${shareCode}`);
  const snapshot = await get(savedRef);
  return snapshot.exists();
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
