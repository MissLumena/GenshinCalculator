import { calculateMockDps, normalizeArtifacts } from '../mockData';

export function computeTeamDpsSummary(
  teamIds,
  getConfig,
  findCharacter,
  artifactSets,
) {
  const ids = (teamIds || []).filter(Boolean);
  const teamData = ids
    .map((characterId) => {
      const config = getConfig?.(characterId);
      const character = findCharacter?.(characterId);
      if (!config || !character) return null;
      return calculateMockDps(config, character, { artifactSets });
    })
    .filter(Boolean);

  const totalDps = teamData.reduce((sum, entry) => sum + entry.totalDps, 0);

  return {
    teamIds: ids,
    teamData,
    totalDps,
  };
}

export function buildGetConfigFromPayload(configs = []) {
  const byCharacterId = new Map(
    configs.map((config) => [config.characterId, {
      ...config,
      artifacts: normalizeArtifacts(config.artifacts),
    }]),
  );

  return (characterId) => byCharacterId.get(characterId) ?? null;
}
