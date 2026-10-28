import { expect, test, type Page } from '@playwright/test';

/**
 * 読書画面のヘッダーの構成を、矩形で機械的に確認する。
 * ヘッダーは1段だけ: タイトル＋「本棚に戻る」「設定」のピル2つ（右側）。
 * 音・読み上げ・速度の操作は設定画面に集約し、読書画面には置かない。
 * 長いタイトルではタイトル側が省略されてもよいが、ピル2つは常に見切れないこと。
 */

// 一番長いタイトルの作品を開く（タイトルが見切れる条件が一番厳しい）
async function openLongestTitleStory(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card', { hasText: '日曜日、井戸の底で' }).click();
  await expect(page.locator('#game-screen')).toBeVisible();
  await expect(page.locator('.game-title')).toHaveText('日曜日、井戸の底で');
}

async function expectHeaderFits(page: Page) {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    const title = document.querySelector('.game-title')?.getBoundingClientRect();
    const shelf = document.querySelector('#to-title-button')?.getBoundingClientRect();
    const settings = document.querySelector('#settings-button-game')?.getBoundingClientRect();
    if (!title || !shelf || !settings) {
      return ['ヘッダーの要素が見つかりません'];
    }
    // ピル2つはタイトルと同じ段（1段目）にあり、タイトルの右に「本棚に戻る」→「設定」の順で並ぶ
    for (const [name, r] of [['本棚に戻る', shelf], ['設定', settings]] as const) {
      if (r.top >= title.bottom || r.bottom <= title.top) out.push(`「${name}」がタイトルと同じ段にありません`);
      if (r.left < -1 || r.right > vw + 1) out.push(`「${name}」が画面の横幅からはみ出しています`);
    }
    if (shelf.left < title.right - 1) out.push('「本棚に戻る」がタイトルと重なっています');
    if (settings.left < shelf.right - 1) out.push('「設定」が「本棚に戻る」と重なっています');
    // 再生系の操作は読書画面に置かない（設定画面に集約）
    for (const id of ['#sound-button-game', '#narration-button-game', '#speed-button-game']) {
      if (document.querySelector(id)) out.push(`${id} が読書画面に残っています`);
    }
    // ページ全体が横スクロールになっていない
    if (document.documentElement.scrollWidth > vw + 1) out.push('ページが横にはみ出しています');
    return out;
  });
  expect(problems).toEqual([]);
}

for (const vp of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 375, height: 667 },
  { width: 320, height: 568 },
]) {
  test(`ヘッダーが見切れない（${vp.width}x${vp.height}）`, async ({ page }) => {
    await page.setViewportSize(vp);
    await openLongestTitleStory(page);
    await expectHeaderFits(page);
  });
}

test('長いタイトルではタイトルが省略されてもピル2つは見切れない', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openLongestTitleStory(page);
  // 実在作品より長いタイトルを入れて、タイトル側が省略される条件を作る
  const longTitle = 'これはとても長いタイトルの物語です・改行なしでどこまでも続く題名';
  await page.evaluate((t) => {
    document.querySelector('.game-title')!.textContent = t;
  }, longTitle);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    const title = document.querySelector('.game-title') as HTMLElement;
    const shelf = document.querySelector('#to-title-button')?.getBoundingClientRect();
    const settings = document.querySelector('#settings-button-game')?.getBoundingClientRect();
    if (!shelf || !settings) return ['ピルが見つかりません'];
    const tr = title.getBoundingClientRect();
    // タイトルが省略されている（全文は入り切らないので、要素幅より中身が広い）
    if (title.scrollWidth <= title.clientWidth + 1) out.push('タイトルが省略されていません');
    // それでもタイトル自体がピルを押し出していない
    if (tr.right > shelf.left + 1) out.push('タイトルが「本棚に戻る」に重なっています');
    for (const [name, r] of [['本棚に戻る', shelf], ['設定', settings]] as const) {
      if (r.left < -1 || r.right > vw + 1) out.push(`「${name}」が画面の横幅からはみ出しています`);
    }
    if (document.documentElement.scrollWidth > vw + 1) out.push('ページが横にはみ出しています');
    return out;
  });
  expect(problems).toEqual([]);
  await expect(page.locator('.game-title')).toHaveText(longTitle);
});

test('本編から開いた設定は「本に戻る」で本編へ戻り、タイトルからは「タイトルに戻る」', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
  await expect(page.locator('#game-screen')).toBeVisible();

  // 本編から設定を開くと、戻るボタンの文言が「本に戻る」になる
  await page.locator('#settings-button-game').click();
  await expect(page.locator('#settings-screen')).toBeVisible();
  await expect(page.locator('#settings-back')).toHaveText('本に戻る');

  // 設定で切り替えた状態は本編に戻っても効いている（音オフ→BGM停止）
  await page.locator('#sound-button').click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'off');
  await page.locator('#settings-back').click();
  await expect(page.locator('#game-screen')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'off');

  // タイトルから開いた設定は「タイトルに戻る」
  await page.locator('#to-title-button').click();
  await page.locator('#shelf-back').click();
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.locator('#settings-back')).toHaveText('タイトルに戻る');
  await page.locator('#settings-back').click();
  await expect(page.locator('#title-screen')).toBeVisible();
});

test('設定画面のオン/オフ項目は「アイコン＋項目名＋右端のスイッチ」でそろっている', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.locator('#settings-screen')).toBeVisible();

  // 対象のオン/オフ項目すべてがスイッチ型で、行の先頭にアイコンがある
  for (const id of ['#sound-button', '#narration-button', '#furigana-button']) {
    await expect(page.locator(id)).toHaveAttribute('role', 'switch');
    const row = page.locator('.settings-row', { has: page.locator(id) });
    await expect(row.locator('.settings-icon')).toBeVisible();
    // スイッチは行の右端にある（行のパディング分を除いて、ほぼ一致）
    const rowBox = await row.boundingBox();
    const switchBox = await page.locator(id).boundingBox();
    expect(Math.abs(switchBox!.x + switchBox!.width - (rowBox!.x + rowBox!.width))).toBeLessThanOrEqual(12);
  }
  // 読書画面と共通の意味のものは同じアイコン（音=🔊、読み上げ=🗣️）
  await expect(page.locator('.settings-row', { has: page.locator('#sound-button') }).locator('.settings-icon')).toHaveText('🔊');
  await expect(page.locator('.settings-row', { has: page.locator('#narration-button') }).locator('.settings-icon')).toHaveText('🗣️');

  // 既定: 音オン、読み上げオフ、フリガナオフ
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#narration-button')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#furigana-button')).toHaveAttribute('aria-checked', 'false');

  // オンにするとつまみが右へ動く
  const knobX = async (id: string) => (await page.locator(`${id} .switch-knob`).boundingBox())!.x;
  const before = await knobX('#furigana-button');
  await page.locator('#furigana-button').click();
  await expect(page.locator('#furigana-button')).toHaveAttribute('aria-checked', 'true');
  expect(await knobX('#furigana-button')).toBeGreaterThan(before);

  // オフに戻せる
  await page.locator('#sound-button').click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-checked', 'false');
});
