import { expect, test } from '@playwright/test';

const bgmTheme = async (page: import('@playwright/test').Page): Promise<string | undefined> =>
  page.evaluate(() => document.body.dataset.bgmTheme);
const bgm = async (page: import('@playwright/test').Page): Promise<string | undefined> =>
  page.evaluate(() => document.body.dataset.bgm);

test('タイトルBGMが画面に合わせて切り替わる', async ({ page }) => {
  await page.goto('/');
  // 最初のタップでタイトルBGMが始まる
  await page.mouse.click(30, 200);
  await expect.poll(() => bgmTheme(page)).toBe('title');
  // 本棚でも続く
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('#shelf-list')).toBeVisible();
  expect(await bgmTheme(page)).toBe('title');
  // 本を開くと物語のBGMに切り替わる
  await page.locator('.book-card').first().click();
  await expect(page.locator('#story-text')).toBeVisible();
  await expect.poll(() => bgmTheme(page)).toBe('horror');
  // 本棚に戻るとタイトルBGMに戻る
  await page.locator('#to-title-button').click();
  await expect(page.locator('#shelf-list')).toBeVisible();
  await expect.poll(() => bgmTheme(page)).toBe('title');
});

test('音を切るとタイトルBGMも止まり、入れ直すと戻る', async ({ page }) => {
  await page.goto('/');
  await page.mouse.click(30, 200);
  await expect.poll(() => bgmTheme(page)).toBe('title');
  await page.getByRole('button', { name: '設定' }).click();
  await page.locator('#sound-button').click();
  await expect.poll(() => bgm(page)).toBe('off');
  await page.locator('#sound-button').click();
  await expect.poll(() => bgmTheme(page)).toBe('title');
});
