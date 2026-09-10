import { useState } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmDeleteDialog.css';

interface ConfirmDeleteDialogProps {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteDialog({ title, description, onConfirm, onClose }: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch {
      setError('Не вдалося видалити. Перевірте з’єднання та спробуйте ще раз.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="confirm-delete-overlay" onClick={(event) => {
      event.stopPropagation();
      if (!busy && event.target === event.currentTarget) onClose();
    }}>
      <section className="confirm-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title" aria-describedby="confirm-delete-description" onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const next = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];
          if (document.activeElement === next) {
            event.preventDefault();
            (event.shiftKey ? buttons[buttons.length - 1] : buttons[0])?.focus();
          }
        }
      }}>
        <h3 id="confirm-delete-title">{title}</h3>
        <p id="confirm-delete-description">{description}</p>
        {error && <p role="alert">{error}</p>}
        <div className="confirm-delete-actions">
          <button type="button" autoFocus disabled={busy} onClick={onClose}>Скасувати</button>
          <button type="button" className="confirm-delete-submit" disabled={busy} onClick={confirm}>{busy ? 'Видаляємо…' : 'Видалити'}</button>
        </div>
      </section>
    </div>, document.body
  );
}
