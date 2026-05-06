import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCurrency, type Currency } from "../hooks/useCurrency";
import { NumericKeypad, getKeypadNumericValue } from "./NumericKeypad";
import {
  addJointCheckPayment,
  subscribeToJointCheck,
  type JointCheck,
  type JointCheckPayment,
} from "../services/database";
import "./modals/Modals.css";
import "./JointCheck.css";

interface JointCheckDetailModalProps {
  jointCheckId: string;
  onClose: () => void;
}

export const JointCheckDetailModal = ({ jointCheckId, onClose }: JointCheckDetailModalProps) => {
  const { user } = useAuth();
  const { formatValue, CURRENCY_SYMBOLS } = useCurrency();
  const [jointCheck, setJointCheck] = useState<JointCheck | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeToJointCheck(jointCheckId, setJointCheck), [jointCheckId]);

  const payments = useMemo(() => {
    if (!jointCheck?.payments) return [];
    return Object.entries(jointCheck.payments).map(([id, payment]) => ({ id, ...payment })).sort((a, b) => b.paidAt - a.paidAt);
  }, [jointCheck]);

  if (!jointCheck) {
    return (
      <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">Спільний чек</h2>
            <div className="modal-close" onClick={onClose}>×</div>
          </div>
          <div className="analytics-empty">Завантаження...</div>
        </div>
      </div>
    );
  }

  const currency = jointCheck.currency as Currency;
  const paidAmount = Math.max(0, jointCheck.totalAmount - jointCheck.remainingAmount);
  const paidPercent = jointCheck.totalAmount > 0 ? Math.min(100, (paidAmount / jointCheck.totalAmount) * 100) : 0;

  const handlePay = async () => {
    if (!user) return;
    const amount = getKeypadNumericValue(paymentAmount);
    if (amount <= 0) return;
    if (amount > jointCheck.remainingAmount) {
      setError(`Можна закрити максимум ${formatValue(jointCheck.remainingAmount, currency)}.`);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
      await addJointCheckPayment(jointCheck.id, user.id, displayName, amount);
      setPaymentAmount("");
    } catch (err) {
      console.error(err);
      setError("Не вдалося додати погашення.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">{jointCheck.title}</h2>
          <div className="modal-close" onClick={onClose}>×</div>
        </div>

        <div className="joint-progress-ring">
          <span>Залишилось закрити</span>
          <strong>{formatValue(jointCheck.remainingAmount, currency)}</strong>
          <small>із {formatValue(jointCheck.totalAmount, currency)}</small>
          <div className="hub-progress large" style={{ marginTop: "14px" }}>
            <span style={{ width: `${paidPercent}%` }} />
          </div>
        </div>

        {!jointCheck.isClosed && (
          <div style={{ marginTop: "14px" }}>
            <NumericKeypad
              value={paymentAmount}
              onChange={setPaymentAmount}
              currencySymbol={CURRENCY_SYMBOLS[currency]}
              onSubmit={handlePay}
              submitLabel="Закрити частину"
              isLoading={isSaving}
            />
            {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "8px" }}>{error}</p>}
          </div>
        )}

        {jointCheck.isClosed && (
          <div className="hub-empty" style={{ marginTop: "14px", padding: "20px 12px" }}>Чек повністю закрито</div>
        )}

        <div className="joint-section-title" style={{ marginTop: "18px" }}>Учасники</div>
        <div className="joint-participants">
          {Object.values(jointCheck.participants || {}).map((participant) => (
            <div key={participant.userId} className="joint-person">
              <div>
                <strong>{participant.displayName}</strong>
                <small>{participant.username ? `@${participant.username}` : `ID ${participant.userId}`}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="joint-section-title" style={{ marginTop: "14px" }}>Погашення</div>
        <div className="joint-participants">
          {payments.length === 0 ? (
            <div className="hub-empty" style={{ padding: "20px 12px" }}>Погашень ще немає</div>
          ) : payments.map((payment: JointCheckPayment & { id: string }) => (
            <div key={payment.id} className="joint-person">
              <div>
                <strong>{payment.displayName}</strong>
                <small>{new Date(payment.paidAt).toLocaleString("uk-UA")}</small>
              </div>
              <strong>{formatValue(payment.amount, currency)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
