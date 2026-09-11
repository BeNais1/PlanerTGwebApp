export interface ReceiptDraft {
  amount?: number;
  description: string;
  date?: number;
  currency?: string;
  category?: string;
}

const TOTAL_MARKER = /(?:до\s*(?:сплати|оплати)|всього|разом|итого|к\s*оплате|total|сума)/i;
const TOTAL_EXCLUSION = /subtotal|sub\s*total|пдв|ндс|знижк|скидк|економ|решта|здача|готівк|наличн|оплачено/i;

function parseMoney(value: string): number | undefined {
  const normalized = value.replace(/[ \u00a0']/g, '').replace(',', '.');
  const amount = Number(normalized);
  return amount > 0 && Number.isFinite(amount) ? amount : undefined;
}

function inferCategory(text: string): string | undefined {
  if (/аптек|ліки|лекарств|pharmacy/i.test(text)) return 'health';
  if (/кафе|кава|coffee|restaurant|ресторан|pizza|макдон|kfc/i.test(text)) return 'cafe';
  if (/сільпо|silpo|атб|novus|varus|продукт|market|supermarket/i.test(text)) return 'food';
  if (/uber|bolt|уклон|u?klon|таксі|taxi|метро|автобус|палив|fuel|wog|okko/i.test(text)) return 'transport';
  if (/zara|reserved|одяг|обув|clothes|fashion/i.test(text)) return 'shopping';
  return undefined;
}

export function parseReceipt(text: string): ReceiptDraft {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const totals = lines.filter(line => TOTAL_MARKER.test(line) && !TOTAL_EXCLUSION.test(line));
  let amount: number | undefined;
  for (const line of totals) {
    const matches = [...line.matchAll(/\d+(?:[ \u00a0']\d{3})*(?:[.,]\d{1,2})?(?!\d)/g)];
    if (matches.length) {
      const value = parseMoney(matches[matches.length - 1][0]);
      if (value) amount = value;
    }
  }
  const match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/);
  let date: number | undefined;
  if (match) {
    const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
    const candidate = new Date(year, month - 1, day, 12);
    if (candidate.getDate() === day && candidate.getMonth() === month - 1 && candidate.getFullYear() === year) date = candidate.getTime();
  }
  const currency = /грн|UAH|₴/i.test(text) ? 'UAH' : /EUR|€/i.test(text) ? 'EUR' : /USD|\$/i.test(text) ? 'USD' : undefined;
  const description = (lines.find(line => /[a-zа-яіїєґ]/i.test(line) && !/фіскальн|фискальн|касовий|кассовый|receipt|чек|магазин/i.test(line)) || '').slice(0, 160);
  return { amount, description, date, currency, category: inferCategory(text) };
}
