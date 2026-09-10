export type ExchangeRates<TCurrency extends string> = Record<TCurrency, number>;

export function convertCurrency<TCurrency extends string>(
  amount: number,
  from: TCurrency,
  to: TCurrency,
  rates: ExchangeRates<TCurrency>,
): number {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!Number.isFinite(amount) || !fromRate || !toRate) {
    throw new Error('Invalid currency conversion input');
  }
  return (amount / fromRate) * toRate;
}
