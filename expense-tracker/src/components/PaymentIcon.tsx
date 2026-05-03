import { ArrowDown } from './icons/ArrowDown';
import { useCategories } from '../hooks/useCategories';

interface PaymentIconProps {
  type: string;
  category: string;
}

export const PaymentIcon = ({ type, category }: PaymentIconProps) => {
  const { icons: CATEGORY_ICONS } = useCategories();

  if (type === 'income') {
    return (
      <div className="payment-icon" style={{ background: "var(--accent)" }}>
        <ArrowDown className="!w-5 !h-5 text-white" />
      </div>
    );
  }
  const icon = CATEGORY_ICONS[category] || '📦';
  return (
    <div className="payment-icon" style={{ background: "var(--card-bg-2)", fontSize: "20px" }}>
      {icon}
    </div>
  );
};
