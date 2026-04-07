import { useState, useEffect, useMemo } from 'react';
import { useCurrency, type Currency } from '../../hooks/useCurrency';
import './Modals.css';

interface QuickSpendModalProps {
  onClose: () => void;
  onSpend: (amount: number, category: string, description: string, currency: Currency) => void;
  isLoading?: boolean;
  walletBalances: Record<string, number>;
}

const QUICK_VENDORS = [
  { id: 'mcdonalds', name: "McDonald's", category: 'food', icon: '🍔' },
  { id: 'kfc', name: 'KFC', category: 'food', icon: '🍗' },
  { id: 'apple', name: 'Apple', category: 'shopping', icon: '🍎' },
  { id: 'microsoft', name: 'Microsoft', category: 'shopping', icon: '💻' },
  { id: 'starbucks', name: 'Starbucks', category: 'food', icon: '☕' },
  { id: 'amazon', name: 'Amazon', category: 'shopping', icon: '📦' },
  { id: 'netflix', name: 'Netflix', category: 'entertainment', icon: '🍿' },
  { id: 'spotify', name: 'Spotify', category: 'entertainment', icon: '🎵' },
  { id: 'google', name: 'Google', category: 'other', icon: '🔍' },
  { id: 'uber', name: 'Uber', category: 'transport', icon: '🚗' },
];

export const QuickSpendModal = ({ onClose, onSpend, isLoading, walletBalances }: QuickSpendModalProps) => {
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<typeof QUICK_VENDORS[0] | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(mainCurrency);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (walletBalances[mainCurrency] !== undefined) {
      setSelectedCurrency(mainCurrency);
    } else if (Object.keys(walletBalances).length > 0) {
      setSelectedCurrency(Object.keys(walletBalances)[0] as Currency);
    }
  }, [mainCurrency, walletBalances]);

  const filteredVendors = useMemo(() => {
    return QUICK_VENDORS.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (val.split('.').length > 2) return;
    setAmount(val);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    const vendorName = selectedVendor ? selectedVendor.name : searchQuery;
    const category = selectedVendor ? selectedVendor.category : 'other';
    
    if (!isNaN(numAmount) && numAmount > 0 && vendorName) {
      onSpend(numAmount, category, vendorName, selectedCurrency);
    }
  };

  const availableWallets = Object.keys(walletBalances) as Currency[];

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">Быстрый доступ</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        {!selectedVendor ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input
              type="text"
              className="modal-input"
              placeholder="Поиск магазина или компании..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="modal-label">Популярные</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {filteredVendors.map(vendor => (
                  <div 
                    key={vendor.id} 
                    className="category-item active" 
                    onClick={() => setSelectedVendor(vendor)}
                    style={{ 
                      flexDirection: 'row', 
                      background: 'var(--apple-surface-2)', 
                      padding: '12px', 
                      borderRadius: '12px',
                      justifyContent: 'flex-start',
                      width: '100%',
                      opacity: 1
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{vendor.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>{vendor.name}</span>
                  </div>
                ))}
                {searchQuery && !filteredVendors.some(v => v.name.toLowerCase() === searchQuery.toLowerCase()) && (
                  <div 
                    className="category-item active" 
                    onClick={() => setSelectedVendor({ id: 'custom', name: searchQuery, category: 'other', icon: '🛒' })}
                    style={{ 
                      flexDirection: 'row', 
                      background: 'var(--apple-blue)', 
                      padding: '12px', 
                      borderRadius: '12px',
                      justifyContent: 'flex-start',
                      width: '100%',
                      opacity: 1,
                      gridColumn: 'span 2'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>➕</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>Добавить "{searchQuery}"</span>
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
                <span style={{ fontSize: '13px', color: 'var(--apple-text-on-dark-secondary)' }}>Расход в кошелек</span>
              </div>
              <button 
                onClick={() => { setSelectedVendor(null); setAmount(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--apple-blue)', fontSize: '14px', fontWeight: 500 }}
              >
                Изменить
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

            <div className="modal-input-group">
              <label className="modal-label">Кошелек</label>
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
              {isLoading ? 'Загрузка...' : 'Подтвердить расход'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
