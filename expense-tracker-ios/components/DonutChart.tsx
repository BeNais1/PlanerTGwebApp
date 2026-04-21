// Donut chart for analytics — SVG-based
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../constants/Theme';

interface DonutChartProps {
  data: { category: string; amount: number; color: string }[];
  totalAmount: number;
  centerLabel: string;
  centerValue: string;
  centerSub?: string;
  size?: number;
  strokeWidth?: number;
}

export const DonutChart = ({
  data,
  totalAmount,
  centerLabel,
  centerValue,
  centerSub,
  size = 200,
  strokeWidth = 24,
}: DonutChartProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map(({ category, amount, color }) => {
          if (totalAmount === 0) return null;
          const percentage = amount / totalAmount;
          const strokeLength = percentage * circumference;
          const segmentOffset = currentOffset;
          currentOffset += strokeLength;

          return (
            <Circle
              key={category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeLength} ${circumference}`}
              strokeDashoffset={-segmentOffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
        })}
      </Svg>
      <View style={styles.centerContent}>
        <Text style={styles.centerLabel}>{centerLabel}</Text>
        <Text style={styles.centerValue}>{centerValue}</Text>
        {centerSub && <Text style={styles.centerSub}>{centerSub}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 14,
    color: Colors.textOnDarkSecondary,
  },
  centerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textOnDark,
  },
  centerSub: {
    fontSize: 14,
    color: Colors.textOnDarkSecondary,
  },
});
