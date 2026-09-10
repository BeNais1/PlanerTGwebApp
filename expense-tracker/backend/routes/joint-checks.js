import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';

function currentMonth(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function createJointCheckRoutes({ db }) {
  const router = express.Router();

  router.post('/:jointCheckId/payments', verifyToken, async (req, res) => {
    if (!db) return res.status(503).json({ error: 'Database is not configured' });

    const userId = String(req.user?.uid || '');
    const jointCheckId = String(req.params.jointCheckId || '');
    const amount = Number(req.body?.amount);

    if (!userId || !jointCheckId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'A positive payment amount is required' });
    }

    const jointCheckRef = db.ref(`joint_checks/${jointCheckId}`);
    const paymentRef = jointCheckRef.child('payments').push();
    const paymentId = paymentRef.key;
    const now = Date.now();
    let committedPayment = null;
    let committedJointCheck = null;

    try {
      const transactionResult = await jointCheckRef.transaction((jointCheck) => {
        if (!jointCheck) return;
        if (!jointCheck.participants?.[userId]) return;
        if (jointCheck.isClosed || !Number.isFinite(jointCheck.remainingAmount)) return;
        if (amount > jointCheck.remainingAmount) return;

        const safeDisplayName = String(
          jointCheck.participants[userId].displayName
          || req.user?.firstName
          || userId,
        ).slice(0, 120);
        const remainingAmount = Math.max(0, jointCheck.remainingAmount - amount);
        const payment = {
          userId,
          displayName: safeDisplayName,
          amount,
          paidAt: now,
        };

        jointCheck.payments = jointCheck.payments || {};
        jointCheck.payments[paymentId] = payment;
        jointCheck.remainingAmount = remainingAmount;
        jointCheck.updatedAt = now;
        jointCheck.isClosed = remainingAmount === 0;
        committedPayment = payment;
        return jointCheck;
      });

      if (!transactionResult.committed || !committedPayment) {
        return res.status(409).json({ error: 'Payment is not allowed or exceeds the remaining amount' });
      }

      committedJointCheck = transactionResult.snapshot.val();
      const expenseRef = db.ref(`users/${userId}/transactions`).push();
      const updates = {
        [`users/${userId}/transactions/${expenseRef.key}`]: {
          type: 'expense',
          amount,
          category: 'joint_check_payment',
          description: `Погашення: ${committedJointCheck.title}`,
          date: now,
          month: currentMonth(now),
          currency: committedJointCheck.currency,
        },
      };

      for (const [participantId, transactionId] of Object.entries(committedJointCheck.transactionIds || {})) {
        updates[`users/${participantId}/transactions/${transactionId}/amount`] = committedJointCheck.remainingAmount;
        updates[`users/${participantId}/transactions/${transactionId}/description`] = committedJointCheck.isClosed
          ? `${committedJointCheck.title} · закрито`
          : committedJointCheck.title;
      }

      await db.ref().update(updates);
      return res.status(201).json({
        paymentId,
        payment: committedPayment,
        remainingAmount: committedJointCheck.remainingAmount,
        isClosed: committedJointCheck.isClosed,
      });
    } catch (error) {
      console.error('Joint check payment failed:', error);
      return res.status(500).json({ error: 'Failed to add joint check payment' });
    }
  });

  return router;
}
