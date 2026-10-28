import { expect, test } from '@playwright/test';

// 本編・読み返しの画面では Wake Lock を取り、読み上げ中に画面が暗くならないようにする。
// 実機の Wake Lock はヘッドレスでは再現できないので、navigator.wakeLock を差し替えて
// 要求と解放の呼び出しを記録し、画面遷移に連動しているかを見る。
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const log = { requests: 0, releases: 0 };
    (window as unknown as { __wakeLockLog: typeof log }).__wakeLockLog = log;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          log.requests += 1;
          return {
            release: async () => {
              log.releases += 1;
            },
            addEventListener: () => {},
          };
        },
      },
    });
  });
});

test('本編に入ると Wake Lock を取り、本棚に戻ると手放す', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
  await page.waitForTimeout(300);
  const inGame = await page.evaluate(
    () => (window as unknown as { __wakeLockLog: { requests: number; releases: number } }).__wakeLockLog,
  );
  expect(inGame.requests).toBeGreaterThanOrEqual(1);
  expect(inGame.releases).toBe(0);
  await page.getByRole('button', { name: '本棚に戻る' }).click();
  await page.waitForTimeout(300);
  const inShelf = await page.evaluate(
    () => (window as unknown as { __wakeLockLog: { requests: number; releases: number } }).__wakeLockLog,
  );
  expect(inShelf.releases).toBeGreaterThanOrEqual(1);
});
