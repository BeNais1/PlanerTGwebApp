import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { updateUserSettings, addWalletBalance, deleteWalletData, getCurrentMonth, subscribeToUserSettings, deleteUserAccount, type UserSettings } from '../../services/database';
import { AnimatedNumber } from '../AnimatedNumber';
import { NumericKeypad, getKeypadNumericValue } from '../NumericKeypad';
import './Modals.css';

interface SettingsModalProps {
  onClose: () => void;
  walletBalances: Record<string, number>;
}

export const SettingsModal = ({ onClose, walletBalances }: SettingsModalProps) => {
  const { user } = useAuth();
  const { currency, walletNames, CURRENCY_SYMBOLS, EXCHANGE_RATES, formatValue } = useCurrency();
  const { categories, addCategory, removeCategory, restoreCategory, hiddenCategoryIds, defaultCategories } = useCategories();
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [newWalletCurrency, setNewWalletCurrency] = useState<Currency>('USD');
  const [newWalletAmount, setNewWalletAmount] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallets' | 'categories' | 'limits' | 'theme'>('wallets');
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('app-theme') as 'dark' | 'light') || 'dark'
  );
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [limitInput, setLimitInput] = useState('');
  const [limitIncludePriorInput, setLimitIncludePriorInput] = useState(true);
  const [budgetLimitPeriod, setBudgetLimitPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [limitPeriodInput, setLimitPeriodInput] = useState<'day' | 'week' | 'month'>('month');

  // Category add form
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [newCatColor, setNewCatColor] = useState('#007AFF');

  // Load budget limit
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserSettings(user.id, (settings: UserSettings) => {
      setBudgetLimit(settings.budgetLimit || 0);
      setBudgetLimitPeriod(settings.budgetLimitPeriod || 'month');
      setLimitPeriodInput(settings.budgetLimitPeriod || 'month');
    });
    return () => unsub();
  }, [user]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

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

  const handleAddCategory = async () => {
    if (!newCatName) return;
    await addCategory({
      id: `custom_${Date.now()}`,
      name: newCatName,
      icon: newCatIcon,
      color: newCatColor,
    });
    setNewCatName('');
    setNewCatIcon('📌');
    setNewCatColor('#007AFF');
    setIsAddingCategory(false);
  };

  const handleSetLimit = async () => {
    if (!user) return;
    const num = getKeypadNumericValue(limitInput);
    if (num > 0) {
      await updateUserSettings(user.id, { 
        budgetLimit: num,
        budgetLimitPeriod: limitPeriodInput,
        budgetLimitIncludePrior: limitIncludePriorInput,
        budgetLimitStartDate: limitIncludePriorInput ? null : Date.now()
      } as any);
      setLimitInput('');
    }
  };

  const handleRemoveLimit = async () => {
    if (!user) return;
    await updateUserSettings(user.id, { budgetLimit: 0 });
  };

  const availableWallets = Object.keys(walletBalances) as Currency[];
  const ALL_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

  const convertDirect = (amount: number, from: Currency, to: Currency) => {
    const inEur = amount / EXCHANGE_RATES[from];
    return inEur * EXCHANGE_RATES[to];
  };

  const totalEur = Object.entries(walletBalances).reduce((acc, [cur, amt]) => {
    return acc + (amt / EXCHANGE_RATES[cur as Currency]);
  }, 0);
  const totalUsd = totalEur * EXCHANGE_RATES['USD'];
  const totalUah = totalEur * EXCHANGE_RATES['UAH'];

  const hiddenDefaults = defaultCategories.filter(c => hiddenCategoryIds.includes(c.id));

  const handleThemeChange = async (newTheme: 'dark' | 'light') => {
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);

    // Update Telegram header colors
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        const headerColor = newTheme === 'light' ? '#F2F2F7' : '#000000';
        const bgColor = newTheme === 'light' ? '#F2F2F7' : '#000000';
        if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
        if (tg.setBackgroundColor) tg.setBackgroundColor(bgColor);
      }
    } catch (e) { /* ignore */ }

    // Save to Firebase
    if (user) {
      await updateUserSettings(user.id, { theme: newTheme });
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    const message = 'Ви впевнені, що хочете видалити свій акаунт та всі дані? Це неможливо буде скасувати.';
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.showConfirm) {
        tg.showConfirm(message, async (confirmed: boolean) => {
          if (confirmed) {
            await deleteUserAccount(user.id);
            localStorage.clear();
            window.location.reload();
          }
        });
      } else {
        if (window.confirm(message)) {
          deleteUserAccount(user.id).then(() => {
            localStorage.clear();
            window.location.reload();
          });
        }
      }
    } catch (e) {
      console.error(e);
      if (window.confirm(message)) {
        deleteUserAccount(user.id).then(() => {
          localStorage.clear();
          window.location.reload();
        });
      }
    }
  };

  const tabItems = [
    { id: 'wallets' as const, label: 'Гаманці' },
    { id: 'limits' as const, label: 'Ліміт' },
    { id: 'categories' as const, label: 'Категорії' },
    { id: 'theme' as const, label: 'Тема' },
  ];

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content settings-modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Налаштування</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg-2)', borderRadius: '14px', padding: '3px' }}>
          {tabItems.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: '11px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--card-bg-3)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                transition: 'all 0.2s ease',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'wallets' ? (
          <>
            {/* Total Summary Block */}
            <div style={{ flexShrink: 0, background: 'linear-gradient(135deg, var(--card-bg-2) 0%, var(--card-bg-3) 100%)', borderRadius: '20px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, display: 'block', marginBottom: '16px' }}>
                Загальний баланс
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>В Євро</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    <AnimatedNumber value={totalEur} formatter={(v) => `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS['EUR']}`} />
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>В Доларах</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    <AnimatedNumber value={totalUsd} formatter={(v) => `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS['USD']}`} />
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>В Гривні</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    <AnimatedNumber value={totalUah} formatter={(v) => `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS['UAH']}`} />
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-input-group" style={{ flexShrink: 0, marginTop: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {availableWallets.map((c) => {
                  const amount = walletBalances[c] || 0;
                  const displayName = walletNames[c] || `Гаманець ${c}`;
                  const otherCurrencies = ALL_CURRENCIES.filter(curr => curr !== c);
                  const isMain = c === currency;

                  return (
                    <div key={c} style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'var(--card-bg-2)', borderRadius: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        {editingWallet === c ? (
                          <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '10px' }}>
                            <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)}
                              style={{ flex: 1, padding: '4px 8px', borderRadius: '8px', border: 'none', background: 'var(--card-bg-3)', color: 'var(--text-primary)', outline: 'none' }} autoFocus />
                            <button onClick={() => handleSaveName(c)} style={{ background: 'var(--accent)', color: 'var(--text-primary)', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '13px' }}>✓</button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {displayName}
                            <button onClick={() => { setEditingWallet(c); setEditingName(displayName); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '14px' }}>✎</button>
                          </span>
                        )}
                        {walletToDelete === c ? (
                          <button onClick={() => handleDeleteWallet(c)} style={{ background: 'var(--danger)', color: 'var(--text-primary)', border: 'none', borderRadius: '8px', padding: '4px 10px', fontWeight: 'bold', fontSize: '12px' }}>
                            Видалити
                          </button>
                        ) : (
                          <button onClick={() => setWalletToDelete(c)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 4px', fontSize: '14px' }}>✕</button>
                        )}
                      </div>

                      <div style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                        {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[c]}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          {otherCurrencies.map(otherC => (
                            <span key={otherC} style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                              ≈ {convertDirect(amount, c, otherC).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[otherC]}
                            </span>
                          ))}
                        </div>
                        {isMain ? (
                          <span style={{ color: '#FFD700', fontSize: '11px', fontWeight: 600, background: 'rgba(255,215,0,0.1)', padding: '3px 8px', borderRadius: '8px' }}>
                            ⭐️ Головний
                          </span>
                        ) : (
                          <button onClick={() => handleCurrencyChange(c)}
                            style={{ color: 'var(--accent)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                            Головний
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!isAddingWallet ? (
                  <button onClick={() => setIsAddingWallet(true)}
                    style={{ padding: '14px', background: 'none', border: '1px dashed var(--card-bg-3)', borderRadius: '16px', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
                    + Додати гаманець
                  </button>
                ) : (
                  <div style={{ background: 'var(--card-bg-3)', padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <select value={newWalletCurrency} onChange={(e) => setNewWalletCurrency(e.target.value as Currency)}
                        style={{ background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none' }}>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="UAH">UAH</option>
                      </select>
                      <input type="number" placeholder="Сума" value={newWalletAmount} onChange={(e) => setNewWalletAmount(e.target.value)}
                        style={{ flex: 1, background: 'var(--card-bg-2)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '10px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setIsAddingWallet(false)} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-2)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer' }}>Скасувати</button>
                      <button onClick={handleAddWallet} disabled={!newWalletAmount} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Додати</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'limits' ? (
          /* Budget Limit Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--card-bg-2)', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🫧</div>
              {budgetLimit > 0 ? (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '8px' }}>
                    Поточний ліміт
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px' }}>
                    {formatValue(budgetLimit)}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    на {budgetLimitPeriod === 'day' ? 'день' : budgetLimitPeriod === 'week' ? 'тиждень' : 'місяць'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Ліміт не встановлено
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Встановіть ліміт, щоб відстежувати витрати з бульбашкою
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '4px' }}>
                {budgetLimit > 0 ? 'Змінити ліміт' : 'Встановити ліміт'}
              </label>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card-bg-2)', borderRadius: '14px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>Враховувати минулі витрати</span>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={limitIncludePriorInput} 
                    onChange={(e) => setLimitIncludePriorInput(e.target.checked)} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {(['day', 'week', 'month'] as const).map(period => (
                  <button key={period} onClick={() => setLimitPeriodInput(period)} style={{
                    flex: 1, padding: '10px 0', border: 'none', borderRadius: '12px',
                    background: limitPeriodInput === period ? 'var(--accent)' : 'var(--card-bg-2)',
                    color: limitPeriodInput === period ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease'
                  }}>
                    {period === 'day' ? 'День' : period === 'week' ? 'Тиждень' : 'Місяць'}
                  </button>
                ))}
              </div>

              <NumericKeypad
                value={limitInput}
                onChange={setLimitInput}
                currencySymbol={CURRENCY_SYMBOLS[currency]}
                onSubmit={handleSetLimit}
                submitLabel={budgetLimit > 0 ? 'Оновити' : 'Встановити'}
              />

              {budgetLimit > 0 && (
                <button
                  onClick={handleRemoveLimit}
                  style={{
                    padding: '12px', border: 'none', borderRadius: '14px',
                    background: 'var(--card-bg-2)', color: 'var(--danger)',
                    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  Прибрати ліміт
                </button>
              )}
            </div>
          </div>
        ) : activeTab === 'categories' ? (
          /* Categories Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Active categories */}
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Активні категорії
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                  background: 'var(--card-bg-2)', borderRadius: '14px',
                }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                  <span style={{ flex: 1, fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{cat.name}</span>
                  {cat.isCustom && (
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--card-bg-3)', padding: '2px 8px', borderRadius: '6px' }}>Власна</span>
                  )}
                  <button onClick={() => removeCategory(cat.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0 4px', fontSize: '14px' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Hidden default categories */}
            {hiddenDefaults.length > 0 && (
              <>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '8px' }}>
                  Приховані категорії
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {hiddenDefaults.map(cat => (
                    <div key={cat.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                      background: 'var(--card-bg-2)', borderRadius: '14px', opacity: 0.6,
                    }}>
                      <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                      <span style={{ flex: 1, fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{cat.name}</span>
                      <button onClick={() => restoreCategory(cat.id)}
                        style={{ background: 'var(--accent)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>
                        Повернути
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Add custom category */}
            {isAddingCategory ? (
              <div style={{ background: 'var(--card-bg-2)', padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="text" value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)}
                    style={{ width: '42px', height: '42px', textAlign: 'center', fontSize: '20px', background: 'var(--card-bg-3)', border: 'none', borderRadius: '12px', color: 'var(--text-primary)' }} />
                  <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Назва категорії" autoFocus
                    style={{ flex: 1, padding: '10px', background: 'var(--card-bg-3)', border: 'none', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['#FF9500', '#007AFF', '#34C759', '#AF52DE', '#FF2D55', '#FF3B30', '#5856D6', '#5AC8FA', '#A2845E', '#8E8E93'].map(color => (
                    <button key={color} onClick={() => setNewCatColor(color)}
                      style={{
                        width: '30px', height: '30px', borderRadius: '50%', background: color, border: newCatColor === color ? '3px solid white' : '3px solid transparent',
                        cursor: 'pointer', transition: 'border 0.2s ease',
                      }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsAddingCategory(false)}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--card-bg-3)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer' }}>
                    Скасувати
                  </button>
                  <button onClick={handleAddCategory} disabled={!newCatName}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: newCatName ? 1 : 0.4 }}>
                    Створити
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAddingCategory(true)}
                style={{ padding: '12px', background: 'none', border: '1px dashed var(--card-bg-3)', borderRadius: '14px', color: 'var(--accent)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                + Створити категорію
              </button>
            )}
          </div>
        ) : (
          /* Theme Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--card-bg-2)', borderRadius: '20px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                {currentTheme === 'dark' ? '🌙' : '☀️'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {currentTheme === 'dark' ? 'Темна тема' : 'Світла тема'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Натисніть для перемикання
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                onClick={() => handleThemeChange('dark')}
                style={{
                  padding: '20px 16px',
                  background: currentTheme === 'dark' ? 'var(--accent-dim)' : 'var(--card-bg-2)',
                  border: currentTheme === 'dark' ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.25s ease',
                }}
              >
                <span style={{ fontSize: '32px' }}>🌙</span>
                <div style={{
                  width: '100%', padding: '12px', borderRadius: '12px',
                  background: '#1e1e22', display: 'flex', flexDirection: 'column' as const, gap: '6px'
                }}>
                  <div style={{ height: '6px', width: '60%', borderRadius: '3px', background: '#2a2a2e' }} />
                  <div style={{ height: '6px', width: '40%', borderRadius: '3px', background: '#141416' }} />
                  <div style={{ height: '6px', width: '50%', borderRadius: '3px', background: '#2a2a2e' }} />
                </div>
                <span style={{
                  fontSize: '14px', fontWeight: 600,
                  color: currentTheme === 'dark' ? 'var(--accent)' : 'var(--text-secondary)',
                }}>Темна</span>
              </div>

              <div
                onClick={() => handleThemeChange('light')}
                style={{
                  padding: '20px 16px',
                  background: currentTheme === 'light' ? 'var(--accent-dim)' : 'var(--card-bg-2)',
                  border: currentTheme === 'light' ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.25s ease',
                }}
              >
                <span style={{ fontSize: '32px' }}>☀️</span>
                <div style={{
                  width: '100%', padding: '12px', borderRadius: '12px',
                  background: '#F2F2F7', display: 'flex', flexDirection: 'column' as const, gap: '6px'
                }}>
                  <div style={{ height: '6px', width: '60%', borderRadius: '3px', background: '#E5E5EA' }} />
                  <div style={{ height: '6px', width: '40%', borderRadius: '3px', background: '#FFFFFF' }} />
                  <div style={{ height: '6px', width: '50%', borderRadius: '3px', background: '#E5E5EA' }} />
                </div>
                <span style={{
                  fontSize: '14px', fontWeight: 600,
                  color: currentTheme === 'light' ? 'var(--accent)' : 'var(--text-secondary)',
                }}>Світла</span>
              </div>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--card-bg-3)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Якщо ви хочете почати з нуля, ви можете видалити всі свої дані та налаштування.
              </span>
              <button
                onClick={handleDeleteAccount}
                style={{
                  padding: '14px 24px',
                  background: 'rgba(255, 59, 48, 0.1)',
                  color: 'var(--danger)',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background 0.2s ease',
                }}
              >
                Видалити акаунт
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
