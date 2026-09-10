interface TagInputProps { value: string; onChange: (value: string) => void }
export function TagInput({ value, onChange }: TagInputProps) {
  return <label className="transaction-compose-field"><span className="transaction-compose-field-label">Теги</span><input className="modal-input" value={value} maxLength={330} onChange={event => onChange(event.target.value)} placeholder="Відпустка, ремонт" /><small className="field-hint">Через кому · до 10 тегів</small></label>;
}
