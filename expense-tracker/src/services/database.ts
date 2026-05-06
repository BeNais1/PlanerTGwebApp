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
  period: 'weekly' | 'monthly' | 'yearly';
  nextDate: number; // timestamp of next charge
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
  const txToSave = transaction.currency ? transaction : { ...transaction, currency: 'EUR' };
  await set(newRef, txToSave);
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
  const before = beforeSnap.exists()
    ? ({ id: txId, ...(beforeSnap.val() as Omit<Transaction, 'id'>) } as Transaction)
    : null;

  await update(txRef, data);

  if (!before) return;

  const updatedTransaction: Transaction = { ...before, ...data, id: txId };

  try {
    const mappingRef = ref(database, `user_shares/${String(userId)}/${txId}`);
    const mappingSnap = await get(mappingRef);
    if (!mappingSnap.exists()) return;

    const shareCode = mappingSnap.val() as string;
    const shareRef = ref(database, `shared_receipts/${shareCode}`);
    await update(shareRef, {
      transaction: updatedTransaction,
      updatedAt: Date.now(),
    });

    const oldCurrency = before.currency || 'EUR';
    const newCurrency = updatedTransaction.currency || 'EUR';
    if (before.amount !== updatedTransaction.amount || oldCurrency !== newCurrency) {
      const historyRef = push(ref(database, `shared_receipts/${shareCode}/amountHistory`));
      await set(historyRef, {
        changedAt: Date.now(),
        oldAmount: before.amount,
        newAmount: updatedTransaction.amount,
        oldCurrency,
        newCurrency,
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

function generateTemporaryCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
    if (parsed?.type !== 'planer_user' || !parsed.userId || !parsed.displayName) return null;
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
