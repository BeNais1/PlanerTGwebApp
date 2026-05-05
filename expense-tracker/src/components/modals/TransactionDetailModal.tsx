import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { type Transaction, getMonthlyBalance, getTransactions, type PrivacyMode, createReceiptShare, toggleReceiptShare, getShareStatus } from '../../services/database';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import { toPng } from 'html-to-image';
import './Modals.css';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: Partial<Transaction>) => Promise<void>;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

const ReceiptIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 11H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 15H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TransactionDetailModal = ({ 
  transaction, 
  onClose, 
  onDelete, 
  onUpdate,
  isLoading,
  walletBalances
}: TransactionDetailModalProps) => {
  const { formatValue, CURRENCY_SYMBOLS } = useCurrency();
  const { categories, names: CATEGORY_NAMES, icons: CATEGORY_ICONS } = useCategories();
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSharingOptionsOpen, setIsSharingOptionsOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('public');
  const [generatedLink, setGeneratedLink] = useState('');
  const [activeShareCode, setActiveShareCode] = useState('');
  const [isShareActive, setIsShareActive] = useState(true);
  const [shareExists, setShareExists] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Edit State
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [description, setDescription] = useState(transaction.description || '');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(transaction.currency as Currency || 'EUR');
  const { user } = useAuth();
  const [balanceAfter, setBalanceAfter] = useState<number | null>(null);

  // Load share status on mount (not on button click)
  useEffect(() => {
    if (!user || !transaction.id) {
      setLoadingStatus(false);
      return;
    }
    let cancelled = false;
    setLoadingStatus(true);
    getShareStatus(user.id, transaction.id).then((status) => {
      if (cancelled) return;
      if (status) {
        setShareExists(true);
        setGeneratedLink(status.shareUrl);
        setActiveShareCode(status.shareCode);
        setIsShareActive(status.isActive);
        setPrivacyMode(status.privacyMode);
      }
      setLoadingStatus(false);
    }).catch(() => {
      if (!cancelled) setLoadingStatus(false);
    });
    return () => { cancelled = true; };
  }, [user, transaction.id]);

  useEffect(() => {
    if (!user || !transaction.month) return;

    const calculateBalanceAfter = async () => {
      const mData = await getMonthlyBalance(user.id, transaction.month);
      const txs = await getTransactions(user.id, transaction.month);
      
      let runningBalance = 0;
      const cur = transaction.currency || 'EUR';

      if (mData) {
        if (cur === 'EUR' && mData.initialBalance) {
          runningBalance = mData.initialBalance;
        } else if (mData.balances && mData.balances[cur] !== undefined) {
          runningBalance = mData.balances[cur];
        }
      }

      const sortedTxs = [...txs].sort((a, b) => a.date - b.date);

      for (const tx of sortedTxs) {
        if ((tx.currency || 'EUR') === cur) {
          if (tx.type === 'income') runningBalance += tx.amount;
          else runningBalance -= tx.amount;
        }
        if (tx.id === transaction.id) break;
      }

      setBalanceAfter(runningBalance);
    };

    calculateBalanceAfter();
  }, [user, transaction]);

  const handleShare = async () => {
    if (!receiptRef.current || isSharing) return;
    try {
      setIsSharing(true);
      const dataUrl = await toPng(receiptRef.current, { quality: 0.95, backgroundColor: '#fff', pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `receipt_${transaction.date}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Чек транзакції', text: `Чек: ${transaction.type === 'expense' ? 'Витрата' : 'Дохід'} ${transaction.amount} ${transaction.currency}` });
      } else {
        const link = document.createElement('a');
        link.download = `receipt_${transaction.date}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      alert('Не вдалося поділитися чеком.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareLink = async () => {
    if (!user || isSharing) return;
    try {
      setIsSharing(true);
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      const share = await createReceiptShare(
        user.id, transaction, privacyMode, displayName, user.username
      );
      const botUsername = 'planer0bot';
      const link = `https://t.me/${botUsername}?start=receipt_${share.shareCode}`;
      setGeneratedLink(link);
      setActiveShareCode(share.shareCode);
      setIsShareActive(share.isActive);
      setShareExists(true);
    } catch (error) {
      console.error(error);
      alert('Помилка при створенні чеку');
    } finally {
      setIsSharing(false);
    }
  };

  const handleSendToChat = () => {
    const text = `🧾 Чек: ${transaction.type === 'expense' ? 'Витрата' : 'Дохід'} ${transaction.amount} ${transaction.currency}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(generatedLink)}&text=${encodeURIComponent(text)}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      alert('Посилання скопійовано!');
    } catch (e) {
      console.error(e);
      alert('Не вдалося скопіювати');
    }
  };

  const handleToggleActive = async () => {
    if (!activeShareCode) return;
    const newActive = !isShareActive;
    await toggleReceiptShare(activeShareCode, newActive);
    setIsShareActive(newActive);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleSave = () => {
    const numAmount = getKeypadNumericValue(amount);
    if (numAmount > 0) {
      onUpdate(transaction.id!, {
        amount: numAmount, category, description, currency: selectedCurrency });
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Ви впевнені, що хочете видалити цю транзакцію?')) {
      await onDelete(transaction.id!);
      handleClose();
    }
  };

  const dateStr = new Date(transaction.date).toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const availableWallets = Object.keys(walletBalances) as Currency[];
  const catObj = categories.find(c => c.id === transaction.category);

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Змінити' : 'Деталі'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!isEditing && (
              <div className="modal-close" onClick={handleShare}
                style={{ cursor: 'pointer', opacity: isSharing ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
                {isSharing ? <SpinnerIcon /> : <ReceiptIcon />}
              </div>
            )}
            <div className="modal-close" onClick={handleClose}>✕</div>
          </div>
        </div>

        {isEditing ? (
          <>
            <NumericKeypad
              value={amount}
              onChange={setAmount}
              currencySymbol={CURRENCY_SYMBOLS[selectedCurrency]}
              onSubmit={handleSave}
              submitLabel="Зберегти"
              isLoading={isLoading}
            />

            <div className="modal-input-group">
              <label className="modal-label">Гаманець</label>
              <div className="currency-selector" style={{ flexWrap: 'wrap' }}>
                {availableWallets.map((c) => (
                  <button key={c}
                    className={`currency-btn ${selectedCurrency === c ? 'active' : ''}`}
                    style={{ padding: '8px 4px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    onClick={() => setSelectedCurrency(c)}>
                    <span>{c}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{formatValue(walletBalances[c], c)}</span>
                  </button>
                ))}
              </div>
            </div>

            {transaction.type === 'expense' && (
              <div className="modal-input-group">
                <label className="modal-label">Категорія</label>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {categories.map((cat) => (
                    <button key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 10px', borderRadius: '12px', border: 'none',
                        background: category === cat.id ? 'var(--accent)' : 'var(--card-bg-2)',
                        color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500,
                        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-input-group">
              <label className="modal-label">Коментар</label>
              <input type="text" className="modal-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <button className="modal-btn-primary" style={{ background: 'var(--card-bg-3)', marginTop: '8px' }} onClick={() => setIsEditing(false)}>
              Скасувати
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: '700', color: transaction.type === 'income' ? 'var(--apple-blue)' : 'var(--apple-text-on-dark)' }}>
                {transaction.type === 'expense' ? '-' : '+'}{formatValue(transaction.amount, selectedCurrency)}
              </div>
              <div style={{ color: 'var(--apple-text-on-dark-tertiary)', fontSize: '14px', marginTop: '4px' }}>
                {dateStr}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--apple-surface-2)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Тип</span>
                <span style={{ fontWeight: '500' }}>{transaction.type === 'income' ? 'Дохід' : 'Витрата'}</span>
              </div>
              
              {transaction.type === 'expense' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Категорія</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{catObj?.icon || CATEGORY_ICONS[transaction.category] || '📦'}</span>
                    <span style={{ fontWeight: '500' }}>{catObj?.name || CATEGORY_NAMES[transaction.category] || transaction.category}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Гаманець</span>
                <span style={{ fontWeight: '500' }}>{selectedCurrency}</span>
              </div>

              {balanceAfter !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px' }}>Баланс після</span>
                  <span style={{ fontWeight: '600', color: 'var(--apple-text-on-dark)' }}>
                    {formatValue(balanceAfter, selectedCurrency as Currency)}
                  </span>
                </div>
              )}

              {transaction.description && (
                <div style={{ borderTop: '1px solid var(--apple-surface-3)', paddingTop: '16px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Коментар</span>
                  <p style={{ fontSize: '16px', lineHeight: '1.4' }}>{transaction.description}</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button className="modal-btn-primary" style={{ flex: 1, background: 'var(--apple-surface-2)', color: '#ff453a' }} onClick={handleDelete} disabled={isLoading}>
                Видалити
              </button>
              <button className="modal-btn-primary" style={{ flex: 2 }} onClick={() => setIsEditing(true)}>
                Змінити
              </button>
            </div>

            {/* Share Link Section */}
            {loadingStatus ? (
              <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                ···
              </div>
            ) : (
              <>
                {/* Smart Share Button */}
                {!isSharingOptionsOpen && (
                  <button 
                    className="modal-btn-primary" 
                    style={{ 
                      width: '100%', marginTop: '4px',
                      background: shareExists && isShareActive 
                        ? 'var(--accent)' 
                        : shareExists && !isShareActive 
                          ? 'var(--card-bg-3)' 
                          : 'var(--accent)',
                      color: shareExists && !isShareActive ? 'var(--text-secondary)' : 'white',
                    }} 
                    onClick={() => setIsSharingOptionsOpen(true)} 
                  >
                    {shareExists && isShareActive 
                      ? '🔗 Посилання на чек' 
                      : shareExists && !isShareActive 
                        ? '🔒 Посилання вимкнено' 
                        : '📤 Створити посилання'}
                  </button>
                )}

                {/* Expanded Share Panel */}
                {isSharingOptionsOpen && (
                  <div style={{ background: 'var(--apple-surface-2)', borderRadius: '16px', padding: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Privacy Mode (only when creating new) */}
                    {!shareExists && (
                      <>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Приватність
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {(['public', 'anonymous'] as const).map(mode => (
                            <button
                              key={mode}
                              onClick={() => setPrivacyMode(mode)}
                              style={{
                                flex: 1, padding: '10px 8px', border: 'none', borderRadius: '12px',
                                background: privacyMode === mode ? 'var(--accent)' : 'var(--card-bg-3)',
                                color: privacyMode === mode ? 'white' : 'var(--text-secondary)',
                                fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {mode === 'public' ? '👤 Показати імʼя' : '🕵️ Анонімно'}
                            </button>
                          ))}
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '-4px 0 0 0' }}>
                          {privacyMode === 'public'
                            ? 'Ваше імʼя та username будуть видні отримувачу'
                            : 'Ваші дані будуть приховані від отримувача'}
                        </p>
                        <button 
                          className="modal-btn-primary" 
                          style={{ width: '100%', background: 'var(--accent)', color: 'white' }} 
                          onClick={handleShareLink} 
                          disabled={isSharing}
                        >
                          {isSharing ? 'Генерація...' : 'Створити посилання'}
                        </button>
                      </>
                    )}

                    {/* Existing link management */}
                    {shareExists && (
                      <>
                        {/* Status badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: isShareActive ? '#34c759' : 'var(--danger)',
                          }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isShareActive ? 'Посилання активне' : 'Посилання вимкнено'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                            {privacyMode === 'public' ? '👤 Публічне' : '🕵️ Анонімне'}
                          </span>
                        </div>

                        {isShareActive && (
                          <>
                            {/* Link + copy */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input 
                                type="text" 
                                readOnly 
                                value={generatedLink} 
                                style={{ flex: 1, padding: '10px 12px', background: 'var(--card-bg-3)', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '11px' }}
                              />
                              <button onClick={handleCopyLink} style={{ padding: '0 14px', background: 'var(--card-bg-3)', color: 'var(--accent)', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                📋
                              </button>
                            </div>
                            {/* Send to Telegram */}
                            <button 
                              className="modal-btn-primary" 
                              style={{ width: '100%', background: 'var(--apple-blue)', color: 'white' }} 
                              onClick={handleSendToChat} 
                            >
                              Відправити в Telegram
                            </button>
                          </>
                        )}

                        {/* Toggle active */}
                        <button
                          onClick={handleToggleActive}
                          style={{
                            padding: '10px', border: 'none', borderRadius: '10px',
                            background: isShareActive ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
                            color: isShareActive ? 'var(--danger)' : '#34c759',
                            fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                          }}
                        >
                          {isShareActive ? '🔒 Вимкнути посилання' : '🔓 Увімкнути посилання'}
                        </button>
                      </>
                    )}

                    {/* Collapse */}
                    <button
                      onClick={() => setIsSharingOptionsOpen(false)}
                      style={{ padding: '6px', border: 'none', background: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Згорнути
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden Receipt Template */}
      <div className="receipt-container">
        <div ref={receiptRef} className="receipt-template">
          <div className="receipt-header">
            <div className="receipt-logo">PLANER</div>
            <div className="receipt-brand">Expense Tracker</div>
          </div>
          <div className="receipt-divider" />
          <div className="receipt-amount" style={{ color: transaction.type === 'income' ? '#007aff' : '#1c1c1e' }}>
            {transaction.type === 'expense' ? '-' : '+'}{formatValue(transaction.amount, transaction.currency as Currency || 'EUR')}
          </div>
          <div style={{ color: '#8e8e93', fontSize: '13px', marginBottom: '10px' }}>{dateStr}</div>
          <div className="receipt-divider" />
          <div className="receipt-details">
            <div className="receipt-row">
              <span className="receipt-label">Тип</span>
              <span className="receipt-value">{transaction.type === 'income' ? 'Дохід' : 'Витрата'}</span>
            </div>
            {transaction.type === 'expense' && (
              <div className="receipt-row">
                <span className="receipt-label">Категорія</span>
                <span className="receipt-value">{catObj?.name || CATEGORY_NAMES[transaction.category] || transaction.category}</span>
              </div>
            )}
            <div className="receipt-row">
              <span className="receipt-label">Гаманець</span>
              <span className="receipt-value">{transaction.currency}</span>
            </div>
            {balanceAfter !== null && (
              <div className="receipt-row">
                <span className="receipt-label">Баланс після</span>
                <span className="receipt-value">{formatValue(balanceAfter, transaction.currency as Currency || 'EUR')}</span>
              </div>
            )}
            {transaction.description && (
              <>
                <div className="receipt-divider" style={{ margin: '15px 0' }} />
                <div style={{ width: '100%' }}>
                  <span className="receipt-label" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Коментар</span>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4' }}>{transaction.description}</p>
                </div>
              </>
            )}
          </div>
          <div className="receipt-footer">
            Дякуємо за використання Planer!<br/>
            t.me/planer0bot
          </div>
        </div>
      </div>
    </div>
  );
};
