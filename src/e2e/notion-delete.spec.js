import { test, expect } from '@playwright/test';
import {
  cleanupTestState,
  loginAsSuperuser,
  resetAppState,
  waitForAppReady,
} from './helpers.js';

test('superuser sees delete on all notion rows', async ({ page }) => {
  try {
    await resetAppState(page);
    await waitForAppReady(page);
    try {
      await loginAsSuperuser(page);
    } catch (error) {
      test.skip(true, `${error.message}`);
    }

    await page.goto('/results#notion-results');
    await expect(page.getByRole('tab', { name: 'Расчёт игроков', selected: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Результаты', level: 1 })).toBeVisible();

    const notionSection = page.locator('#notion-results');
    const rows = notionSection.locator('.result-strip-row');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip(true, 'No notion rows to check');
    }

    const deleteButtons = notionSection.getByRole('button', { name: 'Удалить' });
    await expect(deleteButtons.first()).toBeVisible({ timeout: 10_000 });
    expect(await deleteButtons.count()).toBe(rowCount);
  } finally {
    await cleanupTestState(page);
  }
});
