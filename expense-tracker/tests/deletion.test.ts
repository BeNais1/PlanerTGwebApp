import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get, update, runTransaction } from 'firebase/database';
import { deleteSmartGoal, deleteWallet } from '../src/services/database';
import { apiClient } from '../src/services/api';

vi.mock('../src/config/firebase', () => ({ database: {} }));
vi.mock('firebase/database', () => ({
  ref: (_db: unknown, path: string) => path,
  get: vi.fn(), update: vi.fn(), runTransaction: vi.fn(),
  set: vi.fn(), push: vi.fn(), remove: vi.fn(), onValue: vi.fn(),
  query: vi.fn(), orderByChild: vi.fn(), equalTo: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function walletState(wallets: Record<string, { currency: string }>, mainId: string) {
  vi.mocked(get).mockResolvedValueOnce({ val: () => wallets } as Awaited<ReturnType<typeof get>>)
    .mockResolvedValueOnce({ val: () => mainId } as Awaited<ReturnType<typeof get>>);
}

describe('selective deletion', () => {
  it('removes only the selected card and replaces the main card in one write', async () => {
    walletState({ a: { currency: 'UAH' }, b: { currency: 'EUR' } }, 'a');
    await deleteWallet('123', 'a');
    expect(update).toHaveBeenCalledExactlyOnceWith('users/123', {
      'wallets/a': null, 'settings/mainWalletId': 'b', 'settings/currency': 'EUR',
    });
  });

  it('clears the main card reference when deleting the last card', async () => {
    walletState({ a: { currency: 'UAH' } }, 'a');
    await deleteWallet('123', 'a');
    expect(update).toHaveBeenCalledExactlyOnceWith('users/123', {
      'wallets/a': null, 'settings/mainWalletId': null,
    });
  });

  it('keeps settings and history untouched when deleting a secondary card', async () => {
    walletState({ a: { currency: 'UAH' }, b: { currency: 'EUR' } }, 'a');
    await deleteWallet('123', 'b');
    expect(update).toHaveBeenCalledExactlyOnceWith('users/123', { 'wallets/b': null });
  });

  it('deletes a goal using the latest stored list, preserving other goals', async () => {
    await deleteSmartGoal('123', 'a');
    const [path, mutate] = vi.mocked(runTransaction).mock.calls[0];
    expect(path).toBe('users/123/settings/smartGoals');
    expect(mutate([{ id: 'a' }, { id: 'b' }, { id: 'new' }])).toEqual([{ id: 'b' }, { id: 'new' }]);
    expect(mutate([{ id: 'a' }])).toEqual([]);
    expect(mutate(null)).toBeNull();
  });
});

describe('family deletion response', () => {
  it('accepts the empty 204 response without trying to parse JSON', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'token' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiClient.delete<void>('/api/families/family-1')).resolves.toBeUndefined();
  });
});
