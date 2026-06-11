import type { ActiveSession } from '../services/database';

interface DeviceSessionScreenProps {
  activeSession: ActiveSession | null;
  isClaiming: boolean;
  error: string | null;
  onTransfer: () => void;
}

function formatLastSeen(timestamp?: number) {
  if (!timestamp) return 'щойно';

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return 'щойно';
  if (seconds < 60) return `${seconds} с тому`;

  const minutes = Math.round(seconds / 60);
  return `${minutes} хв тому`;
}

export const DeviceSessionScreen = ({ activeSession, isClaiming, error, onTransfer }: DeviceSessionScreenProps) => (
  <div className="phone-frame">
    <main className="device-session-screen">
      <section className="device-session-panel" aria-labelledby="device-session-title">
        <div className="device-session-icon" aria-hidden="true">
          <span />
        </div>
        <h1 id="device-session-title">Акаунт вже відкрито</h1>
        <p>
          Цей акаунт зараз активний на іншому пристрої. Щоб продовжити тут, перенесіть сесію на цей пристрій.
        </p>

        <div className="device-session-meta">
          <span>Активний пристрій</span>
          <strong>{activeSession?.deviceName || 'Інший пристрій'}</strong>
          <small>Оновлено {formatLastSeen(activeSession?.lastSeenAt)}</small>
        </div>

        {error && <div className="device-session-error">{error}</div>}

        <button type="button" className="device-session-button" onClick={onTransfer} disabled={isClaiming}>
          {isClaiming ? 'Переходимо...' : 'Перейти на цей пристрій'}
        </button>
      </section>
    </main>
  </div>
);
