import { describe, expect, it } from 'vitest';
import {
  calculateNextDate,
  shouldNotifySubscription,
} from '../backend/utils/subscriptions.js';

describe('subscription scheduling', () => {
  it('advances daily and weekly schedules', () => {
    const start = new Date(2026, 6, 27, 9, 30).getTime();
    expect(calculateNextDate(start, 'daily')).toBe(new Date(2026, 6, 28, 9, 30).getTime());
    expect(calculateNextDate(start, 'weekly')).toBe(new Date(2026, 7, 3, 9, 30).getTime());
  });

  it('clamps monthly billing to the last valid day', () => {
    const january31 = new Date(2026, 0, 31, 9).getTime();
    expect(calculateNextDate(january31, 'monthly')).toBe(new Date(2026, 1, 28, 9).getTime());
  });

  it('clamps leap-day yearly billing in a non-leap year', () => {
    const leapDay = new Date(2024, 1, 29, 9).getTime();
    expect(calculateNextDate(leapDay, 'yearly')).toBe(new Date(2025, 1, 28, 9).getTime());
  });

  it('notifies only active, due and non-snoozed subscriptions', () => {
    const now = 10_000;
    const due = { isActive: true, nextDate: now - 1 };

    expect(shouldNotifySubscription(due, null, now)).toBe(true);
    expect(shouldNotifySubscription({ ...due, isActive: false }, null, now)).toBe(false);
    expect(shouldNotifySubscription({ ...due, nextDate: now + 1 }, null, now)).toBe(false);
    expect(shouldNotifySubscription(due, { snoozedUntil: now + 1 }, now)).toBe(false);
    expect(shouldNotifySubscription(due, { snoozedUntil: now }, now)).toBe(true);
  });
});
