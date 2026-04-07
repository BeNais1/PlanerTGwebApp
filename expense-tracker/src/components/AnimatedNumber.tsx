import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // ms
  formatter: (val: number) => string;
}

export const AnimatedNumber = ({ value, duration = 1000, formatter }: AnimatedNumberProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const prevValue = useRef(0);
  const currentValue = useRef(value);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    // On value change, restart animation from current total
    prevValue.current = displayValue;
    currentValue.current = value;
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = timestamp - startTime.current;
      const percent = Math.min(progress / duration, 1);

      // Ease Out Quart: 1 - Math.pow(1 - percent, 4)
      const easeOutPercent = 1 - Math.pow(1 - percent, 4);
      
      const currentVal = prevValue.current + (currentValue.current - prevValue.current) * easeOutPercent;
      
      setDisplayValue(currentVal);

      if (percent < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [value, duration]);

  return <span>{formatter(displayValue)}</span>;
};
