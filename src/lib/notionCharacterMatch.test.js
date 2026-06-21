import { describe, expect, it } from 'vitest';
import {
  findCharacterByDisplayName,
  parseNotionMemberName,
  parseNotionTeamNames,
  resolveNotionTeamCharacters,
} from './notionCharacterMatch';

describe('notionCharacterMatch', () => {
  it('parses member lines and team labels', () => {
    expect(parseNotionMemberName('Ху Тао C1 | АТК 2400')).toBe('Ху Тао');
    expect(parseNotionMemberName('hu-tao|Ху Тао C1 | АТК 2400')).toBe('Ху Тао');
    expect(parseNotionTeamNames('Нахида, Кадзуха, Син Цю, Нилou')).toEqual([
      'Нахида',
      'Кадзуха',
      'Син Цю',
      'Нилou',
    ]);
  });

  it('resolves characters by Russian display names', () => {
    const venti = findCharacterByDisplayName('Венти');
    const huTao = findCharacterByDisplayName('Ху Тао');
    expect(huTao?.id).toBe('hu-tao');
    expect(venti?.id).toBe('venti');

    const team = resolveNotionTeamCharacters({
      team_label: 'Венти, Ху Тао',
      members: ['Ху Тао C1 | АТК 2400', 'Венти C0 | АТК 1800'],
    });
    expect(team).toHaveLength(2);
    expect(team[0].character?.id).toBe('hu-tao');
    expect(team[1].character?.id).toBe('venti');
  });

  it('resolves characters by ids when notion item includes them', () => {
    const team = resolveNotionTeamCharacters({
      team_label: 'Старые имена',
      character_ids: ['hu-tao', 'venti'],
    });

    expect(team).toHaveLength(2);
    expect(team[0].character?.id).toBe('hu-tao');
    expect(team[1].character?.id).toBe('venti');
  });

  it('resolves characters by ids embedded in member lines', () => {
    const team = resolveNotionTeamCharacters({
      team_label: 'Старые имена',
      members: ['hu-tao|Ху Тао C1 | АТК 2400', 'venti|Венти C0 | АТК 1800'],
    });

    expect(team).toHaveLength(2);
    expect(team[0].character?.id).toBe('hu-tao');
    expect(team[1].character?.id).toBe('venti');
  });
});
