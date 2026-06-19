import { describe, expect, it } from 'vitest';
import {
  filterMyResultsUsers,
  mapPublicResultsPayload,
  shouldUseLocalResultsSummary,
  updateMyDisplayName,
} from '../services/resultsService';
import { LOCAL_USER_ID } from '../lib/displayName';

describe('mapPublicResultsPayload', () => {
  it('maps team and configs from rpc payload', () => {
    const result = mapPublicResultsPayload({
      displayName: 'Tester',
      rotationSeconds: 25,
      team: ['hu_tao', 'xingqiu'],
      configs: [{
        characterId: 'hu_tao',
        level: 90,
        atk: { base: 100, bonus: 200 },
        hp: 1,
        def: 1,
        em: 0,
        critRate: 50,
        critDmg: 100,
        energyRecharge: 120,
        constellation: 0,
        artifacts: {},
      }],
    });

    expect(result.displayName).toBe('Tester');
    expect(result.rotationSeconds).toBe(25);
    expect(result.team).toEqual(['hu_tao', 'xingqiu']);
    expect(result.configs).toHaveLength(1);
    expect(result.configs[0].characterId).toBe('hu_tao');
  });

  it('handles null payload', () => {
    const result = mapPublicResultsPayload(null);
    expect(result.team).toEqual([]);
    expect(result.configs).toEqual([]);
    expect(result.displayName).toBe('Игрок');
  });
});

describe('updateMyDisplayName', () => {
  it('returns field hint for empty name', async () => {
    await expect(updateMyDisplayName('   ')).rejects.toMatchObject({
      message: 'Укажите имя',
      field: 'displayName',
    });
  });
});

describe('filterMyResultsUsers', () => {
  const users = [
    { userId: LOCAL_USER_ID, displayName: 'Вы (локально)' },
    { userId: 'user-a', displayName: 'Алиса' },
    { userId: 'user-b', displayName: 'Боб' },
  ];

  it('returns only local entry for guest', () => {
    const result = filterMyResultsUsers(users, {
      session: null,
      isAuthenticated: false,
      profileDisplayName: null,
    });
    expect(result).toEqual([{ userId: LOCAL_USER_ID, displayName: 'Вы (локально)' }]);
  });

  it('returns only current user when authenticated', () => {
    const result = filterMyResultsUsers(users, {
      session: { user: { id: 'user-b' } },
      isAuthenticated: true,
      profileDisplayName: 'Боб',
    });
    expect(result).toEqual([{ userId: 'user-b', displayName: 'Боб' }]);
  });

  it('creates placeholder entry for authenticated user absent from list', () => {
    const result = filterMyResultsUsers(users, {
      session: { user: { id: 'user-new' } },
      isAuthenticated: true,
      profileDisplayName: 'Новый игрок',
    });
    expect(result).toEqual([{ userId: 'user-new', displayName: 'Новый игрок' }]);
  });
});

describe('shouldUseLocalResultsSummary', () => {
  it('uses local summary for guest local id', () => {
    expect(shouldUseLocalResultsSummary(LOCAL_USER_ID, {
      session: null,
      isAuthenticated: false,
    })).toBe(true);
  });

  it('uses local summary for authenticated own user id', () => {
    expect(shouldUseLocalResultsSummary('user-1', {
      session: { user: { id: 'user-1' } },
      isAuthenticated: true,
    })).toBe(true);
  });

  it('uses remote summary for other users', () => {
    expect(shouldUseLocalResultsSummary('user-2', {
      session: { user: { id: 'user-1' } },
      isAuthenticated: true,
    })).toBe(false);
  });
});
