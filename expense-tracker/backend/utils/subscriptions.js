const PERIODS = new Set(['daily', 'weekly', 'monthly', 'yearly']);

export function calculateNextDate(currentTimestamp, period) {
  if (!Number.isFinite(currentTimestamp) || !PERIODS.has(period)) {
    throw new Error('Invalid subscription schedule');
  }

  const next = new Date(currentTimestamp);

  if (period === 'daily') next.setDate(next.getDate() + 1);
  if (period === 'weekly') next.setDate(next.getDate() + 7);
  if (period === 'yearly') {
    const month = next.getMonth();
    next.setFullYear(next.getFullYear() + 1);
    if (next.getMonth() !== month) next.setDate(0);
  }
  if (period === 'monthly') {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
  }

  return next.getTime();
}

export function shouldNotifySubscription(subscription, pendingNotification, now) {
  if (!subscription?.isActive) return false;
  if (!Number.isFinite(subscription.nextDate) || subscription.nextDate > now) return false;
  return !pendingNotification?.snoozedUntil || pendingNotification.snoozedUntil <= now;
}
