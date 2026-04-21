// Animated balance display with counting effect
import React, { useEffect, useRef } from 'react';
import { Text, Animated, type TextStyle } from 'react-native';

interface AnimatedBalanceProps {
  value: number;
  formatter: (value: number) => string;
  style?: TextStyle;
  duration?: number;
}

export const AnimatedBalance = ({ value, formatter, style, duration = 600 }: AnimatedBalanceProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const displayValue = useRef(0);
  const [displayText, setDisplayText] = React.useState(formatter(0));

  useEffect(() => {
    const startValue = displayValue.current;
    animatedValue.setValue(0);

    const listener = animatedValue.addListener(({ value: progress }) => {
      const current = startValue + (value - startValue) * progress;
      displayValue.current = current;
      setDisplayText(formatter(current));
    });

    Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(() => {
      displayValue.current = value;
      setDisplayText(formatter(value));
    });

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [value]);

  return (
    <Text style={style}>{displayText}</Text>
  );
};
