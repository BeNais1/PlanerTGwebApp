import { describe, expect, it, vi } from 'vitest';
import { createFamilyRoutes } from '../backend/routes/families.js';

function setup(role: string | null, balance = 100) {
  const finance = { wallets: { card: { balance, currency: 'UAH' } }, transactions: {} as Record<string, unknown> };
  const transaction = vi.fn(async (mutate: (data: typeof finance | null) => unknown) => {
    expect(mutate(null)).toBeNull();
    mutate(finance);
    return { committed: true };
  });
  const db = { ref: (path: string) => ({
    get: async () => ({ exists: () => true, val: () => ({ members: role ? { actor: { role } } : {} }) }),
    push: () => ({ key: 'correction' }),
    transaction: path.startsWith('users/') ? transaction : vi.fn(),
  }) };
  const router = createFamilyRoutes({ db });
  const route = router.stack.find((layer: { route?: { path: string } }) => layer.route?.path === '/:familyId/reconcile').route.stack[0].handle;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), end: vi.fn() };
  const request = (expectedBalance = 100, actualBalance = 75) => route({ user: { uid: 'actor' }, params: { familyId: 'family01' }, body: { walletId: 'card', expectedBalance, actualBalance } }, res);
  return { finance, transaction, res, request };
}

describe('family reconciliation', () => {
  it.each(['owner', 'admin'])('lets %s record a separate correction atomically', async role => {
    const { finance, res, request } = setup(role);
    await request();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(finance.wallets.card.balance).toBe(75);
    expect(finance.transactions.correction).toMatchObject({ amount: 25, type: 'expense', isReconciliation: true, walletId: 'card' });
  });
  it.each(['member', null])('rejects a non-manager without changing balances', async role => {
    const { finance, transaction, res, request } = setup(role);
    await request();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(transaction).not.toHaveBeenCalled();
    expect(finance.wallets.card.balance).toBe(100);
  });
  it('rejects a stale balance and preserves concurrent transactions', async () => {
    const { finance, res, request } = setup('owner', 120);
    await request(100, 75);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(finance.wallets.card.balance).toBe(120);
    expect(finance.transactions).toEqual({});
  });
  it('does not create a zero-value correction', async () => {
    const { finance, request } = setup('owner');
    await request(100, 100);
    expect(finance.transactions).toEqual({});
  });
});
