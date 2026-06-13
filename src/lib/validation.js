/** Валидация полей авторизации и статов персонажа. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(value, fieldName = 'id') {
  if (value == null || value === '') return null;
  if (!UUID_RE.test(String(value))) {
    return `${fieldName}: некорректный UUID`;
  }
  return null;
}

export function validateEmail(email) {
  const value = String(email ?? '').trim();
  if (!value) {
    return 'Введите email';
  }
  if (value.length > 255) {
    return 'Email слишком длинный';
  }
  if (!EMAIL_RE.test(value)) {
    return 'Некорректный формат email';
  }
  return null;
}

export function validatePassword(password) {
  const value = String(password ?? '');
  if (!value) {
    return 'Введите пароль';
  }
  if (value.length < 8) {
    return 'Пароль должен быть не короче 8 символов';
  }
  if (value.length > 128) {
    return 'Пароль слишком длинный';
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Пароль должен содержать букву и цифру';
  }
  return null;
}

/** @returns {{ email: string, password: string } | { error: string }} */
export function validateAuthCredentials(email, password) {
  const emailError = validateEmail(email);
  if (emailError) {
    return { error: emailError };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }
  return {
    email: String(email).trim().toLowerCase(),
    password: String(password),
  };
}

export function validateCharacterStats(stats) {
  const errors = [];

  if (stats.critRate != null && (stats.critRate < 0 || stats.critRate > 100)) {
    errors.push('CRIT Rate должен быть от 0 до 100');
  }
  if (stats.critDmg != null && (stats.critDmg < 0 || stats.critDmg > 500)) {
    errors.push('CRIT DMG должен быть от 0 до 500');
  }
  if (stats.constellation != null && (!Number.isInteger(stats.constellation)
    || stats.constellation < 0 || stats.constellation > 6)) {
    errors.push('Созвездие должно быть от 0 до 6');
  }
  ['atkBase', 'atkBonus', 'hp', 'em'].forEach((key) => {
    const val = stats[key];
    if (val != null && (val < 0 || val > 50000)) {
      errors.push(`${key}: значение должно быть от 0 до 50000`);
    }
  });

  return errors.length ? errors.join('. ') : null;
}

/** Полная валидация конфига персонажа перед сохранением. */
export function validateCharacterConfig(config) {
  if (!config?.characterId || typeof config.characterId !== 'string') {
    return 'Не указан персонаж';
  }

  const statsError = validateCharacterStats({
    atkBase: config.atk?.base,
    atkBonus: config.atk?.bonus,
    hp: config.hp,
    em: config.em,
    critRate: config.critRate,
    critDmg: config.critDmg,
    constellation: config.constellation,
  });
  if (statsError) return statsError;

  if (config.id) {
    const uuidError = validateUuid(config.id, 'id персонажа');
    if (uuidError) return uuidError;
  }

  if (config.level != null && (config.level < 1 || config.level > 90)) {
    return 'Уровень должен быть от 1 до 90';
  }

  return null;
}

/** Валидация состава команды (4 слота). */
export function validateTeamComposition(team, savedConfigs) {
  if (!Array.isArray(team) || team.length !== 4) {
    return 'Команда должна содержать 4 слота';
  }

  const used = new Set();
  for (const characterId of team) {
    if (!characterId) continue;
    if (used.has(characterId)) {
      return 'Один персонаж не может быть в команде дважды';
    }
    used.add(characterId);
    const config = savedConfigs.find((c) => c.characterId === characterId);
    if (!config) {
      return 'Персонаж не найден в сохранённых конфигах';
    }
  }

  return null;
}

/** @param {string} role */
export function validateAssignableRole(role) {
  if (!['owner', 'admin', 'user'].includes(role)) {
    return 'Некорректная роль';
  }
  return null;
}
