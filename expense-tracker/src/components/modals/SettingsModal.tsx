import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { updateUserSettings, addWalletBalance, deleteWalletData, getCurrentMonth } from '../../services/database';
import './Modals.css';

interface SettingsModalProps {
  onClose: () => void;
  walletBalances: Record<string, number>;
}

export const SettingsModal = ({ onClose, walletBalances }: SettingsModalProps) => {
  const { user } = useAuth();
  const { currency, walletNames, CURRENCY_SYMBOLS, EXCHANGE_RATES } = useCurrency();
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [newWalletCurrency, setNewWalletCurrency] = useState<Currency>('USD');
  const [newWalletAmount, setNewWalletAmount] = useState('');

  const handleCurrencyChange = async (newCurrency: Currency) => {
    if (!user) return;
    await updateUserSettings(user.id, { currency: newCurrency });
  };

  const [walletToDelete, setWalletToDelete] = useState<Currency | null>(null);
  const [editingWallet, setEditingWallet] = useState<Currency | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAddWallet = async () => {
    if (!user || !newWalletAmount) return;
    const amount = parseFloat(newWalletAmount);
    if (!isNaN(amount) && amount > 0) {
      await addWalletBalance(user.id, getCurrentMonth(), newWalletCurrency, amount);
      setIsAddingWallet(false);
      setNewWalletAmount('');
    }
  };

  const handleDeleteWallet = async (c: Currency) => {
    if (!user) return;
    await deleteWalletData(user.id, getCurrentMonth(), c);
    setWalletToDelete(null);
  }

  const handleSaveName = async (c: Currency) => {
    if (!user) return;
    const newNames = { ...walletNames, [c]: editingName };
    await updateUserSettings(user.id, { walletNames: newNames });
    setEditingWallet(null);
  }

  const availableWallets = Object.keys(walletBalances) as Currency[];
  const ALL_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

  // Conversion helper for one string to another directly across exchange rates
  const convertDirect = (amount: number, from: Currency, to: Currency) => {
    const inEur = amount / EXCHANGE_RATES[from];
    return inEur * EXCHANGE_RATES[to];
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content settings-modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Настройки Кошельков</h2>
          <div className="modal-close" onClick={onClose}>✕</div>
        </div>

        <div className="modal-input-group" style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {availableWallets.map((c) => {
              const amount = walletBalances[c] || 0;
              const displayName = walletNames[c] || `Кошелек ${c}`;
              const otherCurrencies = ALL_CURRENCIES.filter(curr => curr !== c);
              const isMain = c === currency;

              return (
                <div key={c} style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'var(--apple-surface-2)', borderRadius: 'var(--radius-lg)' }}>
                  
                  {/* Header / Name */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    {editingWallet === c ? (
                      <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '10px' }}>
                        <input 
                          type="text" 
                          value={editingName} 
                          onChange={e => setEditingName(e.target.value)} 
                          style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: 'none', background: 'var(--apple-surface-3)', color: 'white' }}
                          autoFocus
                        />
                        <button onClick={() => handleSaveName(c)} style={{ background: 'var(--apple-blue)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px' }}>✓</button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {displayName}
                        <button onClick={() => { setEditingWallet(c); setEditingName(displayName); }} style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', cursor: 'pointer', padding: 0 }}>✎</button>
                      </span>
                    )}

                    {walletToDelete === c ? (
                      <button onClick={() => handleDeleteWallet(c)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontWeight: 'bold' }}>
                        Да, удалить
                      </button>
                    ) : (
                      <button onClick={() => setWalletToDelete(c)} style={{ background: 'none', border: 'none', color: 'var(--apple-text-on-dark-tertiary)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                    )}
                  </div>

                  {/* Big Balance */}
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
                    {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[c]}
                  </div>
                  
                  {/* Converted Balance & Main Wallet Set */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {otherCurrencies.map(otherC => (
                        <span key={otherC} style={{ color: 'var(--apple-text-on-dark-secondary)', fontSize: '14px' }}>
                          ≈ {convertDirect(amount, c, otherC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[otherC]}
                        </span>
                      ))}
                    </div>

                    {isMain ? (
                      <span style={{ color: '#FFD700', fontSize: '12px', fontWeight: 600, background: 'rgba(255,215,0,0.1)', padding: '4px 8px', borderRadius: '12px' }}>
                        ⭐️ Главный
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleCurrencyChange(c)}
                        style={{ color: 'var(--apple-blue)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Сделать главным
                      </button>
                    )}
                  </div>

                </div>
              );
            })}

            {!isAddingWallet ? (
              <button 
                onClick={() => setIsAddingWallet(true)}
                style={{ padding: '12px', background: 'var(--apple-surface-3)', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--apple-blue)', fontWeight: 600, cursor: 'pointer' }}
              >
                ➕ Добавить кошелек
              </button>
            ) : (
              <div style={{ background: 'var(--apple-surface-3)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    value={newWalletCurrency} 
                    onChange={(e) => setNewWalletCurrency(e.target.value as Currency)}
                    style={{ background: 'var(--apple-surface-2)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px', outline: 'none' }}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="UAH">UAH</option>
                  </select>
                  <input 
                    type="number" 
                    placeholder="Сумма" 
                    value={newWalletAmount}
                    onChange={(e) => setNewWalletAmount(e.target.value)}
                    style={{ flex: 1, background: 'var(--apple-surface-2)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '10px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setIsAddingWallet(false)} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--apple-surface-2)', color: 'var(--apple-text-on-dark)' }}>Отмена</button>
                  <button onClick={handleAddWallet} disabled={!newWalletAmount} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--apple-blue)', color: 'white' }}>Добавить</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
