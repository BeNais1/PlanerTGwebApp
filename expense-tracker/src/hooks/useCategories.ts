import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToSettings, updateUserSettings, type UserSettings } from '../services/database';
import { DEFAULT_CATEGORIES, getMergedCategories, buildCategoryMaps, type Category } from '../config/categories';

export function useCategories() {
  const { user } = useAuth();
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToSettings(user.id, (settings: UserSettings | null) => {
      setCustomCategories(settings?.customCategories || []);
      setHiddenCategoryIds(settings?.hiddenCategories || []);
    });

    return () => unsubscribe();
  }, [user]);

  const categories = useMemo(
    () => getMergedCategories(hiddenCategoryIds, customCategories),
    [hiddenCategoryIds, customCategories]
  );

  const { icons, names, colors } = useMemo(
    () => buildCategoryMaps(categories),
    [categories]
  );

  const addCategory = useCallback(async (category: Omit<Category, 'isCustom'>) => {
    if (!user) return;
    const updated = [...customCategories, { ...category, isCustom: true } as Category];
    await updateUserSettings(user.id, { customCategories: updated });
  }, [user, customCategories]);

  const removeCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    // If it's a default category, hide it
    const isDefault = DEFAULT_CATEGORIES.some(c => c.id === categoryId);
    if (isDefault) {
      const updated = [...hiddenCategoryIds, categoryId];
      await updateUserSettings(user.id, { hiddenCategories: updated });
    } else {
      // If it's custom, remove from custom list
      const updated = customCategories.filter(c => c.id !== categoryId);
      await updateUserSettings(user.id, { customCategories: updated });
    }
  }, [user, customCategories, hiddenCategoryIds]);

  const restoreCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    const updated = hiddenCategoryIds.filter(id => id !== categoryId);
    await updateUserSettings(user.id, { hiddenCategories: updated });
  }, [user, hiddenCategoryIds]);

  return {
    categories,
    icons: icons as Record<string, string>,
    names: names as Record<string, string>,
    colors: colors as Record<string, string>,
    addCategory,
    removeCategory,
    restoreCategory,
    hiddenCategoryIds,
    defaultCategories: DEFAULT_CATEGORIES,
  };
}
