import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEST_EMAIL = 'mira.kondratovich.03@bk.ru';
export const SUPERUSER_EMAIL = 'kondratovic91@mail.ru';
export const TEST_PASSWORD = 'password123';
export const STORAGE_KEY = 'genshin-calc-v2';
export const TEST_CHARACTER_NAME = 'Беннет';

const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  for (const rel of ['.env', 'backend/.env']) {
    try {
      const content = fs.readFileSync(path.join(E2E_ROOT, rel), 'utf8');
      const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (match) return match[1].trim();
    } catch {
      // ignore missing env files
    }
  }
  return undefined;
}

/** Учётные данные superuser для e2e — только email/пароль, без Admin API. */
export function getSuperuserE2eCredentials() {
  const password = readEnvValue('E2E_SUPERUSER_PASSWORD');
  if (!password) return null;
  return {
    email: readEnvValue('E2E_SUPERUSER_EMAIL') || SUPERUSER_EMAIL,
    password,
  };
}

const EMPTY_STATE = {
  savedConfigs: [],
  team: [null, null, null, null],
};

export async function resetAppState(page) {
  await page.goto('/');
  await page.evaluate(({ key, emptyState }) => {
    localStorage.setItem(key, JSON.stringify(emptyState));
  }, { key: STORAGE_KEY, emptyState: EMPTY_STATE });
}

export async function waitForAppReady(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('link', { name: 'Команда' }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function logoutIfNeeded(page) {
  const logoutButton = page.getByRole('button', { name: 'Выйти' });
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    await expect(page.getByRole('button', { name: 'Вход' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Genshin Calculator' })).toBeVisible();
  }
}

export async function login(page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.getByRole('button', { name: 'Вход' }).click();
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  const authError = page.locator('.glass-modal').locator('p.text-red-200, p.text-red-300').first();
  const logoutButton = page.getByRole('button', { name: 'Выйти' });

  try {
    await expect(logoutButton).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    if (await authError.isVisible().catch(() => false)) {
      throw new Error(`Не удалось войти: ${await authError.textContent()}`);
    }
    throw error;
  }
}

export async function loginAsSuperuser(page) {
  const credentials = getSuperuserE2eCredentials();
  if (!credentials) {
    throw new Error(
      'E2E_SUPERUSER_PASSWORD не задан — тест superuser пропускается (обычный вход email/пароль)',
    );
  }
  await login(page, credentials.email, credentials.password);
}

export async function addCharacterToFirstSlot(page, searchName = TEST_CHARACTER_NAME) {
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Сборка команды' })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить персонажа' }).first().click();
  await expect(page.getByRole('heading', { name: 'Выберите персонажа' })).toBeVisible();
  await page.getByPlaceholder('Поиск...').fill(searchName);
  await page.getByRole('dialog').getByRole('button').filter({ hasText: searchName }).first().click();
  await expect(page.getByRole('heading', { name: 'Выберите персонажа' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Настроить' })).toBeVisible();
}

export async function openCharacterSettings(page, characterId = 'bennett') {
  await page.goto(`/character/${characterId}`);
  await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible();
}

export async function openCharacterTab(page, tabName, characterId = 'bennett') {
  await openCharacterSettings(page, characterId);
  await page.getByRole('button', { name: tabName }).click();
}

export async function pickArtifactByName(page, artifactNameRu) {
  await page.getByPlaceholder(/Поиск.*сета/i).fill(artifactNameRu);
  await page.locator('button').filter({ hasText: artifactNameRu }).first().click();
}

export async function waitForActionLoading(page) {
  const loader = page.getByText('Загрузка...');
  if (await loader.isVisible().catch(() => false)) {
    await loader.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  }
}

export async function cleanupTestState(page) {
  await logoutIfNeeded(page);
  await resetAppState(page);
  await page.reload();
}
