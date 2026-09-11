import { useMemo, useState, type KeyboardEvent } from 'react';
import { normalizeTags } from '../domain/planning';

interface TagInputProps { value: string; onChange: (value: string) => void }

const QUICK_TAGS = ['продукти', 'дім', 'робота', 'здоров’я', 'подорож'];

export function TagInput({ value, onChange }: TagInputProps) {
  const tags = useMemo(() => normalizeTags(value), [value]);
  const [draft, setDraft] = useState('');

  const commit = (candidate: string) => {
    const next = normalizeTags([...tags, candidate]);
    onChange(next.join(', '));
    setDraft('');
  };
  const remove = (tag: string) => onChange(tags.filter(item => item !== tag).join(', '));
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      commit(draft);
    } else if (event.key === 'Backspace' && !draft && tags.length) {
      remove(tags[tags.length - 1]);
    }
  };

  return <div className="transaction-compose-field tag-editor">
    <span className="transaction-compose-field-label">Теги</span>
    <div className="tag-editor-control" onClick={event => (event.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
      {tags.map(tag => <button type="button" key={tag} onClick={event => { event.stopPropagation(); remove(tag); }} aria-label={`Видалити тег ${tag}`}>#{tag}<span aria-hidden="true">×</span></button>)}
      <input value={draft} maxLength={32} onChange={event => {
        const input = event.target.value;
        if (input.includes(',')) commit(input);
        else setDraft(input);
      }} onKeyDown={onKeyDown} onBlur={() => { if (draft.trim()) commit(draft); }} placeholder={tags.length ? 'Ще тег' : 'Додати тег'} aria-label="Новий тег" />
    </div>
    {tags.length < 10 && <div className="tag-suggestions" aria-label="Швидкі теги">{QUICK_TAGS.filter(tag => !tags.includes(tag)).slice(0, 4).map(tag => <button type="button" key={tag} onClick={() => commit(tag)}>+ {tag}</button>)}</div>}
  </div>;
}
