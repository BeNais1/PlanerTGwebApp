import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../hooks/useCategories';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import {
  subscribeToSavedReceipts,
  getReceiptShare,
  unsaveSharedReceipt,
  type SavedSharedReceipt,
  type ReceiptShare,
} from '../services/database';

interface SavedReceiptsViewProps {
  isActive: boolean;
  onOpenReceipt: (share: ReceiptShare) => void;
}

export const SavedReceiptsView = ({ isActive, onOpenReceipt }: SavedReceiptsViewProps) => {
  const { user } = useAuth();
  const { icons: CATEGORY_ICONS, names: CATEGORY_NAMES } = useCategories();
  const { CURRENCY_SYMBOLS } = useCurrency();
  const [savedReceipts, setSavedReceipts] = useState<SavedSharedReceipt[]>([]);
  const [shareCache, setShareCache] = useState<Record<string, ReceiptShare | null>>({});
  const [loadingShares, setLoadingShares] = useState(false);

  // Subscribe to saved receipts list
  useEffect(() => {
    if (!user) return;
    return subscribeToSavedReceipts(user.id, setSavedReceipts);
  }, [user]);

  // Load full share data for each saved receipt
  useEffect(() => {
    if (savedReceipts.length === 0) {
      setShareCache({});
      return;
    }
    let cancelled = false;
    setLoadingShares(true);

    Promise.all(
      savedReceipts.map(async (sr) => {
        const share = await getReceiptShare(sr.shareCode);
        return [sr.shareCode, share] as const;
      })
    ).then((results) => {
      if (!cancelled) {
        const cache: Record<string, ReceiptShare | null> = {};
        results.forEach(([code, share]) => { cache[code] = share; });
        setShareCache(cache);
        setLoadingShares(false);
      }
    });

    return () => { cancelled = true; };
  }, [savedReceipts]);

  const handleUnsave = useCallback(async (shareCode: string) => {
    if (!user) return;
    if (!window.confirm('Видалити зі збережених?')) return;
    await unsaveSharedReceipt(user.id, shareCode);
  }, [user]);

  const handleOpen = useCallback((shareCode: string) => {
    const share = shareCache[shareCode];
    if (share) onOpenReceipt(share);
  }, [shareCache, onOpenReceipt]);

  if (!isActive) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)',
      paddingTop: 'calc(var(--safe-area-top, 0px) + 16px)',
      paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 70px)',
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{ padding: '0 20px', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Збережені чеки
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Чеки, які ви зберегли від інших користувачів
        </p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {savedReceipts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-tertiary)', fontSize: '14px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p>У вас ще немає збережених чеків</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              Коли хтось поділиться з вами чеком, ви зможете зберегти його тут
            </p>
          </div>
        ) : loadingShares ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Завантаження...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedReceipts.map((sr) => {
              const share = shareCache[sr.shareCode];
              const tx = share?.transaction;
              const isInactive = share && !share.isActive;

              return (
                <div
                  key={sr.shareCode}
                  onClick={() => handleOpen(sr.shareCode)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px',
                    background: 'var(--card-bg)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    opacity: isInactive ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: '42px', height: '42px',
                    borderRadius: '12px',
                    background: 'var(--card-bg-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', flexShrink: 0,
                  }}>
                    {tx ? (CATEGORY_ICONS[tx.category] || '🧾') : '🧾'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '15px', fontWeight: 600,
                      color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      {tx ? (CATEGORY_NAMES[tx.category] || 'Витрата') : 'Чек'}
                      {isInactive && (
                        <span style={{
                          fontSize: '10px', padding: '2px 6px',
                          background: 'var(--danger)', color: 'white',
                          borderRadius: '4px', fontWeight: 700,
                        }}>
                          Вимкнено
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {tx ? new Date(tx.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      {share?.privacyMode === 'public' && share.ownerName && (
                        <> · від {share.ownerName}</>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {tx ? `${tx.type === 'expense' ? '-' : '+'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {tx ? CURRENCY_SYMBOLS[tx.currency as Currency] || tx.currency : ''}
                    </div>
                  </div>

                  {/* Unsave button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnsave(sr.shareCode); }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-tertiary)', cursor: 'pointer',
                      padding: '4px', fontSize: '16px', flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
