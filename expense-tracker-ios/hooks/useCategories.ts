// Categories hook — adapted from web version
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  subscribeToUserSettings,
  updateUserSettings,
  type UserSettings,
} from '../services/database';
import {
  DEFAULT_CATEGORIES,
  getMergedCategories,
  buildCategoryMaps,
  type Category,
} from '../config/categories';

export const useCategories = () => {
  const { user } = useAuth();
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserSettings(user.id, (settings: UserSettings) => {
      setCustomCategories(settings.customCategories || []);
      setHiddenCategoryIds(settings.hiddenCategories || []);
    });
    return () => unsub();
  }, [user]);

  const categories = useMemo(() => {
    return getMergedCategories(hiddenCategoryIds, customCategories);
  }, [hiddenCategoryIds, customCategories]);

  const { icons, names, colors } = useMemo(() => buildCategoryMaps(categories), [categories]);

  const addCategory = useCallback(async (category: Category) => {
    if (!user) return;
    const updated = [...customCategories, category];
    await updateUserSettings(user.id, { customCategories: updated });
  }, [user, customCategories]);

  const removeCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    const isDefault = DEFAULT_CATEGORIES.some(c => c.id === categoryId);
    if (isDefault) {
      const updatedHidden = [...hiddenCategoryIds, categoryId];
      await updateUserSettings(user.id, { hiddenCategories: updatedHidden });
    } else {
      const updatedCustom = customCategories.filter(c => c.id !== categoryId);
      await updateUserSettings(user.id, { customCategories: updatedCustom });
    }
  }, [user, customCategories, hiddenCategoryIds]);

  const restoreCategory = useCallback(async (categoryId: string) => {
    if (!user) return;
    const updatedHidden = hiddenCategoryIds.filter(id => id !== categoryId);
    await updateUserSettings(user.id, { hiddenCategories: updatedHidden });
  }, [user, hiddenCategoryIds]);

  return {
    categories,
    icons,
    names,
    colors,
    addCategory,
    removeCategory,
    restoreCategory,
    hiddenCategoryIds,
    defaultCategories: DEFAULT_CATEGORIES,
  };
};
