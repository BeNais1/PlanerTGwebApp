import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_TELEGRAM_ID } from '../../services/database';
import {
  activateVaultDemo,
  getVaultSubscription,
  type VaultSubscriptionResponse,
} from '../../services/vault';
import './Modals.css';
import './VaultModal.css';

interface VaultModalProps {
  onClose: () => void;
}

export const VaultModal = ({ onClose }: VaultModalProps) => {
  const { user } = useAuth();
  const hasInitData = Boolean(window.Telegram?.WebApp?.initData);
  const [subscription, setSubscription] = useState<VaultSubscriptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(hasInitData);
  const [isActivating, setIsActivating] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const initData = window.Telegram?.WebApp?.initData || '';
    let isActive = true;

    if (!initData) return;

    void getVaultSubscription(initData)
      .then((status) => {
        if (isActive) setSubscription(status);
      })
      .catch(() => {
        if (isActive) setError('Не вдалося завантажити стан підписки.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (!user || user.id !== ADMIN_TELEGRAM_ID) return null;

  const handleDemoActivation = async () => {
    const initData = window.Telegram?.WebApp?.initData || '';

    if (!initData) {
      setError('Demo-активацію можна запускати лише всередині Telegram Mini App.');
      return;
    }

    setError('');
    setIsActivating(true);

    try {
      const result = await activateVaultDemo(initData);
      setSubscription(result);
      setIsCelebrating(true);
      window.setTimeout(() => setIsCelebrating(false), 2200);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Не вдалося активувати Vault.');
    } finally {
      setIsActivating(false);
    }
  };

  const isVaultActive = subscription?.isActive === true;
  const activatedDate = subscription?.activatedAt
    ? new Date(subscription.activatedAt).toLocaleDateString('uk-UA')
    : null;

  return (
    <div className="modal-overlay vault-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content vault-modal-content">
        <div className="modal-header">
          <div>
            <span className="vault-test-tag">ADMIN DEMO</span>
            <h2 className="modal-title vault-title">Vault</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрити">x</button>
        </div>

        {isVaultActive ? (
          <section className={`vault-success ${isCelebrating ? 'celebrating' : ''}`}>
            <span className="vault-spark spark-one" aria-hidden="true">+</span>
            <span className="vault-spark spark-two" aria-hidden="true">+</span>
            <span className="vault-spark spark-three" aria-hidden="true">+</span>
            <div className="vault-success-emblem" aria-hidden="true">
              <span>V</span>
              <i />
            </div>
            <p className="vault-success-label">Підписка активна</p>
            <h3>Vault придбано</h3>
            <p className="vault-success-subtitle">
              {subscription.isDemo ? 'Demo-режим адміністратора' : 'Оплачено через Telegram Stars'}
            </p>
            <div className="vault-success-details">
              <span><strong>{subscription.isDemo ? '0' : subscription.amountStars}</strong> Stars списано</span>
              <span><strong>{subscription.periodDays}</strong> днів</span>
            </div>
            {activatedDate && <p className="vault-activated-date">Активовано {activatedDate}</p>}
          </section>
        ) : (
          <>
            <div className="vault-hero">
              <span className="vault-lock" aria-hidden="true">V</span>
              <p className="vault-plan-label">Підписка Vault</p>
              <p className="vault-price"><strong>250 Stars</strong><span>/ 30 днів</span></p>
            </div>

            <div className="vault-features">
              <p>Перевірка екрана підписки для адміністратора</p>
              <p>Функції підписки ще не активуються</p>
              <p>У demo-режимі Telegram Stars не списуються</p>
            </div>
          </>
        )}

        {error && <div className="vault-error">{error}</div>}

        {!isVaultActive && (
          <button
            type="button"
            className="vault-buy-btn vault-demo-btn"
            onClick={() => void handleDemoActivation()}
            disabled={isActivating || isLoading}
          >
            {isLoading
              ? 'Перевіряємо підписку...'
              : isActivating
                ? 'Активуємо Vault...'
                : 'Тестово придбати - без списання Stars'}
          </button>
        )}

        <p className={`vault-footnote ${isVaultActive ? 'active' : ''}`}>
          {isVaultActive
            ? 'Тестова активація збережена. Жодного реального платежу не створено.'
            : 'Для адміністратора це лише тест кнопки та анімації покупки, без платежу.'}
        </p>
      </div>
    </div>
  );
};
