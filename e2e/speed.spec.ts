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

/** 再生中の読み上げ音声の playbackRate を読む */
async function narrationRate(page: Page): Promise<number> {
  return page.locator('#narration-audio').evaluate((el) => (el as HTMLAudioElement).playbackRate);
}

test.describe('朗読の速度変更', () => {
  test('設定画面で切り替えると保存され、再読み込み後も復元される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '設定' }).click();
    const button = page.locator('#speed-button');
    await expect(button).toHaveText('1.0x');
    await button.click();
    await expect(button).toHaveText('1.25x');
    await button.click();
    await expect(button).toHaveText('1.5x');

    await page.reload();
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page.locator('#speed-button')).toHaveText('1.5x');
  });

  test('本編のボタンで速度が音声に反映され、場面が替わっても維持される。設定画面とも連動する', async ({ page }) => {
    await page.goto('/');
    await beginStory(page);
    const gameButton = page.locator('#speed-button-game');
    await expect(gameButton).toHaveText('1.0x');

    // 読み上げをオンにすると、音声要素ができて速度 1.0 で再生される
    await page.locator('#narration-button-game').click();
    await expect(page.locator('#narration-audio')).toBeAttached();
    await expect.poll(() => narrationRate(page)).toBe(1);

    // 本編のボタンで 1.25x にすると、再生中の音声へすぐ反映される
    await gameButton.click();
    await expect(gameButton).toHaveText('1.25x');
    await expect.poll(() => narrationRate(page)).toBe(1.25);

    // タップで次の場面へ進んでも、速度は維持される
    await page.locator('#message-window').click();
    await expect(page.locator('#narration-audio')).toHaveAttribute('src', /midnight-school\/start2\.mp3$/);
    await expect.poll(() => narrationRate(page)).toBe(1.25);

    // 設定画面のボタンとも連動している
    await page.locator('#to-title-button').click();
    await page.locator('#shelf-back').click();
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page.locator('#speed-button')).toHaveText('1.25x');
  });
});
