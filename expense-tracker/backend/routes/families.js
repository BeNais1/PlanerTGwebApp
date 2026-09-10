import crypto from 'crypto';
import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import {
  canChangeMemberRole,
  canManageFamily,
  canRemoveFamilyMember,
  normalizeCurrency,
  normalizeFamilyName,
} from '../utils/families.js';

const normalizeTags = value => Array.isArray(value) ? [...new Set(value.filter(tag => typeof tag === 'string').map(tag => tag.trim().replace(/^#+/, '').toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 10) : [];

const FAMILY_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const INVITE_CODE_RE = /^[A-F0-9]{12}$/;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

function getUserId(req) {
  return String(req.user?.uid || '');
}

function getDisplayName(req) {
  return String(req.user?.firstName || req.user?.username || req.user?.uid || 'Учасник').slice(0, 120);
}

function getWalletDeltas(transaction) {
  if (!transaction || transaction.excludeFromBalance) return {};
  if (transaction.type === 'transfer') {
    if (!transaction.fromWalletId || !transaction.toWalletId) return {};
    return {
      [transaction.fromWalletId]: -Number(transaction.amount || 0),
      [transaction.toWalletId]: Number(transaction.convertedAmount || 0),
    };
  }
  if (!transaction.walletId) return {};
  return { [transaction.walletId]: transaction.type === 'income' ? Number(transaction.amount) : -Number(transaction.amount) };
}

function applyWalletDeltas(finance, deltas, multiplier = 1) {
  for (const [walletId, delta] of Object.entries(deltas)) {
    const wallet = finance.wallets?.[walletId];
    if (!wallet) throw new Error('Wallet not found');
    wallet.balance = Number(wallet.balance || 0) + delta * multiplier;
  }
}

function canEditTransaction(member, userId, transaction) {
  return member?.role === 'owner' || member?.role === 'admin' || transaction?.authorId === userId;
}

async function getFamilyMembership(db, familyId, userId) {
  const snapshot = await db.ref(`family_spaces/${familyId}`).get();
  if (!snapshot.exists()) return { family: null, member: null };
  const family = snapshot.val();
  return { family, member: family.members?.[userId] || null };
}

export function createFamilyRoutes({ db }) {
  const router = express.Router();
  router.use(verifyToken);
  router.param('familyId', (req, res, next, value) => {
    if (!FAMILY_ID_RE.test(value)) return res.status(400).json({ error: 'Invalid family ID' });
    return next();
  });

  router.post('/', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const name = normalizeFamilyName(req.body?.name);
    const currency = normalizeCurrency(req.body?.currency);
    const walletName = normalizeFamilyName(req.body?.walletName) || 'Сімейний гаманець';
    const initialBalance = Number(req.body?.initialBalance || 0);
    if (!name || !Number.isFinite(initialBalance) || initialBalance < 0) {
      return res.status(400).json({ error: 'Invalid family setup data' });
    }

    const familyRef = db.ref('family_spaces').push();
    const familyId = familyRef.key;
    const walletRef = db.ref(`users/family_${familyId}/wallets`).push();
    const now = Date.now();
    const member = {
      userId,
      displayName: getDisplayName(req),
      username: String(req.user?.username || '').slice(0, 64),
      role: 'owner',
      joinedAt: now,
    };
    const summary = { id: familyId, name, currency, role: 'owner', joinedAt: now };

    await db.ref().update({
      [`family_spaces/${familyId}`]: {
        id: familyId,
        name,
        currency,
        ownerId: userId,
        createdAt: now,
        updatedAt: now,
        members: { [userId]: member },
      },
      [`user_family_spaces/${userId}/${familyId}`]: summary,
      [`family_data_access/family_${familyId}/${userId}`]: 'owner',
      [`users/family_${familyId}/wallets/${walletRef.key}`]: {
        name: walletName,
        currency,
        balance: initialBalance,
        createdAt: now,
      },
      [`users/family_${familyId}/settings`]: {
        currency,
        mainWalletId: walletRef.key,
        onboardingCompleted: true,
        theme: 'dark',
      },
    });

    return res.status(201).json({ family: summary, walletId: walletRef.key });
  });

  router.post('/join', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!INVITE_CODE_RE.test(code)) return res.status(400).json({ error: 'Некоректний код запрошення' });

    const inviteRef = db.ref(`family_invites/${code}`);
    const initialInviteSnapshot = await inviteRef.get();
    if (!initialInviteSnapshot.exists()) {
      return res.status(410).json({ error: 'Запрошення не знайдено. Попросіть власника створити нове' });
    }
    const initialInvite = initialInviteSnapshot.val();
    if (initialInvite.revokedAt || initialInvite.expiresAt <= Date.now()) {
      return res.status(410).json({ error: 'Термін дії запрошення минув. Попросіть власника створити нове' });
    }

    const familyId = initialInvite.familyId;
    const familySnapshot = await db.ref(`family_spaces/${familyId}`).get();
    if (!familySnapshot.exists()) return res.status(404).json({ error: 'Сімейний бюджет більше не існує' });
    const family = familySnapshot.val();
    const now = Date.now();
    const existingRole = family.members?.[userId]?.role;
    if (existingRole) {
      const existingMember = family.members[userId];
      return res.json({
        family: {
          id: familyId,
          name: family.name,
          currency: family.currency,
          role: existingRole,
          joinedAt: existingMember.joinedAt || now,
        },
      });
    }

    const role = initialInvite.role || 'member';
    const member = {
      userId,
      displayName: getDisplayName(req),
      username: String(req.user?.username || '').slice(0, 64),
      role,
      joinedAt: family.members?.[userId]?.joinedAt || now,
    };
    const summary = { id: familyId, name: family.name, currency: family.currency, role, joinedAt: member.joinedAt };

    await db.ref().update({
      [`family_spaces/${familyId}/members/${userId}`]: member,
      [`family_spaces/${familyId}/updatedAt`]: now,
      [`user_family_spaces/${userId}/${familyId}`]: summary,
      [`family_data_access/family_${familyId}/${userId}`]: role,
    });
    await inviteRef.transaction((invite) => {
      if (!invite) return invite;
      return { ...invite, usedCount: Number(invite.usedCount || 0) + 1 };
    });
    return res.json({ family: summary });
  });

  router.post('/:familyId/invites', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const familyId = String(req.params.familyId || '');
    if (!FAMILY_ID_RE.test(familyId)) return res.status(400).json({ error: 'Invalid family ID' });
    const { family, member } = await getFamilyMembership(db, familyId, userId);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (!canManageFamily(member?.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    const role = req.body?.role === 'admin' && member.role === 'owner' ? 'admin' : 'member';
    const maxUses = 0;
    const code = crypto.randomBytes(6).toString('hex').toUpperCase();
    const now = Date.now();
    const invite = {
      code,
      familyId,
      familyName: family.name,
      createdBy: userId,
      role,
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
      maxUses,
      usedCount: 0,
    };
    await db.ref(`family_invites/${code}`).set(invite);
    return res.status(201).json({ invite });
  });

  router.post('/:familyId/reconcile', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId } = req.params;
    const { member } = await getFamilyMembership(db, familyId, userId);
    if (!canManageFamily(member?.role)) return res.status(403).json({ error: 'Only owners and admins can reconcile balances' });
    const { walletId, expectedBalance, actualBalance } = req.body || {};
    if (typeof walletId !== 'string' || !Number.isFinite(expectedBalance) || !Number.isFinite(actualBalance)) return res.status(400).json({ error: 'Invalid balance' });
    const txId = db.ref(`users/family_${familyId}/transactions`).push().key;
    const date = Date.now();
    try {
      const result = await db.ref(`users/family_${familyId}`).transaction(finance => {
        if (!finance) return finance;
        const wallet = finance?.wallets?.[walletId];
        if (!wallet || Number(wallet.balance || 0) !== expectedBalance) throw new Error('Balance changed. Reopen reconciliation.');
        const difference = Math.round((actualBalance - expectedBalance) * 100) / 100;
        if (!difference) return finance;
        finance.transactions ||= {};
        finance.transactions[txId] = {
          type: difference > 0 ? 'income' : 'expense', amount: Math.abs(difference), category: 'other',
          description: 'Звірка балансу', date, month: new Date(date).toISOString().slice(0, 7),
          currency: wallet.currency, walletId, isReconciliation: true,
          authorId: userId, authorName: getDisplayName(req), createdAt: date,
        };
        wallet.balance = Math.round(actualBalance * 100) / 100;
        return finance;
      });
      if (!result.committed) return res.status(409).json({ error: 'Balance changed' });
      return res.status(204).end();
    } catch { return res.status(409).json({ error: 'Balance changed. Reopen reconciliation.' }); }
  });

  router.post('/:familyId/transactions', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId } = req.params;
    const { member } = await getFamilyMembership(db, familyId, userId);
    if (!member) return res.status(403).json({ error: 'Family membership is required' });
    const input = req.body || {};
    const amount = Number(input.amount);
    if (!['expense', 'income'].includes(input.type) || !Number.isFinite(amount) || amount <= 0 || !input.walletId) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }
    const txId = db.ref(`users/family_${familyId}/transactions`).push().key;
    const now = Date.now();
    const transaction = {
      type: input.type,
      amount,
      category: String(input.category || (input.type === 'income' ? 'income' : 'other')).slice(0, 80),
      description: String(input.description || '').slice(0, 500),
      tags: normalizeTags(input.tags),
      date: Number(input.date) || now,
      month: String(input.month || new Date(Number(input.date) || now).toISOString().slice(0, 7)),
      currency: String(input.currency || 'UAH').slice(0, 8),
      walletId: String(input.walletId),
      excludeFromBalance: input.excludeFromBalance === true,
      authorId: userId,
      authorName: getDisplayName(req),
      createdAt: now,
    };
    try {
      const result = await db.ref(`users/family_${familyId}`).transaction((finance) => {
        if (!finance) return;
        finance.transactions ||= {};
        applyWalletDeltas(finance, getWalletDeltas(transaction));
        finance.transactions[txId] = transaction;
        return finance;
      });
      if (!result.committed) return res.status(409).json({ error: 'Transaction could not be saved' });
      return res.status(201).json({ transaction: { id: txId, ...transaction } });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Transaction could not be saved' });
    }
  });

  router.post('/:familyId/transfers', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId } = req.params;
    const { member } = await getFamilyMembership(db, familyId, userId);
    if (!member) return res.status(403).json({ error: 'Family membership is required' });
    const input = req.body || {};
    const amount = Number(input.amount);
    const convertedAmount = Number(input.convertedAmount);
    if (!input.fromWalletId || !input.toWalletId || input.fromWalletId === input.toWalletId
      || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(convertedAmount) || convertedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid transfer' });
    }
    const txId = db.ref(`users/family_${familyId}/transactions`).push().key;
    const now = Date.now();
    let transaction;
    try {
      const result = await db.ref(`users/family_${familyId}`).transaction((finance) => {
        if (!finance?.wallets?.[input.fromWalletId] || !finance.wallets[input.toWalletId]) return;
        const fromWallet = finance.wallets[input.fromWalletId];
        const toWallet = finance.wallets[input.toWalletId];
        transaction = {
          type: 'transfer',
          amount,
          convertedAmount,
          category: 'transfer',
          description: String(input.description || `${fromWallet.name} → ${toWallet.name}`).slice(0, 500),
          date: Number(input.date) || now,
          month: new Date(Number(input.date) || now).toISOString().slice(0, 7),
          currency: fromWallet.currency,
          walletId: String(input.fromWalletId),
          fromWalletId: String(input.fromWalletId),
          toWalletId: String(input.toWalletId),
          authorId: userId,
          authorName: getDisplayName(req),
          createdAt: now,
        };
        finance.transactions ||= {};
        applyWalletDeltas(finance, getWalletDeltas(transaction));
        finance.transactions[txId] = transaction;
        return finance;
      });
      if (!result.committed || !transaction) return res.status(409).json({ error: 'Transfer could not be saved' });
      return res.status(201).json({ transaction: { id: txId, ...transaction } });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Transfer could not be saved' });
    }
  });

  router.put('/:familyId/transactions/:txId', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId, txId } = req.params;
    const { member } = await getFamilyMembership(db, familyId, userId);
    if (!member) return res.status(403).json({ error: 'Family membership is required' });
    let denied = false;
    let updatedTransaction;
    try {
      const result = await db.ref(`users/family_${familyId}`).transaction((finance) => {
        const before = finance?.transactions?.[txId];
        if (!before) return;
        if (!canEditTransaction(member, userId, before)) {
          denied = true;
          return;
        }
        const allowed = ['amount', 'category', 'description', 'currency', 'date', 'month', 'tags'];
        const changes = Object.fromEntries(allowed.filter((key) => req.body?.[key] !== undefined).map((key) => [key, req.body[key]]));
        const after = { ...before, ...changes, updatedAt: Date.now() };
        after.tags = normalizeTags(after.tags);
        after.amount = Number(after.amount);
        if (!Number.isFinite(after.amount) || after.amount <= 0) throw new Error('Invalid amount');
        applyWalletDeltas(finance, getWalletDeltas(before), -1);
        applyWalletDeltas(finance, getWalletDeltas(after));
        finance.transactions[txId] = after;
        updatedTransaction = { id: txId, ...after };
        return finance;
      });
      if (denied) return res.status(403).json({ error: 'Transaction edit is not allowed' });
      if (!result.committed || !updatedTransaction) return res.status(404).json({ error: 'Transaction not found' });
      return res.json({ transaction: updatedTransaction });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Transaction could not be updated' });
    }
  });

  router.delete('/:familyId/transactions/:txId', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId, txId } = req.params;
    const { member } = await getFamilyMembership(db, familyId, userId);
    if (!member) return res.status(403).json({ error: 'Family membership is required' });
    let denied = false;
    let deletedTransaction;
    try {
      const result = await db.ref(`users/family_${familyId}`).transaction((finance) => {
        const transaction = finance?.transactions?.[txId];
        if (!transaction) return;
        if (!canEditTransaction(member, userId, transaction)) {
          denied = true;
          return;
        }
        applyWalletDeltas(finance, getWalletDeltas(transaction), -1);
        deletedTransaction = { id: txId, ...transaction };
        delete finance.transactions[txId];
        return finance;
      });
      if (denied) return res.status(403).json({ error: 'Transaction delete is not allowed' });
      if (!result.committed || !deletedTransaction) return res.status(404).json({ error: 'Transaction not found' });
      await db.ref(`family_deleted_transactions/${familyId}/${txId}`).set({
        transaction: deletedTransaction,
        deletedBy: userId,
        deletedAt: Date.now(),
      });
      return res.json({ transaction: deletedTransaction });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Transaction could not be deleted' });
    }
  });

  router.post('/:familyId/transactions/:txId/restore', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId, txId } = req.params;
    const { member } = await getFamilyMembership(db, familyId, userId);
    const archiveRef = db.ref(`family_deleted_transactions/${familyId}/${txId}`);
    const archiveSnapshot = await archiveRef.get();
    const archive = archiveSnapshot.exists() ? archiveSnapshot.val() : null;
    const transaction = archive?.transaction;
    if (!member || !transaction || transaction.id !== txId
      || (archive.deletedBy !== userId && !canEditTransaction(member, userId, transaction))) {
      return res.status(403).json({ error: 'Transaction restore is not allowed' });
    }
    const transactionData = { ...transaction };
    delete transactionData.id;
    try {
      const result = await db.ref(`users/family_${familyId}`).transaction((finance) => {
        if (!finance || finance.transactions?.[txId]) return;
        finance.transactions ||= {};
        applyWalletDeltas(finance, getWalletDeltas(transactionData));
        finance.transactions[txId] = transactionData;
        return finance;
      });
      if (!result.committed) return res.status(409).json({ error: 'Transaction could not be restored' });
      await archiveRef.remove();
      return res.json({ transaction });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Transaction could not be restored' });
    }
  });

  router.put('/:familyId/members/:memberId', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const actorId = getUserId(req);
    const { familyId, memberId } = req.params;
    const nextRole = String(req.body?.role || '');
    const { family, member: actor } = await getFamilyMembership(db, familyId, actorId);
    const target = family?.members?.[memberId];
    if (!family || !target) return res.status(404).json({ error: 'Family member not found' });
    if (nextRole === 'owner') {
      if (actor?.role !== 'owner' || target.role === 'owner' || memberId === actorId) {
        return res.status(403).json({ error: 'Ownership transfer is not allowed' });
      }
      await db.ref().update({
        [`family_spaces/${familyId}/ownerId`]: memberId,
        [`family_spaces/${familyId}/members/${actorId}/role`]: 'admin',
        [`family_spaces/${familyId}/members/${memberId}/role`]: 'owner',
        [`family_spaces/${familyId}/updatedAt`]: Date.now(),
        [`user_family_spaces/${actorId}/${familyId}/role`]: 'admin',
        [`user_family_spaces/${memberId}/${familyId}/role`]: 'owner',
        [`family_data_access/family_${familyId}/${actorId}`]: 'admin',
        [`family_data_access/family_${familyId}/${memberId}`]: 'owner',
      });
      return res.json({ memberId, role: 'owner' });
    }
    if (!canChangeMemberRole(actor?.role, target.role, nextRole)) {
      return res.status(403).json({ error: 'Role change is not allowed' });
    }
    await db.ref().update({
      [`family_spaces/${familyId}/members/${memberId}/role`]: nextRole,
      [`family_spaces/${familyId}/updatedAt`]: Date.now(),
      [`user_family_spaces/${memberId}/${familyId}/role`]: nextRole,
      [`family_data_access/family_${familyId}/${memberId}`]: nextRole,
    });
    return res.json({ memberId, role: nextRole });
  });

  router.delete('/:familyId/members/:memberId', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const actorId = getUserId(req);
    const { familyId, memberId } = req.params;
    const { family, member: actor } = await getFamilyMembership(db, familyId, actorId);
    const target = family?.members?.[memberId];
    if (!family || !target) return res.status(404).json({ error: 'Family member not found' });
    if (!canRemoveFamilyMember(actorId, actor?.role, memberId, target.role)) {
      return res.status(403).json({ error: 'Member removal is not allowed' });
    }
    await db.ref().update({
      [`family_spaces/${familyId}/members/${memberId}`]: null,
      [`family_spaces/${familyId}/updatedAt`]: Date.now(),
      [`user_family_spaces/${memberId}/${familyId}`]: null,
      [`family_data_access/family_${familyId}/${memberId}`]: null,
    });
    return res.status(204).end();
  });

  router.delete('/:familyId', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });
    const userId = getUserId(req);
    const { familyId } = req.params;
    const { family, member } = await getFamilyMembership(db, familyId, userId);
    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (member?.role !== 'owner') return res.status(403).json({ error: 'Only the owner can delete a family' });
    const updates = {
      [`family_spaces/${familyId}`]: null,
      [`users/family_${familyId}`]: null,
      [`family_data_access/family_${familyId}`]: null,
      [`family_deleted_transactions/${familyId}`]: null,
    };
    Object.keys(family.members || {}).forEach((memberId) => {
      updates[`user_family_spaces/${memberId}/${familyId}`] = null;
    });
    const invitesSnapshot = await db.ref('family_invites').get();
    if (invitesSnapshot.exists()) {
      Object.entries(invitesSnapshot.val()).forEach(([code, invite]) => {
        if (invite?.familyId === familyId) updates[`family_invites/${code}`] = null;
      });
    }
    await db.ref().update(updates);
    return res.status(204).end();
  });

  return router;
}
