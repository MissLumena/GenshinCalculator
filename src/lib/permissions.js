/** Роли и права доступа (вариант A — каждый user редактирует только свои данные). */

import { forbidden, badRequest } from './apiErrors';

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  USER: 'user',
};

/** Поля user_characters, которые role=user может менять при расчёте команды. */
export const USER_EDITABLE_CHARACTER_FIELDS = new Set([
  'atk_base',
  'atk_bonus',
  'hp',
  'crit_rate',
  'crit_dmg',
  'em',
  'constellation',
  'artifacts_summary',
]);

export function normalizeRole(role) {
  if (role === ROLES.OWNER || role === ROLES.ADMIN) {
    return role;
  }
  return ROLES.USER;
}

export function isOwner(role) {
  return role === ROLES.OWNER;
}

export function isAdminOrOwner(role) {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

export function canEditCatalog(role) {
  return isAdminOrOwner(role);
}

export function canManageUsers(role) {
  return isOwner(role);
}

export function canDeleteUserAccounts(role) {
  return isOwner(role);
}

export function canAssignRole(actorRole, targetRole) {
  if (isOwner(actorRole)) {
    return true;
  }
  if (actorRole === ROLES.ADMIN) {
    return targetRole === ROLES.ADMIN || targetRole === ROLES.USER;
  }
  return false;
}

export function canViewOtherUsersData(role) {
  return isAdminOrOwner(role);
}

export function canDeleteTeam(role) {
  return isAdminOrOwner(role);
}

export function canEditTeamComposition(_role) {
  return true;
}

/**
 * Проверка доступа к данным пользователя.
 * @throws {import('./apiErrors').ApiError}
 */
export function assertSameUser(sessionUserId, targetUserId, actorRole) {
  if (!sessionUserId || !targetUserId) {
    throw badRequest('Не указан пользователь');
  }
  if (sessionUserId === targetUserId) {
    return;
  }
  if (canViewOtherUsersData(actorRole)) {
    return;
  }
  throw forbidden('Нет доступа к чужим данным');
}

/** Оставляет в payload только разрешённые поля для role=user. */
export function filterCharacterRowForRole(row, role) {
  if (isAdminOrOwner(role)) {
    return { ...row };
  }

  const filtered = {
    user_id: row.user_id,
    game_character_id: row.game_character_id,
  };

  for (const key of USER_EDITABLE_CHARACTER_FIELDS) {
    if (row[key] !== undefined) {
      filtered[key] = row[key];
    }
  }

  if (row.level !== undefined) filtered.level = row.level;
  if (row.defense !== undefined) filtered.defense = row.defense;
  if (row.energy_recharge !== undefined) filtered.energy_recharge = row.energy_recharge;

  return filtered;
}

export function getRoleLabel(role) {
  switch (role) {
    case ROLES.OWNER:
      return 'Владелец';
    case ROLES.ADMIN:
      return 'Админ';
    default:
      return 'Пользователь';
  }
}
