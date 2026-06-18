import { getDefaultConfig, normalizeArtifacts } from '../mockData';
import { findWeaponById } from '../weapons';

/** Собирает конфиг персонажа из сохранённых данных или дефолта. */
export function resolveCharacterConfig(character, savedConfigs) {
  if (!character) {
    return getDefaultConfig({ id: 'unknown', name: '', nameRu: '' });
  }
  const saved = savedConfigs.find((c) => c.characterId === character.id);
  const base = saved || getDefaultConfig(character);
  return {
    ...base,
    artifacts: normalizeArtifacts(base.artifacts),
    equippedWeaponId: normalizeEquippedWeaponId(base.equippedWeaponId),
  };
}

function normalizeEquippedWeaponId(weaponId) {
  if (!weaponId) return null;
  if (weaponId === 'calamity-queller-claymore') return 'calamity-queller';
  if (weaponId === 'moonpiercer-catalyst') return 'moonpiercer';
  const weapon = findWeaponById(weaponId);
  return weapon?.id || weaponId;
}

/** Сравнение конфигов для пропуска лишних сохранений. */
export function characterConfigsEqual(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
