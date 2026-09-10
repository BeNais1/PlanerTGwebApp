import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useFamilyBudget } from '../context/useFamilyBudget';
import { useCurrency, type Currency, CURRENCY_SYMBOLS as ALL_CURRENCY_SYMBOLS } from '../hooks/useCurrency';
// Currency used for monthlyCost calculation only
import { useWallets } from '../hooks/useWallets';
import {
  type Subscription,
  subscribeToSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  type Wallet,
} from '../services/database';
import { WalletPicker, WalletButton } from './WalletPicker';

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
  daily:   'Щодня',
  weekly:  'Щотижня',
  monthly: 'Щомісяця',
  yearly:  'Щорічно',
};

const ALL_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

function getLocalDateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateTime(dateValue: string, timeValue: string): number {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours = 0, minutes = 0] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function getDaysUntil(timestamp: number) {
  const now = Date.now();
  if (timestamp < now) return { label: 'Прострочено', urgent: true };

  const currentDate = new Date(now);
  const scheduledDate = new Date(timestamp);
  const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
  const scheduledDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate()).getTime();
  const days = Math.round((scheduledDay - currentDay) / 86400000);

  if (days === 0) return { label: 'Сьогодні', urgent: true };
  if (days === 1) return { label: 'Завтра', urgent: false };
  return { label: `Через ${days} дн.`, urgent: false };
}

interface SubscriptionsViewProps {
  isActive: boolean;
  onClose?: () => void;
}

export const SubscriptionsView = ({ isActive }: SubscriptionsViewProps) => {
  const { user } = useAuth();
  const { dataOwnerId } = useFamilyBudget();
  const { currency: mainCurrency, mainWalletId, formatValue, convertToMain, EXCHANGE_RATES } = useCurrency();
  const { wallets } = useWallets();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState<Subscription['period']>('monthly');
  const [formNextDate, setFormNextDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formWalletId, setFormWalletId] = useState<string | null>(null);
  const [formIcon, setFormIcon] = useState('🔄');
  const [formCategory, setFormCategory] = useState('subscriptions');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !dataOwnerId) return;
    const unsub = subscribeToSubscriptions(dataOwnerId, setSubscriptions);
    return () => unsub();
  }, [user, dataOwnerId]);

  if (!isActive) return null;

  const mainWallet: Wallet | null = wallets.find(w => w.id === mainWalletId)
    ?? wallets.find(w => w.currency === mainCurrency)
    ?? wallets[0]
    ?? null;
  const presetCurrency = (mainWallet?.currency as Currency | undefined) ?? mainCurrency;
  const presetAmount = (amountInEur: number) => amountInEur * EXCHANGE_RATES[presetCurrency];
  const selectedWallet: Wallet | null = wallets.find(w => w.id === formWalletId) ?? mainWallet;
  const currSym = selectedWallet
    ? ((ALL_CURRENCY_SYMBOLS as Record<string, string>)[selectedWallet.currency] ?? selectedWallet.currency)
    : '₴';

  const getWalletLabel = (walletId: string) => {
    const w = wallets.find(w => w.id === walletId);
    return w ? w.name : walletId;
  };

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormPeriod('monthly');
    setFormNextDate('');
    setFormTime('09:00');
    setFormWalletId(mainWallet?.id ?? null);
    setFormIcon('🔄');
    setFormCategory('subscriptions');
    setEditingSub(null);
    setIsAdding(false);
  };

  const handleSelectPreset = (preset: typeof PRESET_SUBSCRIPTIONS[0]) => {
    setFormName(preset.name);
    setFormAmount(presetAmount(preset.amount).toFixed(2));
    setFormWalletId(mainWallet?.id ?? null);
    setFormIcon(preset.icon);
    setFormCategory(preset.category);
    setEditingSub(null);
    setIsAdding(true);
  };

  const getDefaultNextDate = (period: Subscription['period']): number => {
    const now = new Date();
    const [h = 0, m = 0] = formTime.split(':').map(Number);
    now.setHours(h, m, 0, 0);
    if (period === 'daily') now.setDate(now.getDate() + 1);
    else if (period === 'weekly') now.setDate(now.getDate() + 7);
    else if (period === 'monthly') now.setMonth(now.getMonth() + 1);
    else now.setFullYear(now.getFullYear() + 1);
    return now.getTime();
  };

  const handleSave = async () => {
    if (!user || !formName || !formAmount) return;
    setIsSaving(true);
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setIsSaving(false); return; }

    let nextDate: number;
    if (formNextDate) {
      nextDate = getLocalDateTime(formNextDate, formTime);
    } else {
      nextDate = getDefaultNextDate(formPeriod);
    }

    const payload = {
      name: formName, amount, currency: selectedWallet?.currency ?? mainCurrency,
      period: formPeriod, nextDate, time: formTime,
      walletId: selectedWallet?.id ?? '', icon: formIcon, category: formCategory,
    };

    if (editingSub?.id) {
      await updateSubscription(dataOwnerId, editingSub.id, payload);
    } else {
      await addSubscription(dataOwnerId, { ...payload, createdAt: Date.now(), isActive: true });
    }
    resetForm();
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteSubscription(dataOwnerId, id);
    resetForm();
  };

  const handleEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setFormName(sub.name);
    setFormAmount(sub.amount.toString());
    setFormPeriod(sub.period);
    setFormIcon(sub.icon);
    setFormCategory(sub.category);
    setFormTime(sub.time || '09:00');
    setFormWalletId(sub.walletId || mainWallet?.id || null);
    setFormNextDate(getLocalDateInputValue(sub.nextDate));
    setIsAdding(true);
  };

  const monthlyCost = subscriptions.filter(s => s.isActive).reduce((acc, sub) => {
    let monthly = sub.amount;
    if (sub.period === 'daily') monthly *= 30.44;
    else if (sub.period === 'weekly') monthly *= 4.33;
    else if (sub.period === 'yearly') monthly /= 12;
    return acc + convertToMain(monthly, (sub.currency || 'EUR') as Currency);
  }, 0);

  // ─── styles ────────────────────────────────────────────────────────────────

  const S = {
    wrap: {
      padding: '0 0 80px',
    } as React.CSSProperties,

    summaryCard: {
      background: 'linear-gradient(135deg, var(--apple-surface-1) 0%, var(--apple-surface-2) 100%)',
      borderRadius: '20px', padding: '20px', marginBottom: '12px',
      border: '1px solid var(--apple-surface-3)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    } as React.CSSProperties,

    addBtn: {
      width: '100%', padding: '14px', marginBottom: '16px',
      background: 'var(--apple-surface-1)',
      border: '1.5px dashed var(--apple-surface-3)', borderRadius: '16px',
      color: 'var(--apple-blue)', fontWeight: 600, fontSize: '15px', cursor: 'pointer',
    } as React.CSSProperties,

    formCard: {
      background: 'var(--apple-surface-1)', borderRadius: '20px',
      padding: '18px', marginBottom: '16px',
      display: 'flex', flexDirection: 'column', gap: '14px',
    } as React.CSSProperties,

    label: {
      fontSize: '11px', color: 'var(--apple-text-on-dark-secondary)',
      fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px',
      marginBottom: '6px', display: 'block',
    } as React.CSSProperties,

    input: {
      width: '100%', padding: '12px 14px',
      background: 'var(--apple-surface-2)', border: 'none',
      borderRadius: '12px', color: 'var(--text-primary)',
      fontSize: '15px', fontFamily: 'var(--font-text)', outline: 'none',
      boxSizing: 'border-box' as const,
    } as React.CSSProperties,

    pill: (active: boolean) => ({
      flex: 1, padding: '9px 6px', border: 'none', borderRadius: '10px',
      background: active ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
      color: active ? '#fff' : 'var(--text-primary)',
      fontWeight: 600, fontSize: '13px', cursor: 'pointer', textAlign: 'center' as const,
      transition: 'background 0.15s',
    }) as React.CSSProperties,

    subRow: {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '13px 14px', background: 'var(--apple-surface-1)',
      borderRadius: '14px', cursor: 'pointer',
    } as React.CSSProperties,

    iconBox: {
      width: '42px', height: '42px', borderRadius: '12px',
      background: 'var(--apple-surface-2)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: '20px', flexShrink: 0,
    } as React.CSSProperties,
  };

  return (
    <div style={S.wrap}>

      {/* Summary */}
      <div style={S.summaryCard}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--apple-text-on-dark-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            На місяць
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {formatValue(monthlyCost)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--apple-blue)' }}>
            {subscriptions.filter(s => s.isActive).length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--apple-text-on-dark-tertiary)' }}>платежів</div>
        </div>
      </div>

      {/* Add button */}
      {!isAdding && (
        <button style={S.addBtn} onClick={() => { resetForm(); setIsAdding(true); }}>
          + Додати повторне списання
        </button>
      )}

      {/* Form */}
      {isAdding && (
        <div style={S.formCard}>
          {/* Form header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 700 }}>
              {editingSub ? 'Редагувати' : 'Новий платіж'}
            </span>
            <button onClick={resetForm}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--apple-text-on-dark-tertiary)', fontSize: '20px', lineHeight: 1, padding: '4px' }}>
              ✕
            </button>
          </div>

          {/* Icon + Name */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text" value={formIcon} onChange={e => setFormIcon(e.target.value)}
              style={{ width: '50px', height: '50px', textAlign: 'center', fontSize: '22px', background: 'var(--apple-surface-2)', border: 'none', borderRadius: '12px', flexShrink: 0 }}
            />
            <input
              type="text" value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="Назва платежу"
              style={{ ...S.input, flex: 1, width: 'auto' }}
            />
          </div>

          {/* Amount + Currency always visible */}
          <div>
            <span style={S.label}>Сума</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text" inputMode="decimal"
                  value={formAmount}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                    if (v.split('.').length <= 2) setFormAmount(v);
                  }}
                  placeholder="0.00"
                  style={{ ...S.input, fontSize: '22px', fontWeight: 700, textAlign: 'center', paddingRight: '52px' }}
                />
                <span style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '16px', fontWeight: 700, color: 'var(--apple-blue)',
                  pointerEvents: 'none',
                }}>
                  {currSym}
                </span>
              </div>
            </div>
          </div>

          {/* Wallet */}
          <div>
            <span style={S.label}>Гаманець</span>
            <WalletButton
              wallet={selectedWallet}
              onClick={() => setWalletPickerOpen(true)}
              placeholder="Оберіть гаманець"
            />
          </div>

          {/* Period */}
          <div>
            <span style={S.label}>Частота</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {ALL_PERIODS.map(p => (
                <button key={p} onClick={() => setFormPeriod(p)} style={S.pill(formPeriod === p)}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 3 }}>
              <span style={S.label}>Перша дата</span>
              <input type="date" value={formNextDate} onChange={e => setFormNextDate(e.target.value)}
                style={{ ...S.input, colorScheme: 'dark' }} />
            </div>
            <div style={{ flex: 2 }}>
              <span style={S.label}>Час</span>
              <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)}
                style={{ ...S.input, colorScheme: 'dark' }} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            {editingSub && (
              <button onClick={() => editingSub?.id && handleDelete(editingSub.id)}
                style={{ flex: 1, padding: '13px', border: 'none', borderRadius: '12px', background: 'rgba(255,69,58,0.12)', color: '#ff453a', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                Видалити
              </button>
            )}
            <button onClick={handleSave} disabled={isSaving || !formName || !formAmount}
              style={{ flex: 2, padding: '13px', border: 'none', borderRadius: '12px', background: 'var(--apple-blue)', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', opacity: (!formName || !formAmount) ? 0.45 : 1 }}>
              {isSaving ? 'Збереження...' : editingSub ? 'Зберегти' : 'Додати'}
            </button>
          </div>
        </div>
      )}

      {walletPickerOpen && (
        <WalletPicker
          wallets={wallets}
          selectedId={selectedWallet?.id ?? null}
          onSelect={(w) => setFormWalletId(w.id!)}
          onClose={() => setWalletPickerOpen(false)}
        />
      )}

      {/* Active subscriptions */}
      {subscriptions.filter(s => s.isActive).length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-secondary)', fontWeight: 600, marginBottom: '8px' }}>
            Активні
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {subscriptions.filter(s => s.isActive).map(sub => {
              const { label, urgent } = getDaysUntil(sub.nextDate);
              return (
                <div key={sub.id} style={S.subRow} onClick={() => handleEdit(sub)}>
                  <div style={S.iconBox}>{sub.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{sub.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--apple-text-on-dark-tertiary)', marginTop: '2px' }}>
                      {PERIOD_LABELS[sub.period]}
                      {sub.time ? ` · ${sub.time}` : ''}
                      {sub.walletId ? ` · ${getWalletLabel(sub.walletId)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatValue(sub.amount, sub.currency as Currency)}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: urgent ? '#ff9f0a' : 'var(--apple-text-on-dark-tertiary)', marginTop: '2px' }}>
                      {label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Presets */}
      {!isAdding && (
        <div>
          <div style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-secondary)', fontWeight: 600, marginBottom: '8px' }}>
            Популярні сервіси
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {PRESET_SUBSCRIPTIONS
              .filter(p => !subscriptions.some(s => s.name === p.name))
              .map(preset => (
                <div key={preset.name} onClick={() => handleSelectPreset(preset)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 12px', background: 'var(--apple-surface-1)',
                    borderRadius: '13px', cursor: 'pointer',
                  }}>
                  <span style={{ fontSize: '18px' }}>{preset.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--apple-text-on-dark-tertiary)' }}>
                      ~{presetAmount(preset.amount).toFixed(0)} {ALL_CURRENCY_SYMBOLS[presetCurrency]}/міс
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
