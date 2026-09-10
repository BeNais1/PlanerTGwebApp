import { useEffect, useRef, useState } from 'react';

export interface UndoToastAction {
  id: string;
  message: string;
  undoLabel: string;
  undo: () => Promise<void>;
}

interface UndoToastProps {
  action: UndoToastAction;
  onDone: () => void;
}

const UNDO_TIMEOUT_SECONDS = 5;

export function UndoToast({ action, onDone }: UndoToastProps) {
  const [secondsLeft, setSecondsLeft] = useState(UNDO_TIMEOUT_SECONDS);
  const finishedRef = useRef(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    const timeoutId = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onDone();
    }, UNDO_TIMEOUT_SECONDS * 1000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [onDone]);

  const handleUndo = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      await action.undo();
    } finally {
      onDone();
    }
  };

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <div className="undo-toast-copy">
        <strong>{action.message}</strong>
        <span>Можна скасувати ще {secondsLeft} с.</span>
      </div>
      <button type="button" className="undo-toast-button" onClick={handleUndo}>
        {action.undoLabel}
      </button>
      <span className="undo-toast-progress" aria-hidden="true" />
    </div>
  );
}
