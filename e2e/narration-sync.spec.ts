import { expect, test } from '@playwright/test';

// 音声の読み込みが遅い状況で素早くタップしても、画面と読み上げがずれないこと。
// （前の場面の再生リクエストが「中断」で失敗したのを拾って勝手に進むと、
//  音声が1場面遅れて、表示と違う文章を読み続けてしまう）
test('素早くタップしても、読み上げは表示中の場面とずれない', async ({ page }) => {
  // 音声の取得をわざと遅らせて、再生リクエストが重なる状況を作る
  await page.route('**/audio/*.mp3', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
  // 読み上げの操作は設定画面に集約されているので、本編から設定を開いてオンにする
  await page.locator('#settings-button-game').click();
  await page.locator('#narration-button').click();
  await page.locator('#settings-back').click();
  await expect(page.locator('#game-screen')).toBeVisible();
  // 素早く3回タップして start4 まで進める
  for (let i = 0; i < 3; i++) {
    await page.locator('#message-window').click();
    await page.waitForTimeout(120);
  }
  await expect(page.locator('#story-text')).toContainText('目が覚めたとき');
  // フォールバックの待ち時間（2.5秒）を超えて待っても、それ以上は進まない
  await page.waitForTimeout(3400);
  await expect(page.locator('#story-text')).toContainText('目が覚めたとき');
  await expect(page.locator('#story-text')).not.toContainText('スマホの電池は残り1%');
  await expect(page.locator('#narration-audio')).toHaveAttribute('src', /midnight-school\/start4\.mp3$/);
});
