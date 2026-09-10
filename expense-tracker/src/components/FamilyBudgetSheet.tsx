import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useFamilyBudget } from '../context/useFamilyBudget';
import {
  createFamily,
  createFamilyInvite,
  deleteFamily,
  joinFamily,
  removeFamilyMember,
  updateFamilyMemberRole,
  type FamilyInvite,
  type FamilyRole,
} from '../services/families';
import './FamilyBudgetSheet.css';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface FamilyBudgetSheetProps {
  onClose: () => void;
}

type Mode = 'spaces' | 'create' | 'join' | 'members';

const ROLE_LABELS: Record<FamilyRole, string> = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
};

function getFriendlyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Не вдалося виконати дію. Спробуйте ще раз';
  if (/invalid or expired|not found/i.test(error.message)) {
    return 'Запрошення недійсне. Попросіть власника створити нове';
  }
  if (/network|fetch/i.test(error.message)) {
    return 'Немає з’єднання із сервером. Перевірте інтернет і спробуйте ще раз';
  }
  return error.message;
}

export function FamilyBudgetSheet({ onClose }: FamilyBudgetSheetProps) {
  const { user } = useAuth();
  const {
    spaces,
    activeSpace,
    activeFamily,
    isFamily,
    pendingInviteCode,
    clearPendingInvite,
    setActiveSpaceId,
  } = useFamilyBudget();
  const [mode, setMode] = useState<Mode>(pendingInviteCode ? 'join' : 'spaces');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [walletName, setWalletName] = useState('Сімейний гаманець');
  const [initialBalance, setInitialBalance] = useState('');
  const [inviteCode, setInviteCode] = useState(pendingInviteCode);
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (pendingInviteCode) {
      setInviteCode(pendingInviteCode);
      setMode('join');
    }
  }, [pendingInviteCode]);

  const ownRole = activeSpace.role;
  const members = useMemo(
    () => Object.values(activeFamily?.members || {}).sort((a, b) => a.joinedAt - b.joinedAt),
    [activeFamily],
  );

  const run = async (action: () => Promise<void>) => {
    setError('');
    setIsBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(getFriendlyError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreate = () => run(async () => {
    if (!name.trim()) throw new Error('Введіть назву сім’ї');
    const result = await createFamily({
      name: name.trim(),
      currency,
      walletName: walletName.trim() || 'Сімейний гаманець',
      initialBalance: Number(initialBalance.replace(',', '.')) || 0,
    });
    setActiveSpaceId(result.family.id);
    setMode('spaces');
  });

  const handleJoin = () => run(async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(code)) throw new Error('Код має складатися з 12 символів');
    const result = await joinFamily(code);
    clearPendingInvite();
    setActiveSpaceId(result.family.id);
    onClose();
  });

  const handleCreateInvite = () => run(async () => {
    if (!isFamily) return;
    const result = await createFamilyInvite(activeSpace.id, inviteRole);
    setInvite(result.invite);
    setCopyConfirmed(false);
  });

  const inviteLink = invite
    ? `https://t.me/planer0bot?startapp=family_${invite.code}`
    : '';

  const handleCopyInvite = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopyConfirmed(true);
  };

  return (
    <div className="family-sheet-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="family-sheet" aria-label="Сімейний бюджет">
        <header className="family-sheet-header">
          {mode !== 'spaces' ? (
            <button type="button" className="family-icon-btn" onClick={() => { setMode('spaces'); setError(''); }}>←</button>
          ) : <span className="family-sheet-mark">⌂</span>}
          <div>
            <h2>Простори бюджету</h2>
            
          </div>
          <button type="button" className="family-icon-btn" aria-label="Закрити" onClick={onClose}>×</button>
        </header>

        {mode === 'spaces' && (
          <>
            <div className="family-space-list">
              {spaces.map((space) => (
                <div key={space.id}>
                <button
                  type="button"
                  className={`family-space-row ${activeSpace.id === space.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveSpaceId(space.id);
                    onClose();
                  }}
                >
                  <span className="family-space-avatar">{space.type === 'personal' ? 'Я' : space.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <strong>{space.name}</strong>
                    <small>{space.type === 'personal' ? 'Лише ви' : ROLE_LABELS[space.role]}</small>
                  </span>
                  <span className="family-space-check">{activeSpace.id === space.id ? '✓' : '›'}</span>
                </button>
                {space.type === 'family' && space.role === 'owner' && (
                  <button type="button" className="family-delete-btn" disabled={isBusy} onClick={() => setFamilyToDelete(space)}>Видалити сім’ю «{space.name}»</button>
                )}
                </div>
              ))}
            </div>
            <div className="family-sheet-actions">
              <button type="button" onClick={() => setMode('create')}>＋ Створити сім’ю</button>
              <button type="button" onClick={() => setMode('join')}>Ввести код запрошення</button>
              {isFamily && <button type="button" onClick={() => setMode('members')}>Учасники та запрошення</button>}
            </div>
          </>
        )}

        {mode === 'create' && (
          <div className="family-form">
            <label>Назва сім’ї<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Наприклад, Сім’я Іваненків" /></label>
            <div className="family-form-grid">
              <label>Валюта
                <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  <option value="UAH">UAH ₴</option><option value="EUR">EUR €</option><option value="USD">USD $</option>
                </select>
              </label>
              <label>Початковий баланс<input inputMode="decimal" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} placeholder="0" /></label>
            </div>
            <label>Перший гаманець<input value={walletName} onChange={(event) => setWalletName(event.target.value)} /></label>
            <button type="button" className="family-primary-btn" disabled={isBusy} onClick={handleCreate}>
              {isBusy ? 'Створюємо…' : 'Створити сімейний бюджет'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="family-form">
            <div className="family-join-art">👨‍👩‍👧‍👦</div>
            <h3>Приєднатися до сім’ї</h3>
            <p>Після приєднання з’являться спільні гаманці, операції, ліміти та аналітика.</p>
            <label>Код запрошення<input className="family-code-input" value={inviteCode} maxLength={12} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="A1B2C3D4E5F6" /></label>
            <button type="button" className="family-primary-btn" disabled={isBusy} onClick={handleJoin}>
              {isBusy ? 'Підключаємо…' : 'Приєднатися'}
            </button>
          </div>
        )}

        {mode === 'members' && isFamily && (
          <div className="family-members">
            {ownRole !== 'member' && <div className="family-invite-card">
              <div>
                <strong>Запросити учасника</strong>
                <small>Посилання діє 24 години</small>
              </div>
              {ownRole === 'owner' && (
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'admin' | 'member')}>
                  <option value="member">Учасник</option><option value="admin">Адміністратор</option>
                </select>
              )}
              <button type="button" disabled={isBusy} onClick={handleCreateInvite}>Створити посилання</button>
              {invite && (
                <div className="family-invite-result">
                  <code>{invite.code}</code>
                  <button type="button" onClick={handleCopyInvite}>{copyConfirmed ? 'Скопійовано ✓' : 'Скопіювати'}</button>
                </div>
              )}
            </div>}
            <h3>Учасники · {members.length}</h3>
            {members.map((member) => {
              const isSelf = member.userId === String(user?.id);
              const canEdit = ownRole === 'owner' && member.role !== 'owner';
              const canRemove = (isSelf && member.role !== 'owner')
                || (ownRole === 'owner' && member.role !== 'owner')
                || (ownRole === 'admin' && member.role === 'member');
              return (
                <div className="family-member-row" key={member.userId}>
                  <span className="family-space-avatar">{member.displayName.slice(0, 1).toUpperCase()}</span>
                  <span className="family-member-name">
                    <strong>{member.displayName}{isSelf ? ' · ви' : ''}</strong>
                    <small>{member.username ? `@${member.username}` : ROLE_LABELS[member.role]}</small>
                  </span>
                  {canEdit ? (
                    <select
                      value={member.role}
                      disabled={isBusy}
                      onChange={(event) => {
                        const nextRole = event.target.value as FamilyRole;
                        if (nextRole === 'owner' && !window.confirm(`Передати ${member.displayName} права власника сім’ї?`)) return;
                        run(async () => {
                          await updateFamilyMemberRole(activeSpace.id, member.userId, nextRole);
                        });
                      }}
                    >
                      <option value="member">Учасник</option><option value="admin">Адмін</option><option value="owner">Передати володіння</option>
                    </select>
                  ) : <span className="family-role-badge">{ROLE_LABELS[member.role]}</span>}
                  {canRemove && (
                    <button type="button" className="family-remove-btn" disabled={isBusy} onClick={() => run(async () => {
                      await removeFamilyMember(activeSpace.id, member.userId);
                      if (isSelf) {
                        setActiveSpaceId('personal');
                        onClose();
                      }
                    })}>{isSelf ? 'Вийти' : '×'}</button>
                  )}
                </div>
              );
            })}
            {ownRole === 'owner' && (
              <button
                type="button"
                className="family-delete-btn"
                disabled={isBusy}
                onClick={() => setFamilyToDelete(activeSpace)}
              >
                Видалити сімейний бюджет
              </button>
            )}
          </div>
        )}

        {familyToDelete && (
          <ConfirmDeleteDialog
            title={`Видалити сім’ю «${familyToDelete.name}»?`}
            description="Спільні гаманці, операції, цілі та запрошення буде видалено для всіх учасників. Особисті акаунти залишаться. Цю дію неможливо скасувати."
            onConfirm={async () => {
              await deleteFamily(familyToDelete.id);
              if (activeSpace.id === familyToDelete.id) setActiveSpaceId('personal');
              setMode('spaces');
            }}
            onClose={() => setFamilyToDelete(null)}
          />
        )}
        {error && <p className="family-error">{error}</p>}
      </section>
    </div>
  );
}
