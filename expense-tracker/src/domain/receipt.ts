export interface ReceiptDraft { amount?: number; description: string; date?: number; currency?: string }

export function parseReceipt(text: string): ReceiptDraft {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const totals = lines.filter(line => /(?:до сплати|до оплати|всього|разом|итого|к оплате|total|сума)/i.test(line) && !/subtotal|sub total|пдв|ндс|знижк|економ|решта|здача/i.test(line));
  let amount: number | undefined;
  for (const line of totals) {
    const matches = [...line.matchAll(/\d+(?:[ \u00a0]\d{3})*[.,]\d{2}(?!\d)/g)];
    if (matches.length) {
      const value = Number(matches[matches.length - 1][0].replace(/[ \u00a0]/g, '').replace(',', '.'));
      if (value > 0 && Number.isFinite(value)) amount = value;
    }
  }
  const match = text.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  let date: number | undefined;
  if (match) {
    const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    const candidate = new Date(year, month - 1, day, 12);
    if (candidate.getDate() === day && candidate.getMonth() === month - 1 && candidate.getFullYear() === year) date = candidate.getTime();
  }
  const currency = /грн|UAH|₴/i.test(text) ? 'UAH' : /EUR|€/i.test(text) ? 'EUR' : /USD|\$/i.test(text) ? 'USD' : undefined;
  const description = (lines.find(line => /[a-zа-яіїєґ]/i.test(line) && !/фіскальн|фискальн|касовий|кассовый|receipt/i.test(line)) || '').slice(0, 160);
  return { amount, description, date, currency };
}
