import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import {
  type Subscription,
  subscribeToSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
} from '../services/database';

const PRESET_SUBSCRIPTIONS = [
  { name: 'Spotify', icon: '🎵', category: 'subscriptions', amount: 9.99 },
  { name: 'Netflix', icon: '🍿', category: 'subscriptions', amount: 15.49 },
  { name: 'Apple Music', icon: '🎧', category: 'subscriptions', amount: 10.99 },
  { name: 'YouTube Premium', icon: '▶️', category: 'subscriptions', amount: 13.99 },
  { name: 'ChatGPT Plus', icon: '🤖', category: 'subscriptions', amount: 20.00 },
  { name: 'iCloud+', icon: '☁️', category: 'subscriptions', amount: 2.99 },
  { name: 'Apple TV+', icon: '📺', category: 'subscriptions', amount: 9.99 },
  { name: 'Disney+', icon: '🏰', category: 'subscriptions', amount: 13.99 },
  { name: 'Adobe CC', icon: '🎨', category: 'subscriptions', amount: 54.99 },
  { name: 'Notion', icon: '📝', category: 'subscriptions', amount: 10.00 },
  { name: 'Gym', icon: '💪', category: 'health', amount: 30.00 },
  { name: 'VPN', icon: '🔒', category: 'subscriptions', amount: 12.99 },
];

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Щотижня',
  monthly: 'Щомісяця',
  yearly: 'Щорічно',
};

interface SubscriptionsViewProps {
  isActive: boolean;
  onClose: () => void;
  walletBalances: Record<string, number>;
}

export const SubscriptionsView = ({ isActive, onClose, walletBalances }: SubscriptionsViewProps) => {
  const { user } = useAuth();
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue, convertToMain } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState<Currency>(mainCurrency);
  const [formPeriod, setFormPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [formNextDate, setFormNextDate] = useState('');
  const [formIcon, setFormIcon] = useState('🔄');
  const [formCategory, setFormCategory] = useState('subscriptions');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSubscriptions(user.id, (subs) => {
      setSubscriptions(subs);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    setFormCurrency(mainCurrency);
  }, [mainCurrency]);

  if (!isActive) return null;

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormPeriod('monthly');
    setFormNextDate('');
    setFormIcon('🔄');
    setFormCategory('subscriptions');
    setFormCurrency(mainCurrency);
  };

  const handleSelectPreset = (preset: typeof PRESET_SUBSCRIPTIONS[0]) => {
    setFormName(preset.name);
    setFormAmount(preset.amount.toString());
    setFormIcon(preset.icon);
    setFormCategory(preset.category);
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!user || !formName || !formAmount) return;
    setIsSaving(true);

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setIsSaving(false); return; }

    const nextDate = formNextDate
      ? new Date(formNextDate).getTime()
      : getDefaultNextDate(formPeriod);

    if (editingSub?.id) {
      await updateSubscription(user.id, editingSub.id, {
        name: formName,
        amount,
        currency: formCurrency,
        period: formPeriod,
        nextDate,
        icon: formIcon,
        category: formCategory,
      });
    } else {
      await addSubscription(user.id, {
        name: formName,
        amount,
        currency: formCurrency,
        category: formCategory,
        icon: formIcon,
        period: formPeriod,
        nextDate,
        createdAt: Date.now(),
        isActive: true,
      });
    }

    resetForm();
    setIsAdding(false);
    setEditingSub(null);
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteSubscription(user.id, id);
    setEditingSub(null);
  };

  const handleEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setFormName(sub.name);
    setFormAmount(sub.amount.toString());
    setFormCurrency(sub.currency as Currency);
    setFormPeriod(sub.period);
    setFormIcon(sub.icon);
    setFormCategory(sub.category);
    setFormNextDate(new Date(sub.nextDate).toISOString().split('T')[0]);
    setIsAdding(true);
  };

  // Calculate monthly cost of all subscriptions
  const monthlyCost = subscriptions
    .filter(s => s.isActive)
    .reduce((acc, sub) => {
      let monthly = sub.amount;
      if (sub.period === 'weekly') monthly = sub.amount * 4.33;
      if (sub.period === 'yearly') monthly = sub.amount / 12;
      return acc + convertToMain(monthly, (sub.currency || 'EUR') as Currency);
    }, 0);

  const getDefaultNextDate = (period: string): number => {
    const now = new Date();
    if (period === 'weekly') {
      now.setDate(now.getDate() + 7);
    } else if (period === 'monthly') {
      now.setMonth(now.getMonth() + 1);
    } else {
      now.setFullYear(now.getFullYear() + 1);
    }
    return now.getTime();
  };

  const getDaysUntil = (timestamp: number) => {
    const diff = timestamp - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Прострочено';
    if (days === 0) return 'Сьогодні';
    if (days === 1) return 'Завтра';
    return `Через ${days} дн.`;
  };

  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <div className="analytics-view" style={{
      padding: '0 20px 100px 20px',
      paddingTop: 'calc(var(--safe-area-top, 50px) + 20px)',
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '34px', fontWeight: 'bold', color: 'var(--apple-text-on-dark)' }}>Підписки</h2>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: 'var(--radius-full)',
            background: 'var(--apple-surface-2)', color: 'var(--apple-text-on-dark)',
            border: 'none', fontSize: '15px', fontWeight: '600', width: 'fit-content', cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Закрити
        </button>
      </div>

      {/* Monthly Summary Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--apple-surface-1) 0%, var(--apple-surface-2) 100%)',
        borderRadius: '20px', padding: '20px', marginBottom: '24px',
        border: '1px solid var(--apple-surface-3)',
      }}>
        <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
          Витрати на місяць
        </span>
        <div style={{ fontSize: '32px', fontWeight: '700', color: 'white', marginTop: '8px' }}>
          {formatValue(monthlyCost)}
        </div>
        <span style={{ color: 'var(--apple-text-on-dark-tertiary)', fontSize: '13px' }}>
          {subscriptions.filter(s => s.isActive).length} активних підписок
        </span>
      </div>

      {/* Add / Edit Form */}
      {isAdding ? (
        <div style={{
          background: 'var(--apple-surface-1)', borderRadius: '20px', padding: '20px',
          marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              {editingSub ? 'Редагувати' : 'Нова підписка'}
            </h3>
            <button onClick={() => { setIsAdding(false); setEditingSub(null); resetForm(); }}
              style={{ background: 'none', border: 'none', color: 'var(--apple-text-on-dark-tertiary)', fontSize: '24px', cursor: 'pointer' }}>
              ✕
            </button>
          </div>

          {/* Icon + Name row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={formIcon}
              onChange={(e) => setFormIcon(e.target.value)}
              style={{
                width: '48px', height: '48px', textAlign: 'center', fontSize: '24px',
                background: 'var(--apple-surface-2)', border: 'none', borderRadius: '14px', color: 'white',
              }}
              placeholder="🔄"
            />
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Назва підписки"
              style={{
                flex: 1, padding: '14px 16px', background: 'var(--apple-surface-2)',
                border: 'none', borderRadius: '14px', color: 'white', fontSize: '16px',
                fontFamily: 'var(--font-text)', outline: 'none',
              }}
            />
          </div>

          {/* Amount */}
          <input
            type="text"
            inputMode="decimal"
            value={formAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
              if (val.split('.').length <= 2) setFormAmount(val);
            }}
            placeholder={`0.00 ${CURRENCY_SYMBOLS[formCurrency]}`}
            style={{
              width: '100%', padding: '14px 16px', background: 'var(--apple-surface-2)',
              border: 'none', borderRadius: '14px', color: 'white', fontSize: '24px',
              fontWeight: 600, textAlign: 'center', fontFamily: 'var(--font-display)', outline: 'none',
            }}
          />

          {/* Currency */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {availableWallets.map(c => (
              <button key={c} onClick={() => setFormCurrency(c)}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '12px',
                  background: formCurrency === c ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
                  color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                }}>
                {c}
              </button>
            ))}
          </div>

          {/* Period */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['weekly', 'monthly', 'yearly'] as const).map(p => (
              <button key={p} onClick={() => setFormPeriod(p)}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '12px',
                  background: formPeriod === p ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
                  color: 'white', fontWeight: 500, fontSize: '13px', cursor: 'pointer',
                }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Next Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-secondary)', fontWeight: 500 }}>
              Наступне списання
            </label>
            <input
              type="date"
              value={formNextDate}
              onChange={(e) => setFormNextDate(e.target.value)}
              style={{
                padding: '12px 16px', background: 'var(--apple-surface-2)', border: 'none',
                borderRadius: '14px', color: 'white', fontSize: '15px', fontFamily: 'var(--font-text)',
                outline: 'none', colorScheme: 'dark',
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {editingSub && (
              <button onClick={() => editingSub?.id && handleDelete(editingSub.id)}
                style={{
                  flex: 1, padding: '14px', border: 'none', borderRadius: '14px',
                  background: 'var(--apple-surface-2)', color: '#ff453a', fontWeight: 600,
                  fontSize: '16px', cursor: 'pointer',
                }}>
                Видалити
              </button>
            )}
            <button onClick={handleSave} disabled={isSaving || !formName || !formAmount}
              style={{
                flex: 2, padding: '14px', border: 'none', borderRadius: '14px',
                background: 'var(--apple-blue)', color: 'white', fontWeight: 600,
                fontSize: '16px', cursor: 'pointer', opacity: (!formName || !formAmount) ? 0.5 : 1,
              }}>
              {isSaving ? 'Збереження...' : editingSub ? 'Зберегти' : 'Додати'}
            </button>
          </div>
        </div>
      ) : (
        /* Add Button */
        <button onClick={() => { resetForm(); setIsAdding(true); }}
          style={{
            width: '100%', padding: '14px', background: 'var(--apple-surface-1)',
            border: '1px dashed var(--apple-surface-3)', borderRadius: '16px',
            color: 'var(--apple-blue)', fontWeight: 600, fontSize: '15px',
            cursor: 'pointer', marginBottom: '20px',
          }}>
          + Додати підписку
        </button>
      )}

      {/* Active Subscriptions */}
      {subscriptions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', color: 'var(--apple-text-on-dark-secondary)', marginBottom: '12px', fontWeight: 600 }}>
            Активні підписки
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subscriptions.filter(s => s.isActive).map(sub => (
              <div key={sub.id} onClick={() => handleEdit(sub)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 16px', background: 'var(--apple-surface-1)',
                  borderRadius: '16px', cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  background: 'var(--apple-surface-2)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0,
                }}>
                  {sub.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 500, color: 'white' }}>{sub.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-tertiary)' }}>
                    {PERIOD_LABELS[sub.period]} · {getDaysUntil(sub.nextDate)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>
                    {formatValue(sub.amount, sub.currency as Currency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preset suggestions */}
      {!isAdding && (
        <div>
          <h3 style={{ fontSize: '15px', color: 'var(--apple-text-on-dark-secondary)', marginBottom: '12px', fontWeight: 600 }}>
            Популярні підписки
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {PRESET_SUBSCRIPTIONS
              .filter(p => !subscriptions.some(s => s.name === p.name))
              .map(preset => (
                <div key={preset.name} onClick={() => handleSelectPreset(preset)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px', background: 'var(--apple-surface-1)',
                    borderRadius: '14px', cursor: 'pointer',
                  }}>
                  <span style={{ fontSize: '20px' }}>{preset.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--apple-text-on-dark-tertiary)' }}>
                      ~{convertToMain(preset.amount, 'EUR' as Currency).toFixed(2)} {CURRENCY_SYMBOLS[mainCurrency]}/міс
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
