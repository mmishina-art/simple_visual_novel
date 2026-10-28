import { expect, test, type Page } from '@playwright/test';

/**
 * 読書画面のヘッダーの構成を、矩形で機械的に確認する。
 * 1段目: タイトル＋「本棚へ」（右端）。
 * 2段目: 左に朗読のまとまり（読み上げオン/オフ→速度ピル、囲みでひとまとまり）、右に音を離して置く。
 * 以前は全部を1行に並べていて、iPhone 実機で右端のアイコンが見切れた。
 * 長いタイトルではタイトル側が省略されてもよいが、「本棚へ」は常に見切れないこと。
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
    const actions = document.querySelector('.game-header-actions')?.getBoundingClientRect();
    const group = document.querySelector('.narration-group')?.getBoundingClientRect();
    const narration = document.querySelector('#narration-button-game')?.getBoundingClientRect();
    const speed = document.querySelector('#speed-button-game')?.getBoundingClientRect();
    const sound = document.querySelector('#sound-button-game')?.getBoundingClientRect();
    if (!title || !shelf || !actions || !group || !narration || !speed || !sound) {
      return ['ヘッダーの要素が見つかりません'];
    }
    // 「本棚へ」はタイトルと同じ段（1段目）にあり、タイトルの右にある
    if (shelf.top >= title.bottom || shelf.bottom <= title.top) out.push('「本棚へ」がタイトルと同じ段にありません');
    if (shelf.left < title.right - 1) out.push('「本棚へ」がタイトルと重なっています');
    // 「本棚へ」は画面内に収まっている（見切れていない）
    if (shelf.left < -1 || shelf.right > vw + 1) out.push('「本棚へ」が画面の横幅からはみ出しています');
    // 再生系の操作はタイトルの段より下（2段目）にある
    if (actions.top < title.bottom - 1) out.push('再生系の操作がタイトルと同じ段にあります');
    // 朗読のまとまり: 読み上げ→速度の順で隣り合っていて、囲みの中に収まっている
    if (narration.right > speed.left + 1) out.push('読み上げと速度の並びが逆か、重なっています');
    if (narration.top < group.top - 1 || narration.bottom > group.bottom + 1 || speed.top < group.top - 1 || speed.bottom > group.bottom + 1) {
      out.push('読み上げと速度が囲みからはみ出しています');
    }
    const groupStyle = getComputedStyle(document.querySelector('.narration-group')!);
    if (groupStyle.borderTopWidth === '0px' && groupStyle.backgroundColor === 'rgba(0, 0, 0, 0)') {
      out.push('朗読のまとまりに囲み（枠・背景）がありません');
    }
    // 音は囲みの外にあり、まとまりから離れている
    if (sound.left < group.right + 16) out.push('音が朗読のまとまりに近すぎます');
    // 2段目のボタンがすべて画面内に収まっている
    for (const b of document.querySelectorAll<HTMLElement>('.game-header-actions button')) {
      const r = b.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1) {
        out.push(`「${b.getAttribute('aria-label') ?? b.textContent}」が画面の横幅からはみ出しています`);
      }
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

test('長いタイトルではタイトルが省略されても「本棚へ」は見切れない', async ({ page }) => {
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
    if (!shelf) return ['「本棚へ」が見つかりません'];
    const tr = title.getBoundingClientRect();
    // タイトルが省略されている（全文は入り切らないので、要素幅より中身が広い）
    if (title.scrollWidth <= title.clientWidth + 1) out.push('タイトルが省略されていません');
    // それでもタイトル自体が「本棚へ」を押し出していない
    if (tr.right > shelf.left + 1) out.push('タイトルが「本棚へ」に重なっています');
    if (shelf.left < -1 || shelf.right > vw + 1) out.push('「本棚へ」が画面の横幅からはみ出しています');
    if (document.documentElement.scrollWidth > vw + 1) out.push('ページが横にはみ出しています');
    return out;
  });
  expect(problems).toEqual([]);
  await expect(page.locator('.game-title')).toHaveText(longTitle);
});

/** オフのときだけ斜線（::after）が出ているかを返す */
async function slashState(page: Page, selector: string): Promise<{ pressed: string | null; slash: boolean; label: string }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const after = getComputedStyle(el, '::after');
    return {
      pressed: el.getAttribute('aria-pressed'),
      slash: after.content !== 'none' && after.content !== 'normal',
      label: el.textContent ?? '',
    };
  }, selector);
}

test('オフのときはアイコンに斜線が入る（本編ヘッダー）', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
  await expect(page.locator('#game-screen')).toBeVisible();

  // 既定: 読み上げオフ（斜線あり）、音オン（斜線なし）
  expect(await slashState(page, '#narration-button-game')).toMatchObject({ pressed: 'false', slash: true });
  expect(await slashState(page, '#sound-button-game')).toMatchObject({ pressed: 'true', slash: false, label: '🔊' });

  // 読み上げをオンにすると斜線が消える
  await page.locator('#narration-button-game').click();
  expect(await slashState(page, '#narration-button-game')).toMatchObject({ pressed: 'true', slash: false });

  // 音をオフにすると、アイコンは同じ 🔊 のまま斜線が入る
  await page.locator('#sound-button-game').click();
  expect(await slashState(page, '#sound-button-game')).toMatchObject({ pressed: 'false', slash: true, label: '🔊' });
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
