import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import { useCategories } from '../../hooks/useCategories';
import { subscribeToSettings, updateUserSettings, incrementVendorUsage, type UserSettings, type CustomVendor } from '../../services/database';
import './Modals.css';

interface QuickSpendModalProps {
  onClose: () => void;
  onSpend: (amount: number, category: string, description: string, currency: Currency) => void;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  icon: string;
  isCustom?: boolean;
}

const DEFAULT_VENDORS: Vendor[] = [
  // Food & Drink
  { id: 'mcdonalds', name: "McDonald's", category: 'food', icon: '🍔' },
  { id: 'kfc', name: 'KFC', category: 'food', icon: '🍗' },
  { id: 'starbucks', name: 'Starbucks', category: 'food', icon: '☕' },
  { id: 'pizza', name: 'Pizza', category: 'food', icon: '🍕' },
  { id: 'sushi', name: 'Суші', category: 'food', icon: '🍣' },
  { id: 'subway', name: 'Subway', category: 'food', icon: '🥪' },
  { id: 'burgerking', name: 'Burger King', category: 'food', icon: '🍔' },
  // Delivery
  { id: 'glovo', name: 'Glovo', category: 'food', icon: '🛵' },
  { id: 'bolt_food', name: 'Bolt Food', category: 'food', icon: '⚡' },
  { id: 'wolt', name: 'Wolt', category: 'food', icon: '🔵' },
  { id: 'ubereats', name: 'Uber Eats', category: 'food', icon: '🍽️' },
  // Groceries
  { id: 'silpo', name: 'Сільпо', category: 'food', icon: '🛒' },
  { id: 'atb', name: 'АТБ', category: 'food', icon: '🏪' },
  { id: 'lidl', name: 'Lidl', category: 'food', icon: '🛒' },
  { id: 'aldi', name: 'Aldi', category: 'food', icon: '🛒' },
  { id: 'costco', name: 'Costco', category: 'shopping', icon: '📦' },
  { id: 'walmart', name: 'Walmart', category: 'shopping', icon: '🏬' },
  { id: 'target', name: 'Target', category: 'shopping', icon: '🎯' },
  // Shopping
  { id: 'apple', name: 'Apple', category: 'shopping', icon: '🍎' },
  { id: 'amazon', name: 'Amazon', category: 'shopping', icon: '📦' },
  { id: 'zara', name: 'Zara', category: 'shopping', icon: '👔' },
  { id: 'hm', name: 'H&M', category: 'shopping', icon: '👗' },
  { id: 'nike', name: 'Nike', category: 'shopping', icon: '👟' },
  { id: 'adidas', name: 'Adidas', category: 'shopping', icon: '👟' },
  { id: 'ikea', name: 'IKEA', category: 'home', icon: '🪑' },
  { id: 'uniqlo', name: 'Uniqlo', category: 'shopping', icon: '🧥' },
  // Entertainment
  { id: 'netflix', name: 'Netflix', category: 'entertainment', icon: '🍿' },
  { id: 'spotify', name: 'Spotify', category: 'entertainment', icon: '🎵' },
  { id: 'steam', name: 'Steam', category: 'entertainment', icon: '🎮' },
  { id: 'cinema', name: 'Кіно', category: 'entertainment', icon: '🎬' },
  // Transport
  { id: 'uber', name: 'Uber', category: 'transport', icon: '🚗' },
  { id: 'bolt', name: 'Bolt', category: 'transport', icon: '⚡' },
  { id: 'fuel', name: 'Заправка', category: 'transport', icon: '⛽' },
  { id: 'parking', name: 'Паркування', category: 'transport', icon: '🅿️' },
  // Tech
  { id: 'microsoft', name: 'Microsoft', category: 'shopping', icon: '💻' },
  { id: 'google', name: 'Google', category: 'other', icon: '🔍' },
  // Health
  { id: 'pharmacy', name: 'Аптека', category: 'health', icon: '💊' },
  { id: 'gym', name: 'Спортзал', category: 'health', icon: '💪' },
];

export const QuickSpendModal = ({ onClose, onSpend, isLoading, walletBalances }: QuickSpendModalProps) => {
  const { user } = useAuth();
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue } = useCurrency();
  const { categories } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(mainCurrency);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [customVendors, setCustomVendors] = useState<CustomVendor[]>([]);
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorIcon, setNewVendorIcon] = useState('🛒');
  const [newVendorCategory, setNewVendorCategory] = useState('other');

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  // Load usage counts + custom vendors from settings
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToSettings(user.id, (settings: UserSettings | null) => {
      setUsageCounts(settings?.vendorUsageCounts || {});
      setCustomVendors(settings?.customVendors || []);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (walletBalances[mainCurrency] !== undefined) {
      setSelectedCurrency(mainCurrency);
    } else if (Object.keys(walletBalances).length > 0) {
      setSelectedCurrency(Object.keys(walletBalances)[0] as Currency);
    }
  }, [mainCurrency, walletBalances]);

  // Merge default + custom vendors, sort by usage frequency
  const allVendors = useMemo((): Vendor[] => {
    const customs: Vendor[] = customVendors.map(v => ({ ...v, isCustom: true }));
    const merged = [...DEFAULT_VENDORS, ...customs];
    // Sort: most used first, then alphabetical
    return merged.sort((a, b) => {
      const countA = usageCounts[a.id] || 0;
      const countB = usageCounts[b.id] || 0;
      if (countA !== countB) return countB - countA;
      return a.name.localeCompare(b.name);
    });
  }, [customVendors, usageCounts]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery) return allVendors.slice(0, 20); // Show top 20 by usage
    return allVendors.filter(v =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allVendors]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (val.split('.').length > 2) return;
    setAmount(val);
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setSelectedCategory(vendor.category);
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    const vendorName = selectedVendor ? selectedVendor.name : searchQuery;
    const category = selectedCategory || (selectedVendor ? selectedVendor.category : 'other');

    if (!isNaN(numAmount) && numAmount > 0 && vendorName) {
      // Track vendor usage
      if (user && selectedVendor) {
        incrementVendorUsage(user.id, selectedVendor.id);
      }
      onSpend(numAmount, category, vendorName, selectedCurrency);
    }
  };

  const handleAddCustomVendor = async () => {
    if (!user || !newVendorName) return;
    const newVendor: CustomVendor = {
      id: `custom_${Date.now()}`,
      name: newVendorName,
      icon: newVendorIcon,
      category: newVendorCategory,
    };
    const updated = [...customVendors, newVendor];
    await updateUserSettings(user.id, { customVendors: updated });
    setNewVendorName('');
    setNewVendorIcon('🛒');
    setNewVendorCategory('other');
    setIsAddingVendor(false);
    // Auto-select the newly added vendor
    handleSelectVendor(newVendor);
  };

  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Швидкий доступ</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        {!selectedVendor ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input
              type="text"
              className="modal-input"
              placeholder="Пошук магазину або компанії..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            {/* Custom Vendor Add Form */}
            {isAddingVendor ? (
              <div style={{ background: 'var(--apple-surface-2)', padding: '14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newVendorIcon}
                    onChange={(e) => setNewVendorIcon(e.target.value)}
                    style={{ width: '42px', height: '42px', textAlign: 'center', fontSize: '20px', background: 'var(--apple-surface-3)', border: 'none', borderRadius: '10px', color: 'white' }}
                  />
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="Назва"
                    autoFocus
                    style={{ flex: 1, padding: '10px', background: 'var(--apple-surface-3)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '15px', fontFamily: 'var(--font-text)', outline: 'none' }}
                  />
                </div>
                <select
                  value={newVendorCategory}
                  onChange={(e) => setNewVendorCategory(e.target.value)}
                  style={{ padding: '10px', background: 'var(--apple-surface-3)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsAddingVendor(false)}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', background: 'var(--apple-surface-3)', color: 'var(--apple-text-on-dark)', fontSize: '14px', cursor: 'pointer' }}>
                    Скасувати
                  </button>
                  <button onClick={handleAddCustomVendor} disabled={!newVendorName}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', background: 'var(--apple-blue)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: newVendorName ? 1 : 0.5 }}>
                    Додати
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAddingVendor(true)}
                style={{ padding: '12px', background: 'none', border: '1px dashed var(--apple-surface-3)', borderRadius: '12px', color: 'var(--apple-blue)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                + Створити свій магазин
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="modal-label">
                {searchQuery ? 'Результати пошуку' : 'Часто використовувані'}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {filteredVendors.map(vendor => (
                  <div
                    key={vendor.id}
                    className="category-item active"
                    onClick={() => handleSelectVendor(vendor)}
                    style={{
                      flexDirection: 'row',
                      background: 'var(--apple-surface-2)',
                      padding: '12px',
                      borderRadius: '12px',
                      justifyContent: 'flex-start',
                      width: '100%',
                      opacity: 1,
                      position: 'relative',
                    }}>
                    <span style={{ fontSize: '20px' }}>{vendor.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vendor.name}</span>
                      {(usageCounts[vendor.id] || 0) > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--apple-text-on-dark-tertiary)' }}>
                          {usageCounts[vendor.id]}× використано
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {searchQuery && !filteredVendors.some(v => v.name.toLowerCase() === searchQuery.toLowerCase()) && (
                  <div
                    className="category-item active"
                    onClick={() => handleSelectVendor({ id: 'custom_search', name: searchQuery, category: 'other', icon: '🛒' })}
                    style={{
                      flexDirection: 'row',
                      background: 'var(--apple-blue)',
                      padding: '12px',
                      borderRadius: '12px',
                      justifyContent: 'flex-start',
                      width: '100%',
                      opacity: 1,
                      gridColumn: 'span 2'
                    }}>
                    <span style={{ fontSize: '20px' }}>➕</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>Додати "{searchQuery}"</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--apple-surface-2)', padding: '12px', borderRadius: '16px' }}>
              <span style={{ fontSize: '32px' }}>{selectedVendor.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: '18px', fontWeight: 600, color: 'white' }}>{selectedVendor.name}</span>
                <span style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-secondary)' }}>Витрата з гаманця</span>
              </div>
              <button
                onClick={() => { setSelectedVendor(null); setAmount(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                Змінити
              </button>
            </div>

            <input
              type="text"
              className="modal-amount-input"
              placeholder={`0.00 ${CURRENCY_SYMBOLS[selectedCurrency]}`}
              value={amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              autoFocus
            />

            {/* Category selector */}
            <div className="modal-input-group">
              <label className="modal-label">Категорія</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '6px 12px', borderRadius: '980px', border: 'none', fontSize: '13px',
                      background: selectedCategory === cat.id ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
                      color: 'white', cursor: 'pointer', fontWeight: 500,
                    }}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-input-group">
              <label className="modal-label">Гаманець</label>
              <div className="currency-selector" style={{ flexWrap: 'wrap' }}>
                {availableWallets.map((c) => (
                  <button
                    key={c}
                    className={`currency-btn ${selectedCurrency === c ? 'active' : ''}`}
                    style={{ padding: '8px 4px', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    onClick={() => setSelectedCurrency(c)}
                  >
                    <span>{c}</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{formatValue(walletBalances[c], c)}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="modal-btn-primary"
              onClick={handleSubmit}
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
            >
              {isLoading ? 'Завантаження...' : 'Підтвердити витрату'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
