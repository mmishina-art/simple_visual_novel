import { expect, test, type Page } from '@playwright/test';

/** トップで「はじめる」を押し、本棚で『午前0時の校舎』を選んで本編に入る */
async function beginStory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#resume-dialog').isVisible()) {
      await page.getByRole('button', { name: 'つづきから読む' }).click();
      break;
    }
    if (await page.locator('#story-text').isVisible()) break;
    await page.waitForTimeout(100);
  }
}

/** 設定画面でフリガナのボタンを押して、タイトルに戻る */
async function toggleFuriganaFromSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '設定' }).click();
  await page.locator('#furigana-button').click();
  await page.getByRole('button', { name: 'タイトルに戻る' }).click();
}

test.describe('フリガナ表示', () => {
  test('初期状態（オフ）ではルビが出ず、記法も本文に残らない', async ({ page }) => {
    await page.goto('/');
    await beginStory(page);
    const storyText = page.locator('#story-text');
    await expect(storyText).toContainText('久瀬遥');
    await expect(storyText.locator('ruby')).toHaveCount(0);
    await expect(storyText).not.toContainText('《');
    await expect(storyText).not.toContainText('くぜはるか');
  });

  test('オンにすると <ruby> で読みが付き、本文の表示は変わらない', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await beginStory(page);
    const storyText = page.locator('#story-text');
    const ruby = storyText.locator('ruby', { hasText: '久瀬遥' });
    await expect(ruby).toHaveCount(1);
    await expect(ruby.locator('rt')).toHaveText('くぜはるか');
    // 明日《あした》のルビも付く。本文そのものは記法のない元本文どおり
    await expect(storyText.locator('ruby', { hasText: '明日' }).locator('rt')).toHaveText('あした');
    await expect(storyText).toContainText('文化祭を明日');
    await expect(storyText).toContainText('に控えた金曜日');
    await expect(storyText).not.toContainText('《');
  });

  test('オンは保存され、再読み込み後も効く。オフに戻すと消える', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await page.reload();
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page.locator('#furigana-button')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'タイトルに戻る' }).click();
    await beginStory(page);
    await expect(page.locator('#story-text ruby')).not.toHaveCount(0);

    // 本棚・タイトルへ戻り、設定でオフに戻すと aria-pressed が false になる
    await page.locator('#to-title-button').click();
    await page.locator('#shelf-back').click();
    await page.getByRole('button', { name: '設定' }).click();
    await page.locator('#furigana-button').click();
    await expect(page.locator('#furigana-button')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'タイトルに戻る' }).click();
    await beginStory(page);
    await expect(page.locator('#story-text ruby')).toHaveCount(0);
    await expect(page.locator('#story-text')).toContainText('久瀬遥');
  });

  test('ルビ記法の無い他の作品は、オンでも従来通り表示される', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await page.getByRole('button', { name: 'はじめる' }).click();
    // 2冊目（『月夜の図書室』）を開く
    await page.locator('.book-card').nth(1).click();
    for (let i = 0; i < 10; i++) {
      if (await page.locator('#story-text').isVisible()) break;
      await page.waitForTimeout(100);
    }
    const storyText = page.locator('#story-text');
    await expect(storyText.locator('ruby')).toHaveCount(0);
    await expect(storyText).not.toContainText('《');
  });
});
