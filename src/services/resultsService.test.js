import { describe, expect, it } from 'vitest';
import { mapPublicResultsPayload } from '../services/resultsService';

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
