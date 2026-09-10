import { describe, expect, it } from 'vitest';
import {
  canChangeMemberRole,
  canManageFamily,
  canRemoveFamilyMember,
  normalizeCurrency,
  normalizeFamilyName,
} from '../backend/utils/families.js';

describe('family roles', () => {
  it('allows owners and admins to manage a family', () => {
    expect(canManageFamily('owner')).toBe(true);
    expect(canManageFamily('admin')).toBe(true);
    expect(canManageFamily('member')).toBe(false);
  });

  it('only lets the owner promote another member', () => {
    expect(canChangeMemberRole('owner', 'member', 'admin')).toBe(true);
    expect(canChangeMemberRole('admin', 'member', 'admin')).toBe(false);
    expect(canChangeMemberRole('owner', 'owner', 'member')).toBe(false);
  });

  it('protects the owner and permits members to leave', () => {
    expect(canRemoveFamilyMember('1', 'member', '1', 'member')).toBe(true);
    expect(canRemoveFamilyMember('1', 'owner', '1', 'owner')).toBe(false);
    expect(canRemoveFamilyMember('1', 'admin', '2', 'member')).toBe(true);
  });
});

describe('family setup normalization', () => {
  it('normalizes names and rejects unsupported currencies', () => {
    expect(normalizeFamilyName('  Наша   семья  ')).toBe('Наша семья');
    expect(normalizeCurrency('EUR')).toBe('EUR');
    expect(normalizeCurrency('BTC')).toBe('UAH');
  });
});
