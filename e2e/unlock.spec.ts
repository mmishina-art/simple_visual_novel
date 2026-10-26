import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// アプリの ID（package.json の name）。保存データのキーの接頭辞になる
const APP_ID = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string }).name;

// 公開7冊のハッピーエンドのノード ID
const HAPPY_ENDINGS: Record<string, string> = {
  'midnight-school': 'end_happy',
  'moon-library': 'end_happy',
  'missing-trophy': 'end_truth',
  'stardust-station': 'end_happy',
  'cafe-tsubame': 'end_happy',
  'sunday-well': 'end_happy',
  'maou-diner': 'end_happy',
};

test('全冊ハッピーエンド前は、隠し本は予告だけが出る', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.book-card')).toHaveCount(7);
  await expect(page.locator('.locked-card')).toContainText('？？？');
  await expect(page.locator('.locked-card')).toContainText('ハッピーエンド達成: 0 / 7');
});

test('全冊ハッピーエンドを見ると、隠し本が現れて読める', async ({ page }) => {
  await page.addInitScript(
    (seed) => {
      for (const [storyId, endingId] of Object.entries(seed.endings)) {
        localStorage.setItem(`${seed.appId}-story:${storyId}:endings`, JSON.stringify([endingId]));
      }
    },
    { appId: APP_ID, endings: HAPPY_ENDINGS },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.locked-card')).toHaveCount(0);
  await expect(page.locator('.book-card')).toHaveCount(8);
  await page.locator('.book-card').nth(7).click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm-theme', 'sensual');
  await expect(page.locator('#story-text')).toContainText('雨の夜だった');
  await playToEnding(page, ['話していきなさい', 'もっと聞く', '上がって', '聞いて']);
  await expect(page.locator('#ending-panel')).toContainText('朝の温度');
});

/** 選択肢が出たら labels の順に選び、それ以外は本文をタップして、結末まで進める */
async function playToEnding(page: Page, labels: string[]): Promise<void> {
  const queue = [...labels];
  for (let i = 0; i < 140; i++) {
    if (await page.locator('#ending-panel').isVisible()) return;
    if (await page.locator('#choices').isVisible()) {
      const label = queue.shift();
      if (label === undefined) throw new Error('選択肢の指定が足りません');
      await page.locator('#choices button', { hasText: label }).first().click();
    } else {
      await page.locator('#message-window').click();
    }
  }
  throw new Error('結末に着きませんでした');
}
