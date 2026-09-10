import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useCurrency, type Currency } from '../hooks/useCurrency';
import { ADMIN_TELEGRAM_ID, subscribeToAdminStats, type AdminStats } from '../services/database';

const SUPPORTED_CURRENCIES: Currency[] = ['EUR', 'USD', 'UAH'];

function createEmptyStats(): AdminStats {
  return {
    userCount: 0,
    usersWithWallets: 0,
    walletCount: 0,
    transactionCount: 0,
    totalCapitalByCurrency: {},
    totalSpentByCurrency: {},
    spentTodayByCurrency: {},
    spentThisMonthByCurrency: {},
    lastExpenseAt: null,
    receivedAt: Date.now(),
  };
}

export const AdminPanel = () => {
  const { user } = useAuth();
  const { currency, convertToMain, formatValue, CURRENCY_SYMBOLS } = useCurrency();
  const [stats, setStats] = useState<AdminStats>(createEmptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.id !== ADMIN_TELEGRAM_ID) return;

    return subscribeToAdminStats(user.id, (nextStats) => {
      setStats(nextStats);
      setError('');
      setIsLoading(false);
    }, () => {
      setError('Не вдалося завантажити статистику.');
      setIsLoading(false);
    });
  }, [user]);

  const totals = useMemo(() => {
    const toMainCurrency = (amounts: Record<string, number>) => (
      Object.entries(amounts).reduce((sum, [sourceCurrency, amount]) => {
        if (!SUPPORTED_CURRENCIES.includes(sourceCurrency as Currency)) return sum;
        return sum + convertToMain(amount, sourceCurrency as Currency);
      }, 0)
    );

    return {
      capital: toMainCurrency(stats.totalCapitalByCurrency),
      spent: toMainCurrency(stats.totalSpentByCurrency),
      spentToday: toMainCurrency(stats.spentTodayByCurrency),
      spentThisMonth: toMainCurrency(stats.spentThisMonthByCurrency),
    };
  }, [convertToMain, stats]);

  if (!user || user.id !== ADMIN_TELEGRAM_ID) return null;

  const updatedAt = new Date(stats.receivedAt).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const lastExpense = stats.lastExpenseAt
    ? new Date(stats.lastExpenseAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
    : 'Ще немає';

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>Завантаження статистики...</div>;
  }

  if (error) {
    return <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--danger)' }}>{error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px', borderRadius: '14px', background: 'var(--card-bg-2)',
      }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Адмін-панель</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          LIVE · {updatedAt}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <StatCard label="Користувачі" value={String(stats.userCount)} />
        <StatCard label="Гаманці" value={String(stats.walletCount)} note={`${stats.usersWithWallets} корист. з гаманцем`} />
      </div>

      <MoneyCard
        label="Загальний капітал усіх гаманців"
        value={formatValue(totals.capital, currency)}
        amounts={stats.totalCapitalByCurrency}
        symbols={CURRENCY_SYMBOLS}
      />

      <MoneyCard
        label="Витрачено глобально"
        value={formatValue(totals.spent, currency)}
        amounts={stats.totalSpentByCurrency}
        symbols={CURRENCY_SYMBOLS}
        live
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <StatCard label="Витрати сьогодні" value={formatValue(totals.spentToday, currency)} />
        <StatCard label="Цього місяця" value={formatValue(totals.spentThisMonth, currency)} />
      </div>

      <div style={{
        padding: '14px', borderRadius: '14px', background: 'var(--card-bg-2)',
        display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px',
      }}>
        <SummaryRow label="Операцій у базі" value={stats.transactionCount.toLocaleString('uk-UA')} />
        <SummaryRow label="Остання витрата" value={lastExpense} />
      </div>
    </div>
  );
};

const StatCard = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--card-bg-2)' }}>
    <span style={{ display: 'block', marginBottom: '8px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
      {label}
    </span>
    <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '21px', letterSpacing: '-0.3px' }}>{value}</strong>
    {note && <span style={{ display: 'block', marginTop: '5px', color: 'var(--text-tertiary)', fontSize: '11px' }}>{note}</span>}
  </div>
);

const MoneyCard = ({
  label,
  value,
  amounts,
  symbols,
  live = false,
}: {
  label: string;
  value: string;
  amounts: Record<string, number>;
  symbols: Record<Currency, string>;
  live?: boolean;
}) => {
  const breakdown = Object.entries(amounts)
    .filter(([sourceCurrency]) => SUPPORTED_CURRENCIES.includes(sourceCurrency as Currency))
    .map(([sourceCurrency, amount]) => (
      `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbols[sourceCurrency as Currency]}`
    ))
    .join('  |  ');

  return (
    <div style={{
      padding: '16px', borderRadius: '18px',
      background: live ? 'linear-gradient(135deg, rgba(52,199,89,0.14), var(--card-bg-2))' : 'var(--card-bg-2)',
      border: live ? '1px solid rgba(52,199,89,0.22)' : '1px solid transparent',
    }}>
      <span style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>
        {label}
      </span>
      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '27px', letterSpacing: '-0.5px' }}>{value}</strong>
      <span style={{ display: 'block', marginTop: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {breakdown || 'Даних поки немає'}
      </span>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
  </div>
);
