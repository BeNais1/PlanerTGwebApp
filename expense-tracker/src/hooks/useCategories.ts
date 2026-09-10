import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/useAuth';
import { useFamilyBudget } from '../context/useFamilyBudget';
import { subscribeToSettings, updateUserSettings, type UserSettings } from '../services/database';
import { DEFAULT_CATEGORIES, getMergedCategories, buildCategoryMaps, type Category } from '../config/categories';

export function useCategories() {
  const { user } = useAuth();
  const { dataOwnerId } = useFamilyBudget();
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !dataOwnerId) return;

    const unsubscribe = subscribeToSettings(dataOwnerId, (settings: UserSettings | null) => {
      setCustomCategories(settings?.customCategories || []);
      setHiddenCategoryIds(settings?.hiddenCategories || []);
      setCategoryOrder(settings?.categoryOrder || []);
    });

    return () => unsubscribe();
  }, [user, dataOwnerId]);

  const categories = useMemo(() => {
    const merged = getMergedCategories(hiddenCategoryIds, customCategories);
    if (!categoryOrder.length) return merged;

    const orderMap = new Map(categoryOrder.map((id, i) => [id, i]));
    return [...merged].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 99999;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 99999;
      return ai - bi;
    });
  }, [hiddenCategoryIds, customCategories, categoryOrder]);

  const { icons, names, colors } = useMemo(
    () => buildCategoryMaps(categories),
    [categories]
  );

  const addCategory = useCallback(async (category: Omit<Category, 'isCustom'>) => {
    if (!user || !dataOwnerId) return;
    const updated = [...customCategories, { ...category, isCustom: true } as Category];
    await updateUserSettings(dataOwnerId, { customCategories: updated });
  }, [user, dataOwnerId, customCategories]);

  const removeCategory = useCallback(async (categoryId: string) => {
    if (!user || !dataOwnerId) return;
    const isDefault = DEFAULT_CATEGORIES.some(c => c.id === categoryId);
    if (isDefault) {
      const updated = [...hiddenCategoryIds, categoryId];
      await updateUserSettings(dataOwnerId, { hiddenCategories: updated });
    } else {
      const updated = customCategories.filter(c => c.id !== categoryId);
      await updateUserSettings(dataOwnerId, { customCategories: updated });
    }
  }, [user, dataOwnerId, customCategories, hiddenCategoryIds]);

  const restoreCategory = useCallback(async (categoryId: string) => {
    if (!user || !dataOwnerId) return;
    const updated = hiddenCategoryIds.filter(id => id !== categoryId);
    await updateUserSettings(dataOwnerId, { hiddenCategories: updated });
  }, [user, dataOwnerId, hiddenCategoryIds]);

  const reorderCategories = useCallback(async (orderedIds: string[]) => {
    if (!user || !dataOwnerId) return;
    await updateUserSettings(dataOwnerId, { categoryOrder: orderedIds });
  }, [user, dataOwnerId]);

  return {
    categories,
    icons: icons as Record<string, string>,
    names: names as Record<string, string>,
    colors: colors as Record<string, string>,
    addCategory,
    removeCategory,
    restoreCategory,
    reorderCategories,
    hiddenCategoryIds,
    defaultCategories: DEFAULT_CATEGORIES,
  };
}
