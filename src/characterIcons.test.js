import { describe, expect, it } from 'vitest';
import {
  getCharacterIconUrls,
  getCharacterSplashUrls,
  getCharacterConstellationPortraitUrls,
  getTravelerDuoPortraitSets,
} from './characterIcons';
import { findCharacterById } from './characters';

describe('getCharacterIconUrls', () => {
  it('returns empty list when character has no id', () => {
    expect(getCharacterIconUrls({ nameRu: 'Неизвестный' })).toEqual([]);
  });
});

describe('getCharacterSplashUrls', () => {
  it('returns enka gacha splash for Flins', () => {
    const character = findCharacterById('flins');
    expect(getCharacterSplashUrls(character)).toEqual([
      'https://enka.network/ui/UI_Gacha_AvatarImg_Flins.png',
    ]);
  });

  it('returns enka gacha splash for Varka', () => {
    const character = findCharacterById('varka');
    expect(getCharacterSplashUrls(character)).toEqual([
      'https://enka.network/ui/UI_Gacha_AvatarImg_Varka.png',
    ]);
  });

  it('maps loen to Lohen splash file name', () => {
    const character = findCharacterById('loen');
    expect(getCharacterSplashUrls(character)).toEqual([
      'https://enka.network/ui/UI_Gacha_AvatarImg_Lohen.png',
    ]);
  });
});

describe('getCharacterConstellationPortraitUrls', () => {
  it('prefers gacha splash over jmp portrait and circle icon', () => {
    const character = findCharacterById('venti');
    const urls = getCharacterConstellationPortraitUrls(character);

    expect(urls[0]).toBe('https://enka.network/ui/UI_Gacha_AvatarImg_Venti.png');
    expect(urls).not.toContain('https://genshin.jmp.blue/characters/venti/portrait');
    expect(urls).toContain('https://enka.network/ui/UI_AvatarIcon_Side_Venti.png');
    expect(urls).toContain('https://genshin.jmp.blue/characters/venti/icon');
  });

  it('uses gacha splash for characters missing on jmp.blue', () => {
    const character = findCharacterById('flins');
    const urls = getCharacterConstellationPortraitUrls(character);

    expect(urls[0]).toBe('https://enka.network/ui/UI_Gacha_AvatarImg_Flins.png');
  });

  it('maps kazuha id to correct gacha asset name', () => {
    const character = findCharacterById('kaedehara-kazuha');
    const urls = getCharacterConstellationPortraitUrls(character);

    expect(urls[0]).toBe('https://enka.network/ui/UI_Gacha_AvatarImg_Kazuha.png');
  });

  it('returns empty portrait list for traveler and provides duo sets', () => {
    const character = findCharacterById('traveler');
    expect(getCharacterConstellationPortraitUrls(character)).toEqual([]);

    const duo = getTravelerDuoPortraitSets();
    expect(duo.aether[0]).toContain('PlayerBoy');
    expect(duo.lumine[0]).toContain('PlayerGirl');
  });
});
