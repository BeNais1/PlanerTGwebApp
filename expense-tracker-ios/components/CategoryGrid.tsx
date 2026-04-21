// Category grid selector for expense modals
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors, Radius } from '../constants/Theme';
import type { Category } from '../config/categories';

interface CategoryGridProps {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const CategoryGrid = ({ categories, selectedId, onSelect }: CategoryGridProps) => {
  return (
    <ScrollView horizontal={false} style={styles.container}>
      <View style={styles.grid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.item, selectedId === cat.id && styles.itemActive]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{cat.icon}</Text>
            <Text style={[styles.name, selectedId === cat.id && styles.nameActive]} numberOfLines={1}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  item: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemActive: {
    borderColor: Colors.blue,
    backgroundColor: Colors.surface3,
  },
  icon: {
    fontSize: 24,
  },
  name: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textOnDarkSecondary,
    textAlign: 'center',
  },
  nameActive: {
    color: Colors.textOnDark,
  },
});
