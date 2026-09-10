export function normalizeTags(value: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value.split(',');
  return [...new Set(values.map(tag => tag.trim().replace(/^#+/, '').toLocaleLowerCase().slice(0, 32)).filter(Boolean))].slice(0, 10);
}

export function paydayBudget(balance: number, reserve: number, date: string, now = new Date()) {
  const target = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!target || !Number.isFinite(balance) || !Number.isFinite(reserve) || reserve < 0) return null;
  const [, y, m, d] = target.map(Number);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const available = Math.max(0, balance - reserve);
  return { days, available, daily: days > 0 ? Math.floor(available / days * 100) / 100 : 0 };
}
