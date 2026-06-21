import { CHARACTERS, findCharacterById } from '../characters';

function normalizeName(value) {
  return (value || '').trim().toLowerCase();
}

export function parseNotionMemberId(memberLine) {
  if (memberLine == null) return null;
  const trimmed = String(memberLine).trim();
  const idMatch = trimmed.match(/^([a-z0-9-]+)\|(.+)$/i);
  return idMatch ? idMatch[1] : null;
}

export function parseNotionMemberName(memberLine) {
  if (memberLine == null) return null;
  const trimmed = String(memberLine).trim();
  const idMatch = trimmed.match(/^([a-z0-9-]+)\|(.+)$/i);
  const body = idMatch ? idMatch[2].trim() : trimmed;
  if (!body) return null;
  const constellationMatch = body.match(/^(.+?)\s+C\d+/i);
  if (constellationMatch) return constellationMatch[1].trim();
  return body.split('|')[0]?.trim() || body;
}

export function parseNotionTeamNames(teamLabel) {
  return String(teamLabel ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function findCharacterByDisplayName(name, characters = CHARACTERS) {
  const norm = normalizeName(name);
  if (!norm) return null;
  return (
    characters.find(
      (character) =>
        normalizeName(character.nameRu) === norm
        || normalizeName(character.nameEn) === norm
        || normalizeName(character.name) === norm,
    ) || null
  );
}

function resolveCharacterIds(item) {
  const fromApi = Array.isArray(item.character_ids) ? item.character_ids.filter(Boolean) : [];
  if (fromApi.length > 0) return fromApi;

  const members = Array.isArray(item.members) ? item.members : [];
  const fromMembers = members.map(parseNotionMemberId).filter(Boolean);
  if (fromMembers.length > 0) return fromMembers;

  return [];
}

export function resolveNotionTeamCharacters(
  item = {},
  characters = CHARACTERS,
) {
  const characterIds = resolveCharacterIds(item);
  if (characterIds.length > 0) {
    return characterIds.map((characterId) => {
      const character = findCharacterById(characterId);
      return {
        name: character?.nameRu || characterId,
        character,
      };
    });
  }

  const teamLabel = item.team_label ?? item.teamLabel ?? '';
  const members = Array.isArray(item.members) ? item.members : [];
  const namesFromMembers = members
    .map(parseNotionMemberName)
    .filter(Boolean);
  const names = namesFromMembers.length > 0
    ? namesFromMembers
    : parseNotionTeamNames(teamLabel);

  return names.map((name) => ({
    name,
    character: findCharacterByDisplayName(name, characters),
  }));
}
