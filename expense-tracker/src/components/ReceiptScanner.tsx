import { useEffect, useRef, useState } from 'react';
import type { Worker } from 'tesseract.js';
import { parseReceipt, type ReceiptDraft } from '../domain/receipt';

export function ReceiptScanner({ onRecognized, onBusyChange }: { onRecognized: (draft: ReceiptDraft) => void; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [rawText, setRawText] = useState('');
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; void worker.current?.terminate(); worker.current = null; }, []);

  const recognize = async (file?: File) => {
    if (!file || busy) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) {
      setError('Оберіть JPG, PNG або WebP до 15 МБ.'); return;
    }
    const run = ++generation.current;
    setBusy(true); onBusyChange(true); setError(''); setRawText(''); setProgress(0);
    let activeWorker: Worker | null = null;
    try {
      const { createWorker } = await import('tesseract.js');
      if (generation.current !== run) return;
      activeWorker = await createWorker('ukr+eng', 1, {
        logger: message => { if (generation.current === run) setProgress(Math.round(message.progress * 100)); },
      });
      if (generation.current !== run) return;
      worker.current = activeWorker;
      const result = await activeWorker.recognize(file);
      if (generation.current !== run) return;
      const text = result.data.text.trim();
      if (!text) throw new Error('empty');
      setRawText(text);
      onRecognized(parseReceipt(text));
    } catch {
      if (generation.current === run) setError('Не вдалося прочитати чек. Спробуйте чіткіше фото або введіть витрату вручну.');
    } finally {
      if (activeWorker) await activeWorker.terminate().catch(() => {});
      if (generation.current === run) { worker.current = null; setBusy(false); onBusyChange(false); }
    }
  };
  return <div className="receipt-scanner">
    <label className="quiet-action">{busy ? `Розпізнавання… ${progress}%` : 'Сканувати чек'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { void recognize(event.target.files?.[0]); event.target.value = ''; }} /></label>
    {busy && <progress aria-label="Розпізнавання чека" value={progress} max={100} />}
    {error && <p role="alert" className="field-error">{error}</p>}
    {rawText && <details><summary>Текст чека</summary><pre>{rawText}</pre></details>}
  </div>;
}
