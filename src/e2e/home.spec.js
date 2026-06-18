import { test, expect } from '@playwright/test';

test('главная страница загружается', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Genshin Calculator/i);
  await expect(page.getByRole('heading', { name: 'Genshin Calculator', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Начать расчёт' })).toBeVisible();
});
