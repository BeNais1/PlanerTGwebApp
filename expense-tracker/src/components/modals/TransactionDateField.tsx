import { type ChangeEvent } from 'react';

interface TransactionDateFieldProps {
  value: number;
  onChange: (value: number) => void;
}

function toLocalDateTimeValue(timestamp: number): string {
  const date = new Date(timestamp);
  const localTimestamp = timestamp - date.getTimezoneOffset() * 60_000;
  return new Date(localTimestamp).toISOString().slice(0, 16);
}

export const TransactionDateField = ({ value, onChange }: TransactionDateFieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const timestamp = new Date(event.target.value).getTime();
    if (!Number.isNaN(timestamp)) {
      onChange(timestamp);
    }
  };

  return (
    <label className="modal-input-group">
      <span className="modal-label">Дата і час платежу</span>
      <input
        aria-label="Дата і час платежу"
        className="modal-input"
        type="datetime-local"
        value={toLocalDateTimeValue(value)}
        onChange={handleChange}
        step={60}
        style={{ fontSize: '14px', padding: '10px 14px' }}
      />
    </label>
  );
};
