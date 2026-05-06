import { ArrowDown } from './icons/ArrowDown';
import { useCategories } from '../hooks/useCategories';

interface PaymentIconProps {
  type: string;
  category: string;
}

export const PaymentIcon = ({ type, category }: PaymentIconProps) => {
  const { icons: CATEGORY_ICONS } = useCategories();

  if (category === 'joint_check') {
    return (
      <div className="payment-icon" style={{ background: "rgba(10, 132, 255, 0.18)", color: "var(--accent)", fontSize: "20px", fontWeight: 800 }}>
        ▦
      </div>
    );
  }

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
