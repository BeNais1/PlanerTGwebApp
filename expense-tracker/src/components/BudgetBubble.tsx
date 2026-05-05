import { useState, useEffect, useRef, useMemo } from 'react';
import './BudgetBubble.css';

interface BudgetBubbleProps {
  spent: number;
  limit: number;
  formatValue: (amount: number) => string;
  onSetLimit: () => void;
  period?: 'day' | 'week' | 'month';
}

// Particle data for pop effect
interface Particle {
  id: number;
  size: number;
  color: string;
  angle: number;
  distance: number;
}

const generateParticles = (count: number, color: string): Particle[] => {
  const colors = [color, '#ff453a', '#ff9500', '#ffcc00', '#ff6482'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: 4 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    angle: (360 / count) * i + Math.random() * 30,
    distance: 40 + Math.random() * 60,
  }));
};

export const BudgetBubble = ({ spent, limit, formatValue, onSetLimit, period = 'month' }: BudgetBubbleProps) => {
  const [hasPopped, setHasPopped] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const prevPercent = useRef(0);

  const hasLimit = limit > 0;
  const percent = hasLimit ? Math.min((spent / limit) * 100, 150) : 0;
  const isOverBudget = hasLimit && spent > limit;
  const overAmount = spent - limit;

  // Determine phase
  const phase = useMemo(() => {
    if (!hasLimit) return 'none';
    if (isOverBudget) return 'popped';
    if (percent >= 90) return 'critical';
    if (percent >= 75) return 'warning';
    if (percent >= 50) return 'caution';
    return 'safe';
  }, [percent, isOverBudget, hasLimit]);

  // Color based on phase
  const bubbleColor = useMemo(() => {
    if (phase === 'safe') return '#34d399'; // mint green
    if (phase === 'caution') return '#fbbf24'; // amber
    if (phase === 'warning') return '#f97316'; // orange
    if (phase === 'critical') return '#ef4444'; // red
    return '#ef4444';
  }, [phase]);

  // Size based on percent
  const bubbleSize = useMemo(() => {
    if (phase === 'popped' || phase === 'none') return 0;
    const minSize = 64;
    const maxSize = 120;
    return minSize + (maxSize - minSize) * Math.min(percent / 100, 1);
  }, [percent, phase]);

  // Animation class
  const animClass = useMemo(() => {
    if (phase === 'safe') return 'bubble-breathe';
    if (phase === 'caution') return 'bubble-breathe-fast';
    if (phase === 'warning') return 'bubble-wobble';
    if (phase === 'critical') return 'bubble-shake';
    return '';
  }, [phase]);

  // Pop detection
  useEffect(() => {
    if (isOverBudget && !hasPopped) {
      setHasPopped(true);
      setShowParticles(true);
      // Haptic feedback if available
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
      } catch { /* ignore */ }
      setTimeout(() => setShowParticles(false), 1000);
    }
    if (!isOverBudget && hasPopped) {
      setHasPopped(false);
    }
    prevPercent.current = percent;
  }, [isOverBudget, hasPopped, percent]);

  const particles = useMemo(() => generateParticles(12, bubbleColor), [bubbleColor]);

  // SVG simple circle path
  const blobPath = useMemo(() => {
    // A perfect circle using standard SVG path commands:
    // M cx-r cy
    // a r,r 0 1,0 (r*2),0
    // a r,r 0 1,0 -(r*2),0
    return 'M 12 50 a 38,38 0 1,0 76,0 a 38,38 0 1,0 -76,0';
  }, []);

  // === RENDER ===

  // No limit set — show prompt
  if (phase === 'none') {
    return (
      <div className="bubble-container">
        <div className="bubble-set-limit" onClick={onSetLimit}>
          <span className="bubble-set-limit-icon">🫧</span>
          <span className="bubble-set-limit-text">Встановити ліміт</span>
        </div>
      </div>
    );
  }

  // Overspent — bubble popped
  if (phase === 'popped') {
    return (
      <div className={`bubble-container ${hasPopped ? 'bubble-popped' : ''}`}>
        {showParticles && (
          <div className="bubble-particles">
            {particles.map(p => (
              <div
                key={p.id}
                className={`particle ${showParticles ? 'active' : ''}`}
                style={{
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  transform: `translate(-50%, -50%) translate(${Math.cos(p.angle * Math.PI / 180) * p.distance}px, ${Math.sin(p.angle * Math.PI / 180) * p.distance}px)`,
                  animationDelay: `${Math.random() * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}
        <div className="bubble-overspend">
          <span className="overspend-emoji">💥</span>
          <span className="overspend-title">Ліміт перевищено!</span>
          <span className="overspend-amount">+{formatValue(overAmount)}</span>
        </div>
      </div>
    );
  }

  // Normal bubble
  return (
    <div className="bubble-container">
      <div className={`bubble-wrap ${animClass}`}>
        {/* Glow */}
        <div
          className="bubble-glow"
          style={{
            background: bubbleColor,
            width: bubbleSize * 1.3,
            height: bubbleSize * 1.3,
            opacity: phase === 'critical' ? 0.45 : 0.25,
          }}
        />

        {/* SVG Bubble */}
        <svg
          className="bubble-svg"
          width={bubbleSize}
          height={bubbleSize}
          viewBox="0 0 100 100"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <radialGradient id="bubbleGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="50%" stopColor={bubbleColor} stopOpacity="0.9" />
              <stop offset="100%" stopColor={bubbleColor} stopOpacity="1" />
            </radialGradient>
            <radialGradient id="bubbleHighlight" cx="30%" cy="25%" r="30%">
              <stop offset="0%" stopColor="white" stopOpacity="0.6" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          <path d={blobPath} fill="url(#bubbleGrad)" />
          <circle cx="38" cy="36" r="14" fill="url(#bubbleHighlight)" />
        </svg>

        {/* Text inside */}
        <div className="bubble-text">
          <span
            className="bubble-percent"
            style={{ fontSize: bubbleSize > 90 ? '20px' : '16px' }}
          >
            {Math.round(percent)}%
          </span>
          <span className="bubble-label">
            ліміт {period === 'day' ? 'на день' : period === 'week' ? 'на тиждень' : 'на місяць'}
          </span>
        </div>
      </div>

      {/* Info under bubble */}
      <div className="bubble-info">
        <span className="bubble-info-spent">
          {formatValue(spent)} / {formatValue(limit)}
        </span>
        <span className="bubble-info-limit">
          Залишок: {formatValue(Math.max(0, limit - spent))}
        </span>
      </div>
    </div>
  );
};
