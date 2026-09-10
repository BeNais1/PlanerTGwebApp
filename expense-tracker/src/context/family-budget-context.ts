import { createContext } from 'react';
import type { FamilyDetails, FamilyRole, FamilySummary } from '../services/families';

export interface BudgetSpace {
  id: string;
  type: 'personal' | 'family';
  name: string;
  role: FamilyRole;
  currency?: string;
}

export interface FamilyBudgetContextValue {
  spaces: BudgetSpace[];
  families: FamilySummary[];
  activeSpace: BudgetSpace;
  activeFamily: FamilyDetails | null;
  dataOwnerId: string;
  isFamily: boolean;
  isLoading: boolean;
  pendingInviteCode: string;
  clearPendingInvite: () => void;
  setActiveSpaceId: (spaceId: string) => void;
}

export const FamilyBudgetContext = createContext<FamilyBudgetContextValue | undefined>(undefined);
