import { test, expect } from '@playwright/test';
import {
  addCharacterToFirstSlot,
  cleanupTestState,
  login,
  openCharacterTab,
  pickArtifactByName,
  resetAppState,
  TEST_CHARACTER_NAME,
  TEST_EMAIL,
  waitForActionLoading,
  waitForAppReady,
} from './helpers.js';

test.describe('Пользовательские сценарии', () => {
  test('Пользователь регистрируется или входит в приложение', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);

      await page.getByRole('button', { name: 'Регистрация' }).click();
      await expect(page.getByRole('heading', { name: 'Регистрация' })).toBeVisible();
      await expect(page.getByPlaceholder('Имя (отображается в результатах)')).toBeVisible();
      await expect(page.getByPlaceholder('Email')).toBeVisible();
      await page.getByRole('button', { name: 'Отмена' }).click();

      try {
        await login(page);
      } catch (error) {
        test.skip(true, `${error.message}. Проверьте пользователя ${TEST_EMAIL} в Supabase.`);
      }
      await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Пользователь выбирает персонажей для команды', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);

      await addCharacterToFirstSlot(page, TEST_CHARACTER_NAME);
      await expect(page.getByRole('button', { name: 'Рассчитать DPS команды' })).toBeEnabled();
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Пользователь настраивает характеристики персонажа', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);
      await addCharacterToFirstSlot(page);

      await openCharacterTab(page, 'Базовые статы');
      const levelInput = page.getByLabel('Уровень');
      await levelInput.fill('80');
      await levelInput.blur();
      await expect(levelInput).toHaveValue('80');
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Пользователь выбирает артефакты персонажу', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);
      await addCharacterToFirstSlot(page);

      await openCharacterTab(page, 'Артефакты');
      await page.getByRole('button', { name: 'Два сета · 4 + 2' }).click();
      await page.getByRole('button', { name: 'Редактировать сет 2 (2pc)' }).click();
      await pickArtifactByName(page, 'Церемония древней знати');
      await expect(page.getByText('×2')).toBeVisible();

      await page.getByRole('button', { name: 'Редактировать сет 1 (4pc)' }).click();
      await pickArtifactByName(page, 'Эмблема рассечённой судьбы');
      await expect(page.getByText('×4')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Бонусы сетов/ })).toBeVisible();
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Пользователь выбирает оружие персонажу', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);
      await addCharacterToFirstSlot(page);

      await openCharacterTab(page, 'Оружие');
      await page.getByPlaceholder('Поиск оружия...').fill('Осквернённое');
      await page.locator('button').filter({ hasText: 'Осквернённое желание' }).first().click();
      await expect(page.getByText('Осквернённое желание').first()).toBeVisible();
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Пользователь выбирает созвездия персонажу', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);
      await addCharacterToFirstSlot(page);

      await openCharacterTab(page, 'Созвездия');
      const constellationTab = page.getByRole('tab', { name: 'Созвездие 3' });
      await expect(constellationTab).toBeVisible({ timeout: 20_000 });
      await constellationTab.click();
      await expect(constellationTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Пользователь рассчитывает DPS команды', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);
      await addCharacterToFirstSlot(page);

      await page.getByRole('button', { name: 'Рассчитать DPS команды' }).click();
      await expect(page).toHaveURL(/\/results\/(local|[0-9a-f-]{36})$/);
      await expect(page.getByRole('heading', { name: 'Урон персонажей' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Итого команды' })).toBeVisible();
      await expect(page.getByText(TEST_CHARACTER_NAME).first()).toBeVisible();
    } finally {
      await cleanupTestState(page);
    }
  });

  test('Зарегистрированный пользователь видит список расчётов DPS других игроков', async ({ page }) => {
    try {
      await resetAppState(page);
      await waitForAppReady(page);
      try {
        await login(page);
      } catch (error) {
        test.skip(true, `${error.message}. Проверьте пользователя ${TEST_EMAIL} в Supabase.`);
      }

      await addCharacterToFirstSlot(page);
      await waitForActionLoading(page);

      await page.goto('/results');
      await expect(page.getByRole('heading', { name: 'Результаты', level: 1 })).toBeVisible();

      await page.getByRole('tab', { name: 'Расчёт игроков' }).click();
      await expect(page.getByRole('tab', { name: 'Расчёт игроков', selected: true })).toBeVisible();

      const playerLinks = page.locator('#notion-results ul.glass-panel a[href^="/results/"]');
      await expect(playerLinks.first()).toBeVisible({ timeout: 20_000 });

      const otherPlayerLink = playerLinks.filter({ hasNotText: '(вы)' }).first();
      if (await otherPlayerLink.count() === 0) {
        test.skip(true, 'В Supabase нет других игроков с сохранёнными командами');
      }

      await otherPlayerLink.click();
      await expect(page.getByRole('heading', { name: 'Урон персонажей' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'К списку результатов' })).toBeVisible();
    } finally {
      await cleanupTestState(page);
    }
  });
});
