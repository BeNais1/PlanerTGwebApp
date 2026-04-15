// ====== Shared Category System ======

export interface Category {
  id: string;
  icon: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

// Default categories — can be hidden by the user
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', icon: '🍔', name: 'Еда', color: '#FF9500' },
  { id: 'transport', icon: '🚗', name: 'Транспорт', color: '#007AFF' },
  { id: 'home', icon: '🏠', name: 'Жильё', color: '#34C759' },
  { id: 'entertainment', icon: '🎮', name: 'Развлечения', color: '#AF52DE' },
  { id: 'shopping', icon: '🛒', name: 'Покупки', color: '#FF2D55' },
  { id: 'health', icon: '💊', name: 'Здоровье', color: '#FF3B30' },
  { id: 'education', icon: '📚', name: 'Образование', color: '#5856D6' },
  { id: 'subscriptions', icon: '🔄', name: 'Подписки', color: '#5AC8FA' },
  { id: 'cafe', icon: '☕', name: 'Кафе', color: '#A2845E' },
  { id: 'gifts', icon: '🎁', name: 'Подарки', color: '#FF6482' },
  { id: 'other', icon: '📦', name: 'Другое', color: '#8E8E93' },
];

// Build lookup maps from any category array
export function buildCategoryMaps(categories: Category[]) {
  const icons: Record<string, string> = {};
  const names: Record<string, string> = {};
  const colors: Record<string, string> = {};

  categories.forEach(c => {
    icons[c.id] = c.icon;
    names[c.id] = c.name;
    colors[c.id] = c.color;
  });

  return { icons, names, colors };
}

// Merge defaults (minus hidden) + custom categories
export function getMergedCategories(
  hiddenCategoryIds: string[] = [],
  customCategories: Category[] = []
): Category[] {
  const filtered = DEFAULT_CATEGORIES.filter(c => !hiddenCategoryIds.includes(c.id));
  return [...filtered, ...customCategories.map(c => ({ ...c, isCustom: true }))];
}
