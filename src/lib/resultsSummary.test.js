import { describe, expect, it, vi } from 'vitest';
import { computeTeamDpsSummary, buildGetConfigFromPayload } from './resultsSummary';
import { findCharacterById } from '../characters';
import { getDefaultConfig } from '../mockData';

describe('resultsSummary', () => {
  it('computes total dps for a team with configs', () => {
    const getConfig = vi.fn((id) => {
      const character = findCharacterById(id);
      return character ? getDefaultConfig(character) : null;
    });

    const summary = computeTeamDpsSummary(
      ['hu-tao'],
      getConfig,
      findCharacterById,
      [],
    );

    expect(summary.teamIds).toEqual(['hu-tao']);
    expect(summary.teamData).toHaveLength(1);
    expect(typeof summary.totalDps).toBe('number');
    expect(summary.teamData[0].characterId).toBe('hu-tao');
  });

  it('builds remote config getter from payload', () => {
    const getRemoteConfig = buildGetConfigFromPayload([
      { characterId: 'venti', level: 80, artifacts: {} },
    ]);

    expect(getRemoteConfig('venti')?.level).toBe(80);
    expect(getRemoteConfig('missing')).toBeNull();
  });
});
