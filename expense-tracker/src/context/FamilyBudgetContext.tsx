import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../config/firebase';
import { useAuth } from './useAuth';
import type { FamilyDetails, FamilySummary } from '../services/families';
import { FamilyBudgetContext, type BudgetSpace } from './family-budget-context';

const ACTIVE_SPACE_KEY = 'active-budget-space';

function readInviteCode(): string {
  const tgParam = window.Telegram?.WebApp.initDataUnsafe?.start_param;
  const urlParam = new URLSearchParams(window.location.search).get('family');
  const raw = typeof tgParam === 'string' && tgParam.startsWith('family_')
    ? tgParam.slice('family_'.length)
    : urlParam || '';
  return /^[A-Fa-f0-9]{12}$/.test(raw) ? raw.toUpperCase() : '';
}

export function FamilyBudgetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [activeSpaceId, setActiveSpaceIdState] = useState(() => localStorage.getItem(ACTIVE_SPACE_KEY) || 'personal');
  const [activeFamily, setActiveFamily] = useState<FamilyDetails | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(user));
  const [pendingInviteCode, setPendingInviteCode] = useState(readInviteCode);

  useEffect(() => {
    if (!user) return;
    const familiesRef = ref(database, `user_family_spaces/${user.id}`);
    return onValue(familiesRef, (snapshot) => {
      const values = snapshot.exists()
        ? Object.values(snapshot.val() as Record<string, FamilySummary>)
        : [];
      values.sort((a, b) => a.joinedAt - b.joinedAt);
      setFamilies(values);
      setIsLoading(false);
      setActiveSpaceIdState((current) => (
        current === 'personal' || values.some((family) => family.id === current)
          ? current
          : 'personal'
      ));
    });
  }, [user]);

  useEffect(() => {
    if (activeSpaceId === 'personal') return;
    return onValue(ref(database, `family_spaces/${activeSpaceId}`), (snapshot) => {
      setActiveFamily(snapshot.exists() ? snapshot.val() as FamilyDetails : null);
    });
  }, [activeSpaceId]);

  const spaces = useMemo<BudgetSpace[]>(() => [
    {
      id: 'personal',
      type: 'personal',
      name: 'Особистий бюджет',
      role: 'owner',
      currency: undefined,
    },
    ...families.map((family) => ({
      id: family.id,
      type: 'family' as const,
      name: family.name,
      role: family.role,
      currency: family.currency,
    })),
  ], [families]);

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) || spaces[0];
  const dataOwnerId = activeSpace.type === 'family' ? `family_${activeSpace.id}` : String(user?.id || '');

  const setActiveSpaceId = (spaceId: string) => {
    localStorage.setItem(ACTIVE_SPACE_KEY, spaceId);
    setActiveSpaceIdState(spaceId);
  };

  return (
    <FamilyBudgetContext.Provider value={{
      spaces,
      families: user ? families : [],
      activeSpace,
      activeFamily: activeSpace.type === 'family' ? activeFamily : null,
      dataOwnerId,
      isFamily: activeSpace.type === 'family',
      isLoading: user ? isLoading : false,
      pendingInviteCode,
      clearPendingInvite: () => setPendingInviteCode(''),
      setActiveSpaceId,
    }}>
      {children}
    </FamilyBudgetContext.Provider>
  );
}
