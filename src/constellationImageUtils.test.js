import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  prepareConstellationImageCandidates,
  prepareConstellationImageUrl,
} from './constellationImageUtils';

const WIKIA_URL = 'https://static.wikia.nocookie.net/gensin-impact/images/d/d1/Turris_Venefica_Shape.png/revision/latest?cb=1';
const JMP_URL = 'https://genshin.jmp.blue/characters/furina/constellation-shape';

describe('prepareConstellationImageUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns jmp URLs unchanged', () => {
    expect(prepareConstellationImageUrl(JMP_URL)).toBe(JMP_URL);
  });

  it('returns original URL when window is unavailable', () => {
    expect(prepareConstellationImageUrl(WIKIA_URL)).toBe(WIKIA_URL);
  });

  it('rewrites wikia URLs to dev proxy in browser', () => {
    vi.stubGlobal('window', {});

    const result = prepareConstellationImageUrl(WIKIA_URL);
    expect(result.startsWith('/constellation-img/gensin-impact/')).toBe(true);
    expect(result).toContain('Turris_Venefica_Shape');
  });

  it('deduplicates prepared candidates', () => {
    vi.stubGlobal('window', {});

    const result = prepareConstellationImageCandidates([WIKIA_URL, WIKIA_URL, JMP_URL]);
    expect(result).toHaveLength(2);
  });
});
