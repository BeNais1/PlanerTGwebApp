export const FAMILY_ROLES = new Set(['owner', 'admin', 'member']);

export function canManageFamily(role) {
  return role === 'owner' || role === 'admin';
}

export function canChangeMemberRole(actorRole, targetRole, nextRole) {
  if (!FAMILY_ROLES.has(nextRole) || nextRole === 'owner') return false;
  if (actorRole === 'owner') return targetRole !== 'owner';
  return actorRole === 'admin' && targetRole === 'member' && nextRole === 'member';
}

export function canRemoveFamilyMember(actorId, actorRole, targetId, targetRole) {
  if (actorId === targetId) return targetRole !== 'owner';
  if (actorRole === 'owner') return targetRole !== 'owner';
  return actorRole === 'admin' && targetRole === 'member';
}

export function normalizeFamilyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function normalizeCurrency(value) {
  return ['EUR', 'USD', 'UAH'].includes(value) ? value : 'UAH';
}
