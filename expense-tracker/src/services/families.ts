import { apiClient } from './api';

export type FamilyRole = 'owner' | 'admin' | 'member';

export interface FamilySummary {
  id: string;
  name: string;
  currency: 'EUR' | 'USD' | 'UAH';
  role: FamilyRole;
  joinedAt: number;
}

export interface FamilyMember {
  userId: string;
  displayName: string;
  username?: string;
  role: FamilyRole;
  joinedAt: number;
}

export interface FamilyDetails {
  id: string;
  name: string;
  currency: 'EUR' | 'USD' | 'UAH';
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  members: Record<string, FamilyMember>;
}

export interface FamilyInvite {
  code: string;
  familyId: string;
  familyName: string;
  role: Exclude<FamilyRole, 'owner'>;
  expiresAt: number;
  maxUses: number;
  usedCount: number;
}

export function createFamily(input: {
  name: string;
  currency: string;
  walletName: string;
  initialBalance: number;
}) {
  return apiClient.post<{ family: FamilySummary; walletId: string }>('/api/families', input);
}

export function joinFamily(code: string) {
  return apiClient.post<{ family: FamilySummary }>('/api/families/join', { code });
}

export function createFamilyInvite(familyId: string, role: 'admin' | 'member' = 'member') {
  return apiClient.post<{ invite: FamilyInvite }>(
    `/api/families/${encodeURIComponent(familyId)}/invites`,
    { role },
  );
}

export function updateFamilyMemberRole(familyId: string, memberId: string, role: FamilyRole) {
  return apiClient.put<{ memberId: string; role: FamilyRole }>(
    `/api/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(memberId)}`,
    { role },
  );
}

export function removeFamilyMember(familyId: string, memberId: string) {
  return apiClient.delete<void>(
    `/api/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(memberId)}`,
  );
}

export function deleteFamily(familyId: string) {
  return apiClient.delete<void>(`/api/families/${encodeURIComponent(familyId)}`);
}
