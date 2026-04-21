// Filter chip component — used across analytics and other views
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors } from '../constants/Theme';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  activeColor?: string;
  style?: ViewStyle;
}

export const FilterChip = ({ label, isActive, onPress, activeColor, style }: FilterChipProps) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isActive ? [styles.active, activeColor ? { backgroundColor: activeColor } : null] : styles.inactive,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.label, isActive ? styles.activeLabel : styles.inactiveLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 980,
  },
  active: {
    backgroundColor: Colors.blue,
  },
  inactive: {
    backgroundColor: Colors.surface2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  activeLabel: {
    color: Colors.white,
  },
  inactiveLabel: {
    color: Colors.textOnDark,
  },
});
