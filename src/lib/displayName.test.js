import { describe, expect, it } from 'vitest';
import { formatDisplayName, validateDisplayName, buildLocalResultsEntry, LOCAL_USER_ID } from '../lib/displayName';

describe('formatDisplayName', () => {
  it('returns trimmed name', () => {
    expect(formatDisplayName('  Alice  ')).toBe('Alice');
  });

  it('falls back to default for empty values', () => {
    expect(formatDisplayName('')).toBe('Игрок');
    expect(formatDisplayName(null)).toBe('Игрок');
  });
});

describe('validateDisplayName', () => {
  it('requires non-empty name', () => {
    expect(validateDisplayName('')).toBe('Укажите имя');
    expect(validateDisplayName('   ')).toBe('Укажите имя');
  });

  it('accepts valid name', () => {
    expect(validateDisplayName('Мира')).toBeNull();
  });

  it('rejects too long name', () => {
    expect(validateDisplayName('a'.repeat(101))).toBe('Имя не должно быть длиннее 100 символов');
  });
});

describe('buildLocalResultsEntry', () => {
  it('uses local user id', () => {
    expect(buildLocalResultsEntry()).toEqual({
      userId: LOCAL_USER_ID,
      displayName: 'Вы (локально)',
    });
  });
});
