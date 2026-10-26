import { expect, test } from '@playwright/test';

// ハッピーエンドを見た本には、表紙の右上から小さなしおり紐が出る。
// 記録を localStorage に仕込んで、本棚での表示だけを確認する。
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('simple-visual-novel-story:midnight-school:endings', JSON.stringify(['end_happy']));
  });
});

test('ハッピーエンドを見た本にだけ、しおり紐が付く', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  const cards = page.locator('.book-card');
  await expect(cards.nth(0).locator('.happy-bookmark')).toBeVisible();
  await expect(cards.nth(1).locator('.happy-bookmark')).toHaveCount(0);
});
