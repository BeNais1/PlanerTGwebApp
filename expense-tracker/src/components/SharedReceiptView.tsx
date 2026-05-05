import { useState, useEffect } from 'react';
import type { ReceiptShare } from '../services/database';
import { useCategories } from '../hooks/useCategories';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import { saveSharedReceipt, unsaveSharedReceipt, checkIfSavedByMe, getReceiptSavers } from '../services/database';
import { useAuth } from '../context/AuthContext';
import { ReceiptSaversModal } from './ReceiptSaversModal';
import './SharedReceiptView.css';

interface SharedReceiptViewProps {
  share: ReceiptShare;
  onClose: () => void;
}

export const SharedReceiptView = ({ share, onClose }: SharedReceiptViewProps) => {
  const { names: CATEGORY_NAMES, icons: CATEGORY_ICONS } = useCategories();
  const { CURRENCY_SYMBOLS } = useCurrency();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savesCount, setSavesCount] = useState(0);
  const [showSavers, setShowSavers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const tx = share.transaction;
  const isIncome = tx.type === 'income';
  const categoryName = isIncome ? 'Дохід' : CATEGORY_NAMES[tx.category] || 'Витрата';
  const categoryIcon = isIncome ? '💰' : CATEGORY_ICONS[tx.category] || '💸';
  const currencySymbol = CURRENCY_SYMBOLS[tx.currency as Currency] || tx.currency;
  const isOwner = user && String(user.id) === share.ownerId;
  const isActive = share.isActive;

  const formattedAmount = tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedDate = new Date(tx.date).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Check saved status & savers count
  useEffect(() => {
    if (!user) return;
    checkIfSavedByMe(user.id, share.shareCode).then(setIsSaved);
    getReceiptSavers(share.shareCode).then((savers) => setSavesCount(savers.length));
  }, [user, share.shareCode]);

  const handleSave = async () => {
    if (!user || isSaving || isSaved) return;
    setIsSaving(true);
    try {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
      await saveSharedReceipt(user.id, name, share.shareCode);
      setIsSaved(true);
      setSavesCount((c) => c + 1);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnsave = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      await unsaveSharedReceipt(user.id, share.shareCode);
      setIsSaved(false);
      setSavesCount((c) => Math.max(0, c - 1));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="shared-receipt-overlay">
      {showSavers && (
        <ReceiptSaversModal shareCode={share.shareCode} onClose={() => setShowSavers(false)} />
      )}

      <div className="receipt-ticket">
        {/* 3-dot menu (owner only) */}
        {isOwner && (
          <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                fontSize: '20px', cursor: 'pointer', padding: '4px 8px',
              }}
            >
              ⋯
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                background: 'var(--card-bg-2)', borderRadius: '12px',
                padding: '4px', minWidth: '180px', zIndex: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}>
                <button
                  onClick={() => { setShowMenu(false); setShowSavers(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '12px 14px',
                    background: 'none', border: 'none', borderRadius: '10px',
                    color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  👥 Хто зберіг ({savesCount})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inactive badge */}
        {!isActive && (
          <div style={{
            position: 'absolute', top: '16px', left: '16px',
            background: 'var(--danger)', color: 'white',
            padding: '4px 10px', borderRadius: '8px',
            fontSize: '11px', fontWeight: 700,
          }}>
            Посилання вимкнено
          </div>
        )}

        <div className="receipt-header" style={{ position: 'relative' }}>
          <div className="receipt-icon">{categoryIcon}</div>
          <h2 className="receipt-title">{categoryName}</h2>
        </div>

        <div className={`receipt-amount ${isIncome ? 'income' : 'expense'}`}>
          {isIncome ? '+' : '-'}{formattedAmount} {currencySymbol}
        </div>

        <div className="receipt-divider"></div>

        <div className="receipt-details">
          {/* Creator info */}
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">Від кого</span>
            <span className="receipt-detail-value">
              {share.privacyMode === 'public' && share.ownerName
                ? `${share.ownerName}${share.ownerUsername ? ` (@${share.ownerUsername})` : ''}`
                : 'Анонімний автор'
              }
            </span>
          </div>

          {tx.description && (
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Опис</span>
              <span className="receipt-detail-value">{tx.description}</span>
            </div>
          )}
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">Категорія</span>
            <span className="receipt-detail-value">{categoryName}</span>
          </div>
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">Дата</span>
            <span className="receipt-detail-value">{formattedDate}</span>
          </div>
          <div className="receipt-detail-row">
            <span className="receipt-detail-label">ID Чеку</span>
            <span className="receipt-detail-value" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {share.shareCode}
            </span>
          </div>
          {savesCount > 0 && (
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Збережено</span>
              <span className="receipt-detail-value">{savesCount} {savesCount === 1 ? 'раз' : 'разів'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="receipt-actions">
        {!isActive ? (
          <button className="receipt-btn-primary" disabled style={{ background: 'var(--card-bg-3)', color: 'var(--text-tertiary)' }}>
            🔒 Посилання вимкнено
          </button>
        ) : isOwner ? (
          <button className="receipt-btn-primary" disabled style={{ background: 'var(--card-bg-3)', color: 'var(--text-secondary)' }}>
            Це ваш чек
          </button>
        ) : isSaved ? (
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              className="receipt-btn-primary"
              style={{ flex: 2, background: '#34d399', cursor: 'default' }}
              disabled
            >
              ✓ Збережено
            </button>
            <button
              className="receipt-btn-primary"
              onClick={handleUnsave}
              disabled={isSaving}
              style={{ flex: 1, background: 'var(--card-bg-3)', color: 'var(--danger)' }}
            >
              Видалити
            </button>
          </div>
        ) : user ? (
          <button
            className="receipt-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ background: 'var(--accent)' }}
          >
            {isSaving ? 'Збереження...' : 'Зберегти собі'}
          </button>
        ) : (
          <button className="receipt-btn-primary" disabled>
            Увійдіть, щоб зберегти
          </button>
        )}
        <button className="receipt-btn-secondary" onClick={onClose}>
          Закрити чек
        </button>
      </div>
    </div>
  );
};
