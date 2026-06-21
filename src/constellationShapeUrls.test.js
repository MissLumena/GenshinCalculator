import { describe, expect, it } from 'vitest';
import { getStaticConstellationShapeUrl } from './constellationShapeUrls';

describe('constellationShapeUrls', () => {
  it('provides direct shape URLs for new Mondstadt and Nod-Krai characters', () => {
    expect(getStaticConstellationShapeUrl('pulonia', 'Turris Venefica')).toContain('Turris_Venefica_Shape');
    expect(getStaticConstellationShapeUrl('yagoda', 'Fragum')).toContain('Fragum_Shape');
    expect(getStaticConstellationShapeUrl('aino', 'Cistellula Mira')).toContain('Cistellula_Mira_Shape');
    expect(getStaticConstellationShapeUrl('columbina', 'Columbina Hyposelenia')).toContain('Columbina_Hyposelenia_Shape');
    expect(getStaticConstellationShapeUrl('traveler-geo', 'Viator Geo')).toContain('Viator_Geo_Shape');
    expect(getStaticConstellationShapeUrl('traveler-pyro', 'Viator Pyro')).toContain('Viator_Pyro_Shape');
  });
});
