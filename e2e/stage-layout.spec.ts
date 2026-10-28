import { expect, test } from '@playwright/test';

// 本編ステージと読み返しの枠サイズを、端末サイズごとに固定する。
// 仕様: 高さ = min(680px, 画面高 - 168px)、最小 420px。読み返しも同じ高さ。
// 横向き（画面高が小さい）では最小 420px が効き、枠は画面より少し大きくなる（縦読み前提の割り切り）。
const SIZES = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: '標準 (390x844)', width: 390, height: 844 },
  { name: '大型 (430x932)', width: 430, height: 932 },
  { name: 'タブレット (768x1024)', width: 768, height: 1024 },
  { name: '横向き (844x390)', width: 844, height: 390 },
] as const;

for (const size of SIZES) {
  test(`ステージと読み返しの枠サイズ（${size.name}）`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/');
    await page.getByRole('button', { name: 'はじめる' }).click();
    await page.locator('.book-card').first().click();
    await expect(page.locator('#story-text')).toBeVisible();

    const expected = Math.max(420, Math.min(680, size.height - 168));
    const stage = await page.locator('.stage').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    });
    expect(Math.abs(stage.height - expected)).toBeLessThanOrEqual(2);

    // 三角（進む合図・読み返し入口）は枠の中に収まる
    for (const sel of ['.next-hint', '#backlog-button']) {
      const box = await page.locator(sel).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      const stageBox = await page.locator('.stage').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      expect(box.bottom).toBeLessThanOrEqual(stageBox.bottom + 1);
      expect(box.top).toBeGreaterThanOrEqual(stageBox.top - 1);
      expect(box.left).toBeGreaterThanOrEqual(stageBox.left - 1);
      expect(box.right).toBeLessThanOrEqual(stageBox.right + 1);
    }

    // 読み返しの枠も同じ高さ
    await page.locator('#backlog-button').click();
    const backlogHeight = await page.locator('.backlog-text').evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(backlogHeight - stage.height)).toBeLessThanOrEqual(2);
  });
}
