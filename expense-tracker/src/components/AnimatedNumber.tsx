import type { CSSProperties } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter: (val: number) => string;
}

interface DigitPopInTextProps {
  text: string;
  className?: string;
  duration?: number;
}

const TRANSITION_STYLES = `
:root {
  --digit-dur: 500ms;
  --digit-distance: 8px;
  --digit-stagger: 70ms;
  --digit-blur: 2px;
  --digit-ease: cubic-bezier(0.34, 1.45, 0.64, 1);
  --digit-dir-x: 0;
  --digit-dir-y: 1;
}

@keyframes t-digit-pop-in {
  0% {
    transform: translate(
      calc(var(--digit-distance) * var(--digit-dir-x)),
      calc(var(--digit-distance) * var(--digit-dir-y))
    );
    opacity: 0;
    filter: blur(var(--digit-blur));
  }
  100% {
    transform: translate(0, 0);
    opacity: 1;
    filter: blur(0);
  }
}

.t-digit-group {
  display: inline-flex;
  align-items: baseline;
  white-space: pre;
}

.t-digit {
  display: inline-block;
  will-change: transform, opacity, filter;
}

.t-digit-group.is-animating .t-digit {
  animation: t-digit-pop-in var(--digit-dur) var(--digit-ease) both;
  animation-delay: calc(var(--digit-stagger) * var(--digit-index, 0));
}

@media (prefers-reduced-motion: reduce) {
  .t-digit-group .t-digit {
    animation: none !important;
  }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('transitions-p9')) {
  const style = document.createElement('style');
  style.id = 'transitions-p9';
  style.textContent = TRANSITION_STYLES;
  document.head.appendChild(style);
}

export const DigitPopInText = ({
  text,
  className = '',
  duration = 500,
}: DigitPopInTextProps) => {
  const isLongAmount = (text.match(/\d/g)?.length ?? 0) > 4;
  const animationDuration = isLongAmount ? Math.min(duration, 300) : duration;
  const stagger = isLongAmount ? 24 : 70;

  return (
    <span
      key={text}
      className={`t-digit-group is-animating${className ? ` ${className}` : ''}`}
      style={{
        '--digit-dur': `${animationDuration}ms`,
        '--digit-stagger': `${stagger}ms`,
      } as CSSProperties}
      aria-label={text}
    >
      {Array.from(text).map((character, index) => (
        <span
          key={`${character}-${index}`}
          className="t-digit"
          style={{ '--digit-index': index } as CSSProperties}
          aria-hidden="true"
        >
          {character}
        </span>
      ))}
    </span>
  );
};

export const AnimatedNumber = ({
  value,
  duration = 500,
  formatter,
}: AnimatedNumberProps) => (
  <DigitPopInText text={formatter(value)} duration={duration} />
);
