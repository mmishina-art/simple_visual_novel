import { expect, test, type Page } from '@playwright/test';

/** 選択肢の文字と帯（枠）が、ステージと帯の中に収まっているか、矩形で機械的に確認する */
async function expectChoicesFullyVisible(page: Page) {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const stage = document.querySelector('.stage')?.getBoundingClientRect();
    for (const b of document.querySelectorAll<HTMLElement>('.choices button')) {
      const br = b.getBoundingClientRect();
      if (stage && (br.top < stage.top - 1 || br.bottom > stage.bottom + 1 || br.left < stage.left - 1 || br.right > stage.right + 1)) {
        out.push(`「${b.textContent}」の帯がステージの外に出ています`);
      }
      const range = document.createRange();
      range.selectNodeContents(b);
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue;
        if (r.top < br.top - 1 || r.bottom > br.bottom + 1 || r.left < br.left - 1 || r.right > br.right + 1) {
          out.push(`「${b.textContent}」の文字が帯の外に出ています`);
        }
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
}

for (const vp of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 375, height: 667 },
]) {
  test(`選択肢が全画面サイズで見切れない（${vp.width}x${vp.height}）`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/');
    await page.getByRole('button', { name: 'はじめから' }).click();
    const labels = [
      '教室の後ろの棚から、懐中電灯を持っていく',
      '足跡をたどって、音楽室をのぞく',
      '返事をせず、昇降口へ急ぐ',
      '振り返らず、裏口へ走る',
    ];
    for (let i = 0; i < 60 && !(await page.locator('#ending-panel').isVisible()); i++) {
      if (await page.locator('#choices').isVisible()) {
        await expectChoicesFullyVisible(page);
        const label = labels.shift();
        if (label === undefined) throw new Error('選択肢の指定が足りません');
        await page.locator('#choices button', { hasText: label }).first().click();
      } else {
        await page.locator('#message-window').click();
      }
    }
    await expect(page.getByText('夜明けの雨')).toBeVisible();
  });
}

