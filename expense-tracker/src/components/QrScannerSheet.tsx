import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { parseUserQrPayload, type JointCheckParticipant } from "../services/database";
import "./JointCheck.css";

interface QrScannerSheetProps {
  onClose: () => void;
  onParticipant: (participant: JointCheckParticipant) => void;
}

export const QrScannerSheet = ({ onClose, onParticipant }: QrScannerSheetProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let frame = 0;
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || stopped) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height);
          if (code?.data) {
            const participant = parseUserQrPayload(code.data);
            if (participant) {
              onParticipant(participant);
              onClose();
              return;
            }
            setError("Це не QR-код користувача Planer.");
          }
        }
      }
      frame = requestAnimationFrame(scan);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(scan).catch(() => scan());
        }
      })
      .catch(() => setError("Не вдалося відкрити камеру. Перевірте дозвіл у Telegram або браузері."));

    return stop;
  }, [onClose, onParticipant]);

  return (
    <div className="camera-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="camera-sheet">
        <div className="camera-header">
          <h3>Сканер QR</h3>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="camera-video-wrap">
          <video ref={videoRef} playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="camera-frame" />
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>{error}</p>}
      </div>
    </div>
  );
};
