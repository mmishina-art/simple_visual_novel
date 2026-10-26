import { expect, test } from '@playwright/test';

// バックグラウンドに移ったら音が止まり、戻ったら画面に応じた音が戻ること
const setHidden = async (page: import('@playwright/test').Page, hidden: boolean): Promise<void> => {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
};

test('バックグラウンドでBGMが止まり、復帰で戻る（タイトルと本編）', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'on');
  // バックグラウンドへ
  await setHidden(page, true);
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'off');
  // 復帰するとタイトルBGMが戻る
  await setHidden(page, false);
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'on');
  // 本編でも同じ
  await page.locator('.book-card').first().click();
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'on');
  await setHidden(page, true);
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'off');
  await setHidden(page, false);
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'on');
  await expect(page.locator('body')).toHaveAttribute('data-bgm-theme', 'horror');
});
