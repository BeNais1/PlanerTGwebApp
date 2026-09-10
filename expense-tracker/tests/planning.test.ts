import { describe, expect, it } from 'vitest';
import { normalizeTags, paydayBudget } from '../src/domain/planning';
import { parseReceipt } from '../src/domain/receipt';

describe('payday budget', () => {
  const now = new Date(2026, 8, 10, 23, 59);
  it('reserves money and counts calendar days rather than hours', () => {
    expect(paydayBudget(1000, 300, '2026-09-17', now)).toEqual({ days: 7, available: 700, daily: 100 });
  });
  it('never suggests spending borrowed or reserved money', () => {
    expect(paydayBudget(-50, 0, '2026-09-17', now)?.daily).toBe(0);
    expect(paydayBudget(100, 200, '2026-09-17', now)?.daily).toBe(0);
  });
  it('handles payday, expired dates and invalid input', () => {
    expect(paydayBudget(100, 0, '2026-09-10', now)?.days).toBe(0);
    expect(paydayBudget(100, 0, '2026-09-09', now)?.days).toBe(-1);
    expect(paydayBudget(100, 0, '2026-02-31', now)).toBeNull();
    expect(paydayBudget(100, -1, '2026-09-11', now)).toBeNull();
    expect(paydayBudget(Infinity, 0, '2026-09-11', now)).toBeNull();
  });
  it('rounds down so the daily allocation cannot exceed the available balance', () => {
    expect(paydayBudget(100, 0, '2026-09-13', now)?.daily).toBe(33.33);
  });
});

describe('expense tags', () => {
  it('normalizes, deduplicates and supports clearing tags', () => {
    expect(normalizeTags(' #Ремонт, ремонт, Відпустка, ')).toEqual(['ремонт', 'відпустка']);
    expect(normalizeTags('')).toEqual([]);
    expect(normalizeTags(Array.from({ length: 20 }, (_, i) => `tag${i}`))).toHaveLength(10);
    expect(normalizeTags(['a'.repeat(33), 'a'.repeat(34)])).toEqual(['a'.repeat(32)]);
  });
});

describe('receipt parsing', () => {
  it('reads total, date and currency without confusing tax or cash tendered with total', () => {
    const result = parseReceipt('Сільпо\n10.09.2026\nМолоко 45,50\nХліб 30,00\nСУМА 75,50 грн\nПДВ 12,58\nГОТІВКА 100,00\nРЕШТА 24,50');
    expect(result.amount).toBe(75.5);
    expect(result.description).toBe('Сільпо');
    expect(result.currency).toBe('UAH');
    expect(new Date(result.date!).getDate()).toBe(10);
  });
  it('reads grouped totals and never guesses from item prices', () => {
    expect(parseReceipt('TOTAL EUR 1 234.56').amount).toBe(1234.56);
    expect(parseReceipt('Milk 3.50\nBread 2.00').amount).toBeUndefined();
    expect(parseReceipt('TOTAL 3.50\n31.02.2026').date).toBeUndefined();
  });
});
