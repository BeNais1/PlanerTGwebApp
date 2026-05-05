import { useState, useEffect } from 'react';
import { getReceiptSavers, type ReceiptSaver } from '../services/database';
import './modals/Modals.css';

interface ReceiptSaversModalProps {
  shareCode: string;
  onClose: () => void;
}

export const ReceiptSaversModal = ({ shareCode, onClose }: ReceiptSaversModalProps) => {
  const [savers, setSavers] = useState<ReceiptSaver[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    getReceiptSavers(shareCode).then((data) => {
      setSavers(data);
      setLoading(false);
    });
  }, [shareCode]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`modal-overlay ${isClosing ? 'closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} style={{ maxHeight: '70vh' }}>
        <div className="modal-header">
          <h2 className="modal-title">Хто зберіг ({savers.length})</h2>
          <div className="modal-close" onClick={handleClose}>✕</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            Завантаження...
          </div>
        ) : savers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>👤</div>
            Ще ніхто не зберіг цей чек
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {savers.map((saver) => (
              <div
                key={saver.userId}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  background: 'var(--card-bg-2)',
                  borderRadius: '14px',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', color: 'white', fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {saver.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {saver.displayName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {new Date(saver.savedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
