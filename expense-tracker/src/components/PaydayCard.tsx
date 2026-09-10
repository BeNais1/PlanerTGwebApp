import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useFamilyBudget } from '../context/useFamilyBudget';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import { subscribeToUserSettings, updateUserSettings, type PaydaySettings, type Wallet } from '../services/database';
import { convertCurrency } from '../domain/currency';
import { paydayBudget } from '../domain/planning';

export function PaydayCard({ wallets }: { wallets: Wallet[] }) {
  const { user } = useAuth();
  const { dataOwnerId, isFamily, activeSpace } = useFamilyBudget();
  const { currency, formatValue, EXCHANGE_RATES } = useCurrency();
  const [settings, setSettings] = useState<PaydaySettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [reserve, setReserve] = useState('0');
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [today, setToday] = useState(() => new Date());
  const canEdit = !isFamily || activeSpace.role !== 'member';
  useEffect(() => {
    if (!user || !dataOwnerId) return;
    return subscribeToUserSettings(dataOwnerId, value => setSettings(value.payday || null));
  }, [dataOwnerId, user]);
  useEffect(() => { const timer = window.setInterval(() => setToday(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  const planCurrency = (settings?.currency || currency) as Currency;
  const selected = wallets.filter(wallet => settings?.walletIds?.includes(wallet.id!));
  const balance = selected.reduce((sum, wallet) => sum + convertCurrency(wallet.balance || 0, wallet.currency as Currency, planCurrency, EXCHANGE_RATES), 0);
  const plan = settings ? paydayBudget(balance, settings.reserve, settings.date, today) : null;
  const open = () => {
    setDate(settings?.date || ''); setReserve(String(settings?.reserve || 0));
    setWalletIds(settings?.walletIds || wallets.map(wallet => wallet.id!));
    setError(''); setEditing(true);
  };
  const save = async () => {
    const value = Number(reserve.replace(',', '.'));
    const valid = paydayBudget(0, value, date);
    if (!valid || valid.days <= 0 || !walletIds.some(id => wallets.some(wallet => wallet.id === id))) { setError('Оберіть майбутню дату, гаманець і невід’ємний резерв.'); return; }
    setBusy(true); setError('');
    try { await updateUserSettings(dataOwnerId, { payday: { date, reserve: value, currency: planCurrency, walletIds } }); setEditing(false); }
    catch { setError('Не вдалося зберегти. Спробуйте ще раз.'); }
    finally { setBusy(false); }
  };
  return <section className="payday-card">
    {settings ? <div className="payday-summary"><div><span>До зарплати</span><strong>{!selected.length ? 'Оберіть гаманець' : plan && plan.days > 0 ? `${formatValue(plan.daily, planCurrency)} / день` : 'Оновіть дату'}</strong><small>{plan && plan.days > 0 ? `${plan.days} дн. · ${settings.date.split('-').reverse().join('.')}` : 'Дата виплати настала'}</small></div>{canEdit && <button type="button" className="quiet-action" onClick={open}>Змінити</button>}</div> : canEdit && <button type="button" className="quiet-action" onClick={open}>До зарплати · Налаштувати</button>}
    {editing && <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget && !busy) setEditing(false); }}><section className="modal-content utility-sheet" role="dialog" aria-modal="true" aria-label="До зарплати">
      <div className="modal-header"><h2>До зарплати</h2><button className="modal-close" disabled={busy} onClick={() => setEditing(false)} aria-label="Закрити">×</button></div>
      <label>Дата виплати<input className="modal-input" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Резерв, {planCurrency}<input className="modal-input" inputMode="decimal" value={reserve} onChange={event => setReserve(event.target.value)} /></label>
      <p className="field-hint">Резерв — сума на обов’язкові платежі. Решту ділимо на дні до виплати.</p>
      <fieldset><legend>Враховувати гаманці</legend>{wallets.map(wallet => <label className="choice-row" key={wallet.id}><input type="checkbox" checked={walletIds.includes(wallet.id!)} onChange={event => setWalletIds(ids => event.target.checked ? [...ids, wallet.id!] : ids.filter(id => id !== wallet.id))} />{wallet.name}</label>)}</fieldset>
      {error && <p role="alert" className="field-error">{error}</p>}
      {settings && <button type="button" className="quiet-action" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await updateUserSettings(dataOwnerId, { payday: null }); setEditing(false); }
        catch { setError('Не вдалося вимкнути режим. Спробуйте ще раз.'); }
        finally { setBusy(false); }
      }}>Вимкнути режим</button>}
      <button type="button" className="primary-action" disabled={busy} onClick={save}>{busy ? 'Зберігаємо…' : 'Зберегти'}</button>
    </section></div>}
  </section>;
}
