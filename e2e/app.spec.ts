import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// アプリの ID（package.json の name）。保存データのキーの接頭辞になる
const APP_ID = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string }).name;

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

async function startAndAdvanceToFirstChoice(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめから' }).click();
  for (let i = 0; i < 12 && !(await page.locator('#choices').isVisible()); i++) {
    await page.locator('#message-window').click();
  }
}

test('タイトルから始めて、文章が進み、最初の選択肢が出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '午前0時の校舎' })).toBeVisible();
  await page.getByRole('button', { name: 'はじめから' }).click();
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
  await page.locator('#message-window').click();
  await expect(page.locator('#story-text')).toContainText('夕方から降り始めた雨');
  await startAndAdvanceToFirstChoice(page);
  await expect(page.locator('#choices')).toBeVisible();
  await expect(page.locator('#choices button', { hasText: '懐中電灯' })).toBeVisible();
});

test('選択を誤るとバッドエンドになり、最後の選択からやり直せる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめから' }).click();
  await playToEnding(page, ['そのまま出る', '急ぐ', '返事をする']);
  await expect(page.locator('#ending-title')).toContainText('バッドエンド');
  await page.getByRole('button', { name: '最後の選択からやり直す' }).click();
  // 声の選択肢まで戻っている
  await expect(page.locator('#choices')).toBeVisible();
  await expect(page.locator('#choices button', { hasText: '返事をせず' })).toBeVisible();
});

test('正しく選ぶとハッピーエンドになり、タイトルに結末の数が記録される', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめから' }).click();
  await playToEnding(page, ['懐中電灯', '音楽室', '返事をせず', '裏口へ走る']);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
  await page.locator('#ending-title-button').click();
  await expect(page.locator('#endings-progress')).toContainText('1 / 3');
  await expect(page.locator('#continue-button')).toBeHidden();
});

test('途中で閉じても、つづきから再開できる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.locator('#message-window').click();
  await page.locator('#message-window').click();
  const text = await page.locator('#story-text').textContent();
  await page.reload();
  await expect(page.locator('#continue-button')).toBeVisible();
  await page.locator('#continue-button').click();
  await expect(page.locator('#story-text')).toHaveText(text ?? '');
});

test('音のオン/オフを切り替えられる', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('#sound-button');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('manifest と Service Worker が使える', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(registered).toBe(true);
});

test('更新バナーは通常は隠れている', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#update-banner')).toBeHidden();
});

test('最初の画面からインストール方法を開ける（使っている端末の説明が開いている）', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /インストールする方法/ }).click();
  const dialog = page.locator('#install-dialog');
  await expect(dialog).toBeVisible();
  // Pixel 7 のプロファイルなので Android の説明が開いている
  await expect(dialog.locator('details[data-platform="android"]')).toHaveJSProperty('open', true);
  await expect(dialog.locator('details[data-platform="ios"]')).toHaveJSProperty('open', false);
  await expect(dialog.getByText('ホーム画面に追加', { exact: false }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'とじる' }).click();
  await expect(dialog).toBeHidden();
});

test('最初の画面にバージョンが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#version')).toHaveText(/^\d+\.\d+\.\d+$/);
});

test('記録をファイルに書き出し、消えたあとに読み込んで戻せる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.locator('#message-window').click();
  await page.getByText('記録のバックアップ').click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ファイルに書き出す' }).click()]);
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(path, 'utf8');
  const progress = JSON.parse(JSON.parse(text).data[`${APP_ID}-progress`] as string) as { nodeId: string };
  expect(progress.nodeId).toBe('start2');

  // 記録を消す → 読み込んで戻す
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#continue-button')).toBeHidden();
  await page.getByText('記録のバックアップ').click();
  await page.locator('#backup-import').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#continue-button')).toBeVisible();
  await expect(page.locator('#backup-message')).toContainText('読み込みました');
});

test('おかしいバックアップファイルは、理由を表示して読み込まない', async ({ page }) => {
  await page.goto('/');
  await page.getByText('記録のバックアップ').click();
  await page.locator('#backup-import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
  await expect(page.locator('#backup-message')).toContainText('このアプリのバックアップではありません');
});

test('起動できないときは「なおす」ボタンが出て、押すと起動できる（記録と、ほかのアプリのキャッシュは消えない）', async ({ page }) => {
  await page.addInitScript((id) => {
    (window as unknown as { __bootWaitMs: number }).__bootWaitMs = 500;
    // 1回目の自動修復は済んだことにして、ボタンが出る側の動きを確かめる
    sessionStorage.setItem(`${id}:repaired-at`, String(Date.now()));
    if (!localStorage.getItem(`${id}-endings`)) localStorage.setItem(`${id}-endings`, '["end_happy"]');
  }, APP_ID);
  // 同じサイトにある、ほかのアプリのキャッシュ（なおすときに消えてはいけない）を用意する
  await page.goto('/');
  await page.evaluate(async () => { await caches.open('other-app-v1'); });
  // メインのスクリプトが読み込めない状況を作る
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#boot-error')).toBeVisible();

  await page.unroute('**/assets/*.js');
  await page.getByRole('button', { name: 'なおす' }).click();
  await expect(page.locator('#endings-progress')).toContainText('1 / 3');
  await expect(page.locator('#boot-error')).toBeHidden();
  // このアプリのキャッシュだけが作り直され、ほかのアプリのキャッシュは残っている
  expect(await page.evaluate(() => caches.has('other-app-v1'))).toBe(true);
});

test('デバッグモード: バージョンを 5 回タップで操作パネルが出て、使った回は結末を記録しない', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('#debug-panel');
  await expect(panel).toBeHidden();
  for (let i = 0; i < 5; i++) await page.locator('#version-line').click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: /最後の選択肢へ飛ぶ/ }).click();
  await expect(page.locator('#choices')).toBeVisible();
  await page.locator('#choices button', { hasText: '裏口へ走る' }).click();
  await playToEnding(page, []);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
  await page.locator('#ending-title-button').click();
  await expect(page.locator('#endings-progress')).toContainText('0 / 3'); // デバッグを使った回は記録しない
  await expect(panel).toBeVisible(); // オン/オフは保存される
  await page.getByRole('button', { name: 'デバッグモードを終える' }).click();
  await expect(panel).toBeHidden();
});
