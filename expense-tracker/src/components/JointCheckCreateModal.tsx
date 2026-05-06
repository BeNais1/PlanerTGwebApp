import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCurrency, type Currency } from "../hooks/useCurrency";
import { NumericKeypad, getKeypadNumericValue } from "./NumericKeypad";
import { QrScannerSheet } from "./QrScannerSheet";
import {
  createJointCheck,
  getParticipantByTemporaryCode,
  type JointCheckParticipant,
} from "../services/database";
import "./modals/Modals.css";
import "./JointCheck.css";

interface JointCheckCreateModalProps {
  walletBalances: Record<string, number>;
  onClose: () => void;
}

export const JointCheckCreateModal = ({ walletBalances, onClose }: JointCheckCreateModalProps) => {
  const { user } = useAuth();
  const { currency: mainCurrency, CURRENCY_SYMBOLS, formatValue } = useCurrency();
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("Спільний чек");
  const [currency, setCurrency] = useState<Currency>(mainCurrency);
  const [participants, setParticipants] = useState<JointCheckParticipant[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const availableWallets = Object.keys(walletBalances).length > 0
    ? Object.keys(walletBalances) as Currency[]
    : [mainCurrency];

  const addParticipant = (participant: JointCheckParticipant) => {
    if (!user || participant.userId === String(user.id)) {
      setError("Ви вже є учасником цього чека.");
      return;
    }
    if (participants.some((item) => item.userId === participant.userId)) {
      setError("Цей учасник вже доданий.");
      return;
    }
    setError("");
    setParticipants((current) => [...current, participant]);
  };

  const handleAddByCode = async () => {
    const participant = await getParticipantByTemporaryCode(manualCode);
    if (!participant) {
      setError("Код не знайдено або він вже не діє.");
      return;
    }
    addParticipant(participant);
    setManualCode("");
  };

  const handleCreate = async () => {
    if (!user) return;
    const totalAmount = getKeypadNumericValue(amount);
    if (totalAmount <= 0) {
      setError("Вкажіть суму чека.");
      return;
    }

    setIsSaving(true);
    try {
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
      await createJointCheck(user.id, displayName, user.username, totalAmount, currency, participants, title || "Спільний чек");
      onClose();
    } catch (err) {
      console.error(err);
      setError("Не вдалося створити спільний чек.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h2 className="modal-title">Спільний чек</h2>
          <div className="modal-close" onClick={onClose}>×</div>
        </div>

        <div className="joint-form">
          <input className="joint-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Назва чека" />

          <div className="currency-selector" style={{ flexWrap: "wrap" }}>
            {availableWallets.map((walletCurrency) => (
              <button
                key={walletCurrency}
                className={`currency-btn ${currency === walletCurrency ? "active" : ""}`}
                onClick={() => setCurrency(walletCurrency)}
              >
                {walletCurrency}
              </button>
            ))}
          </div>

          <NumericKeypad
            value={amount}
            onChange={setAmount}
            currencySymbol={CURRENCY_SYMBOLS[currency]}
            onSubmit={handleCreate}
            submitLabel={isSaving ? "Створення..." : "Створити чек"}
            disabled={isSaving}
          />

          <div className="joint-section-title">Учасники</div>
          <div className="joint-action-grid">
            <button className="joint-secondary-btn" type="button" onClick={() => setIsScannerOpen(true)}>Сканувати QR</button>
            <button className="joint-secondary-btn" type="button" onClick={handleAddByCode}>Додати ID</button>
          </div>
          <input
            className="joint-input"
            inputMode="numeric"
            maxLength={6}
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value.replace(/\D/g, ""))}
            placeholder="Тимчасовий ID з 6 цифр"
          />

          <div className="joint-participants">
            {participants.length === 0 ? (
              <div className="hub-empty" style={{ padding: "20px 12px" }}>Додайте людей через QR або тимчасовий ID</div>
            ) : participants.map((participant) => (
              <div key={participant.userId} className="joint-person">
                <div>
                  <strong>{participant.displayName}</strong>
                  <small>{participant.username ? `@${participant.username}` : `ID ${participant.userId}`}</small>
                </div>
                <button type="button" onClick={() => setParticipants((current) => current.filter((item) => item.userId !== participant.userId))}>×</button>
              </div>
            ))}
          </div>

          {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: "13px" }}>{error}</p>}
          {amount && (
            <p style={{ margin: 0, color: "var(--text-tertiary)", fontSize: "12px", textAlign: "center" }}>
              Після збереження у всіх учасників з'явиться окрема операція на {formatValue(getKeypadNumericValue(amount), currency)}.
            </p>
          )}
        </div>
      </div>

      {isScannerOpen && (
        <QrScannerSheet
          onClose={() => setIsScannerOpen(false)}
          onParticipant={addParticipant}
        />
      )}
    </div>
  );
};
