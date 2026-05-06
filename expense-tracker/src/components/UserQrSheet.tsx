import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import {
  getOrCreateTemporaryUserCode,
  getUserQrPayload,
  type TemporaryUserCode,
} from "../services/database";
import "./JointCheck.css";

interface UserQrSheetProps {
  onClose: () => void;
}

export const UserQrSheet = ({ onClose }: UserQrSheetProps) => {
  const { user } = useAuth();
  const [qrUrl, setQrUrl] = useState("");
  const [tempCode, setTempCode] = useState<TemporaryUserCode | null>(null);
  const [copyState, setCopyState] = useState("Скопіювати ID");

  useEffect(() => {
    if (!user) return;
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    const payload = getUserQrPayload(user.id, displayName, user.username);
    QRCode.toDataURL(payload, { margin: 1, width: 230, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrUrl)
      .catch(console.error);
    getOrCreateTemporaryUserCode(user.id, displayName, user.username)
      .then(setTempCode)
      .catch(console.error);
  }, [user]);

  const expiresLabel = tempCode
    ? new Date(tempCode.expiresAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
    : "";

  const handleCopyCode = async () => {
    if (!tempCode?.code) return;
    try {
      await navigator.clipboard.writeText(tempCode.code);
      setCopyState("Скопійовано");
      setTimeout(() => setCopyState("Скопіювати ID"), 1400);
    } catch {
      setCopyState("Не вдалося");
      setTimeout(() => setCopyState("Скопіювати ID"), 1400);
    }
  };

  return (
    <div className="qr-sheet-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="qr-sheet">
        <div className="qr-sheet-header">
          <h3>Мій QR-код</h3>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="qr-canvas-box">
          {qrUrl ? <img src={qrUrl} width={230} height={230} alt="QR-код користувача" /> : null}
        </div>

        <div className="qr-code-number">
          <span>Тимчасовий ID</span>
          <strong>{tempCode?.code || "------"}</strong>
          <small>{expiresLabel ? `Діє до ${expiresLabel}` : "Оновлюється раз на годину"}</small>
          <button type="button" className="qr-copy-btn" onClick={handleCopyCode} disabled={!tempCode?.code}>
            {copyState}
          </button>
        </div>
      </div>
    </div>
  );
};
