import { useEffect, useState } from 'react';

export const TelegramOnlyScreen = () => {
  const [botUrl] = useState('https://t.me/planer0bot'); // Ім'я бота @planer0bot
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    // Генеруємо QR код через API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(botUrl)}`;
    setQrCodeUrl(qrUrl);
  }, [botUrl]);

  return (
    <div className="telegram-only-screen">
      <div className="telegram-only-content">
        <div className="telegram-icon">
          <svg width="80" height="80" viewBox="0 0 240 240" fill="none">
            <circle cx="120" cy="120" r="120" fill="#0088cc"/>
            <path d="M81.229 128.772l14.237 39.406s1.78 3.687 3.686 3.687 30.255-29.492 30.255-29.492l31.525-60.89L81.737 118.6" fill="#c8daea"/>
            <path d="M100.106 138.878l-2.733 29.046s-1.144 8.9 7.754 0 17.415-15.763 17.415-15.763" fill="#a9c6d8"/>
            <path d="M81.486 130.178l-17.8-5.467s-2.123-.788-1.467-2.59c.135-.373.388-.788 1.296-1.46 4.073-3.315 75.01-28.692 75.01-28.692s2.087-.733 3.468-.733c.609 0 1.296.135 1.819.631.455.42.606 1.045.606 1.618-.043.573-.043.859-.043.859s-.537 21.455-1.603 48.4c-.135 3.398-.405 5.916-.675 7.234-.27 1.318-.81 2.59-2.123 3.59-1.296.982-3.468.733-4.764.135-1.296-.598-21.892-14.127-28.24-18.579-.27-.203-.54-.406-.81-.609-.81-.598-1.62-1.196-1.62-2.123 0-.733.405-1.466 1.08-2.123 1.62-1.466 18.579-17.415 24.927-23.763 1.296-1.296 2.59-4.073-1.296-1.466-8.9 5.916-33.827 22.875-36.417 24.927-1.296.982-2.59 1.466-3.886 1.466-.81 0-1.62-.135-2.43-.405z" fill="#fff"/>
          </svg>
        </div>
        
        <h1 className="telegram-only-title">Відкрийте в Telegram</h1>
        <p className="telegram-only-description">
          Цей додаток доступний лише у Telegram Mini App
        </p>

        {qrCodeUrl && (
          <div className="qr-code-container">
            <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
            <p className="qr-code-hint">Відскануйте QR код у Telegram</p>
          </div>
        )}

        <div className="telegram-only-instructions">
          <h3>Як відкрити:</h3>
          <ol>
            <li>Відкрийте Telegram на телефоні</li>
            <li>Знайдіть бота або відскануйте QR код</li>
            <li>Натисніть "Відкрити додаток"</li>
          </ol>
        </div>

        <a href={botUrl} className="telegram-button" target="_blank" rel="noopener noreferrer">
          Відкрити в Telegram
        </a>
      </div>
    </div>
  );
};
