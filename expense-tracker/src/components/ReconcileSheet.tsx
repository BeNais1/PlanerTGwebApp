import { useState } from 'react';
import { reconcileWallet, type Wallet } from '../services/database';
import { useFamilyBudget } from '../context/useFamilyBudget';
import { useCurrency, type Currency } from '../hooks/useCurrency';

export function ReconcileSheet({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const { dataOwnerId } = useFamilyBudget();
  const { formatValue } = useCurrency();
  const [expected] = useState(wallet.balance || 0);
  const [actual, setActual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const value = Number(actual.replace(',', '.'));
  const valid = actual.trim() !== '' && Number.isFinite(value);
  const difference = Math.round((value - expected) * 100) / 100;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await reconcileWallet(dataOwnerId, wallet.id!, expected, value); onClose(); }
    catch { setError('Не вдалося звірити баланс. Якщо він змінився, закрийте вікно та відкрийте знову.'); setBusy(false); }
  };
  return <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="modal-content utility-sheet" role="dialog" aria-modal="true" aria-label="Звірка балансу">
    <div className="modal-header"><h2>Звірка балансу</h2><button className="modal-close" disabled={busy} onClick={onClose} aria-label="Закрити">×</button></div>
    <p>{wallet.name} · {formatValue(expected, wallet.currency as Currency)}</p>
    <label>Фактичний залишок<input autoFocus className="modal-input" inputMode="decimal" value={actual} onChange={event => setActual(event.target.value)} placeholder="0,00" /></label>
    {valid && <p>Різниця: {difference > 0 ? '+' : ''}{formatValue(difference, wallet.currency as Currency)}</p>}
    <p className="field-hint">Різницю збережемо окремою операцією «Звірка балансу».</p>
    {error && <p role="alert" className="field-error">{error}</p>}
    <button type="button" className="primary-action" disabled={!valid || busy} onClick={save}>{busy ? 'Зберігаємо…' : difference === 0 ? 'Баланс збігається' : 'Підтвердити'}</button>
  </section></div>;
}
