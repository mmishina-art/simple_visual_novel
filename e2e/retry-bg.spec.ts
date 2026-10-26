import { expect, test } from '@playwright/test';

// バッドエンドから最後の選択肢へ戻ったとき、背景がその場面のものに戻ること。
// （以前は開始時の決め打ち背景「教室」が残り、喫茶店の場面に教室の背景が出ていた）
test('バッドエンドから選択肢へ戻っても、背景はその場面のまま', async ({ page }) => {
  await page.goto('/');
  // デバッグパネルを開く（バージョン表示を5回タップ）
  for (let i = 0; i < 5; i++) await page.locator('#version-line').click();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card', { hasText: '喫茶つばめの災難' }).click();
  await expect(page.locator('#story-text')).toContainText('商店街の喫茶');
  // 冒頭の背景（喫茶店）が基準。背景はデータURLで埋め込まれるため src で比べる
  const bgAtStart = await page.locator('#scene-img').getAttribute('src');
  // 最後の選択肢（美食家の場面）へ飛ぶ
  await page.getByRole('button', { name: /最後の選択肢へ飛ぶ/ }).click();
  await expect(page.locator('#story-text')).toContainText('美食家が、静かに待っている');
  await page.locator('#message-window').click();
  await expect(page.locator('#choices')).toBeVisible();
  await expect(page.locator('#scene-img')).toHaveAttribute('src', bgAtStart!);
  // バッドエンドへ進む
  await page.locator('#choices button', { hasText: '無難に、日替わり定食を勧める' }).click();
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#ending-panel').isVisible()) break;
    await page.locator('#message-window').click();
    await page.waitForTimeout(120);
  }
  await expect(page.locator('#ending-title')).toContainText('バッドエンド');
  // 最後の選択からやり直す
  await page.getByRole('button', { name: '最後の選択からやり直す' }).click();
  await expect(page.locator('#story-text')).toContainText('美食家が、静かに待っている');
  await page.locator('#message-window').click();
  await expect(page.locator('#choices')).toBeVisible();
  // 背景が、冒頭（喫茶店）と変わっていないこと
  await expect(page.locator('#scene-img')).toHaveAttribute('src', bgAtStart!);
});
