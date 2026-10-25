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

/** トップで「はじめる」を押し、本棚で『午前0時の校舎』を選んで本編に入る */
async function beginStory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
}

async function startAndAdvanceToFirstChoice(page: Page): Promise<void> {
  await page.goto('/');
  await beginStory(page);
  for (let i = 0; i < 12 && !(await page.locator('#choices').isVisible()); i++) {
    await page.locator('#message-window').click();
  }
}

test('タイトルから始めて、文章が進み、最初の選択肢が出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'サウンドノベル' })).toBeVisible();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('#shelf-screen')).toBeVisible();
  await expect(page.locator('.book-card').first()).toContainText('午前0時の校舎');
  await page.locator('.book-card').first().click();
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
  await page.locator('#message-window').click();
  await expect(page.locator('#story-text')).toContainText('夕方から降り始めた雨');
  await startAndAdvanceToFirstChoice(page);
  await expect(page.locator('#choices')).toBeVisible();
  await expect(page.locator('#choices button', { hasText: '懐中電灯' })).toBeVisible();
});

test('選択を誤るとバッドエンドになり、最後の選択からやり直せる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await playToEnding(page, ['そのまま出る', '急ぐ', '返事をする']);
  await expect(page.locator('#ending-title')).toContainText('バッドエンド');
  // 結末の本文は独立したページに出る（直前の文章と重なって読めなくならない）
  await expect(page.locator('#story-text')).toContainText('冷たい手が私の肩に');
  await expect(page.locator('#story-text')).not.toContainText('振り返った先');
  await page.getByRole('button', { name: '最後の選択からやり直す' }).click();
  // 声の選択肢まで戻っている
  await expect(page.locator('#choices')).toBeVisible();
  await expect(page.locator('#choices button', { hasText: '返事をせず' })).toBeVisible();
});

test('正しく選ぶとハッピーエンドになり、タイトルに結末の数が記録される', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await playToEnding(page, ['懐中電灯', '音楽室', '返事をせず', '裏口へ走る']);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
  await page.locator('#ending-title-button').click();
  await expect(page.locator('#shelf-screen')).toBeVisible();
  await expect(page.locator('.book-card').first()).toContainText('到達した結末: 1 / 3');
  await expect(page.locator('.book-card').first()).not.toContainText('つづきから読む');
});

test('途中で閉じても、つづきから再開できる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await page.locator('#message-window').click();
  await page.locator('#message-window').click();
  await page.reload();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.book-card').first()).toContainText('つづきから読む');
  await page.locator('.book-card').first().click();
  await expect(page.locator('#story-text')).toContainText('仕上がった看板を壁に立てかけた');
});

test('本棚から物語を選び直し、途中でも最初から読み直せる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await page.locator('#message-window').click();
  // 本棚へ戻ると、カードに「つづきから読む」が出る
  await page.locator('#to-title-button').click();
  await expect(page.locator('.book-card').first()).toContainText('午前0時の校舎');
  await expect(page.locator('.book-card').first()).toContainText('つづきから読む');
  // 「最初から読み直す」を選ぶと、物語の先頭から始まる
  await page.locator('.book-restart').click();
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
});

test('二冊目（恋愛もの）を選んで、ハッピーエンドまで読める', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').nth(1).click();
  await expect(page.locator('.game-title')).toHaveText('月夜の図書室');
  await playToEnding(page, ['返事を書く', '書き添える', '差し出す', '閉館まで待つ']);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
});

test('三冊目（推理もの）を選んで、真相のハッピーエンドまで読める', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').nth(2).click();
  await expect(page.locator('.game-title')).toHaveText('消えた優勝杯');
  await playToEnding(page, ['窓際', '現像を頼み', 'クレセント錠', '事情を話してもらう']);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
});

test('本を選ぶと、どの本でも共通の「本を開く音」が鳴る', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __uiSounds: string[] }).__uiSounds = [];
    document.addEventListener('app:sound', (e) => {
      const ui = (e as CustomEvent<{ ui?: string }>).detail?.ui;
      if (ui) (window as unknown as { __uiSounds: string[] }).__uiSounds.push(ui);
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      (window as unknown as { __uiSounds: string[] }).__uiSounds = [];
    });
    await page.locator('.book-card').nth(i).click();
    await expect(page.locator('#game-screen')).toBeVisible();
    const sounds = await page.evaluate(
      () => (window as unknown as { __uiSounds: string[] }).__uiSounds,
    );
    expect(sounds).toContain('book');
    expect(sounds).not.toContain('button');
    await page.locator('#to-title-button').click();
    await expect(page.locator('#shelf-screen')).toBeVisible();
  }
});

test('追加した本では、BGMのテーマが物語に合っている', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').nth(1).click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm-theme', 'romance');
  await page.locator('#to-title-button').click();
  await page.locator('.book-card').nth(2).click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm-theme', 'mystery');
});

test('BGMが本編で鳴り、音オフとタイトル復帰で止まる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'on');
  await page.locator('#sound-button-game').click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'off');
  await page.locator('#sound-button-game').click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'on');
  await page.getByRole('button', { name: /本棚へ/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'off');
});

test('文章を進めると操作音が鳴る', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __uiSounds: string[] }).__uiSounds = [];
    document.addEventListener('app:sound', (e) => {
      const ui = (e as CustomEvent<{ ui?: string }>).detail?.ui;
      if (ui) (window as unknown as { __uiSounds: string[] }).__uiSounds.push(ui);
    });
  });
  await beginStory(page);
  await page.locator('#message-window').click();
  const sounds = await page.evaluate(
    () => (window as unknown as { __uiSounds: string[] }).__uiSounds,
  );
  expect(sounds).toContain('advance');
});

test('バッドエンドの効果音は、文章のあとパネルが出る瞬間に鳴る', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __uiSounds: string[] }).__uiSounds = [];
    document.addEventListener('app:sound', (e) => {
      const ui = (e as CustomEvent<{ ui?: string }>).detail?.ui;
      if (ui) (window as unknown as { __uiSounds: string[] }).__uiSounds.push(ui);
    });
  });
  await beginStory(page);
  const labels = ['懐中電灯', '音楽室', '返事をする'];
  const readSounds = () =>
    page.evaluate(() => (window as unknown as { __uiSounds: string[] }).__uiSounds);
  let revealed = false;
  for (let i = 0; i < 80 && !revealed; i++) {
    if (await page.locator('#choices').isVisible()) {
      const label = labels.shift();
      if (label === undefined) throw new Error('選択肢の指定が足りません');
      await page.locator('#choices button', { hasText: label }).first().click();
      continue;
    }
    const beforeText = await page.locator('#story-text').textContent();
    const beforeSounds = await readSounds();
    await page.locator('#message-window').click();
    if (await page.locator('#ending-panel').isVisible()) {
      // パネルが出る直前（結末の文章の表示中）は、まだ鳴っていない
      expect(beforeText).toContain('冷たい手が私の肩に');
      expect(beforeSounds).not.toContain('ending-bad');
      // パネルが出た瞬間に鳴る
      expect(await readSounds()).toContain('ending-bad');
      revealed = true;
    }
  }
  expect(revealed).toBe(true);
  await expect(page.locator('#ending-title')).toContainText('バッドエンド');
  await expect(page.locator('body')).toHaveAttribute('data-bgm-mood', 'bad');
});

test('ハッピーエンドではBGMが明るいものに変わる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await playToEnding(page, ['懐中電灯', '音楽室', '返事をせず', '裏口へ走る']);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
  await expect(page.locator('body')).toHaveAttribute('data-bgm-mood', 'happy');
});

test('読み返しは、いちばん新しい文章から表示される', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  for (let i = 0; i < 4; i++) await page.locator('#message-window').click();
  await page.locator('#backlog-button').click();
  await expect(page.locator('#backlog-screen')).toBeVisible();
  const state = await page.evaluate(() => {
    const el = document.querySelector('#backlog-text');
    if (!el) return null;
    const segments = el.querySelectorAll('.segment');
    const newest = segments[segments.length - 1];
    const er = el.getBoundingClientRect();
    const nr = newest?.getBoundingClientRect();
    return {
      scrollLeft: el.scrollLeft,
      newestVisible: !!nr && nr.left >= er.left - 1 && nr.right <= er.right + 1,
      newestText: newest?.textContent ?? '',
    };
  });
  await expect
    .poll(async () => page.evaluate(() => document.querySelector('#backlog-text')?.scrollLeft ?? 0))
    .toBeLessThan(0);
  expect(state?.newestVisible).toBe(true);
  expect(state?.newestText).toContain('スマホの電池は残り');
});

test('結末は文章だけが先に表示され、もう一度押すとパネルが出る', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __uiSounds: string[] }).__uiSounds = [];
    document.addEventListener('app:sound', (e) => {
      const ui = (e as CustomEvent<{ ui?: string }>).detail?.ui;
      if (ui) (window as unknown as { __uiSounds: string[] }).__uiSounds.push(ui);
    });
  });
  await beginStory(page);
  const labels = ['懐中電灯', '音楽室', '返事をせず', '裏口へ走る'];
  let revealed = false;
  for (let i = 0; i < 80 && !revealed; i++) {
    if (await page.locator('#choices').isVisible()) {
      const label = labels.shift();
      if (label === undefined) throw new Error('選択肢の指定が足りません');
      await page.locator('#choices button', { hasText: label }).first().click();
      continue;
    }
    const before = await page.locator('#story-text').textContent();
    const panelWasHidden = await page.locator('#ending-panel').isHidden();
    const soundsBefore = await page.evaluate(
      () => (window as unknown as { __uiSounds: string[] }).__uiSounds,
    );
    await page.locator('#message-window').click();
    if (await page.locator('#ending-panel').isVisible()) {
      // パネルが出る直前は、結末の文章だけが表示されていたこと
      expect(panelWasHidden).toBe(true);
      expect(before).toContain('家に帰り着いたのは');
      // ハッピーエンドの効果音も、パネルが出る瞬間に鳴る
      expect(soundsBefore).not.toContain('ending-happy');
      const soundsAfter = await page.evaluate(
        () => (window as unknown as { __uiSounds: string[] }).__uiSounds,
      );
      expect(soundsAfter).toContain('ending-happy');
      revealed = true;
    }
  }
  expect(revealed).toBe(true);
  await expect(page.locator('#ending-title')).toContainText('ハッピーエンド');
});

test('新しい版があると、画面下のバナーが出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#update-banner')).toBeHidden();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:need-refresh')));
  await expect(page.locator('#update-banner')).toBeVisible();
});

test('ボタンを押すと操作音が鳴る', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __uiSounds: string[] }).__uiSounds = [];
    document.addEventListener('app:sound', (e) => {
      const ui = (e as CustomEvent<{ ui?: string }>).detail?.ui;
      if (ui) (window as unknown as { __uiSounds: string[] }).__uiSounds.push(ui);
    });
  });
  await beginStory(page);
  const sounds = await page.evaluate(
    () => (window as unknown as { __uiSounds: string[] }).__uiSounds,
  );
  expect(sounds).toContain('button');
});

test('タイトル画面と本編の画面が分かれている', async ({ page }) => {
  await page.goto('/');
  // トップ画面: 本編は出ず、あるのは「はじめる」「設定」「バージョン」だけ
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('#game-screen')).toBeHidden();
  await expect(page.locator('.backup')).toBeHidden();
  // 設定の画面に、バックアップとインストール方法がある
  await page.getByRole('button', { name: '設定' }).click();
  await expect(page.locator('#settings-screen')).toBeVisible();
  await expect(page.locator('.backup')).toBeVisible();
  await expect(page.locator('#install-open')).toBeVisible();
  await page.getByRole('button', { name: 'タイトルに戻る' }).click();
  await expect(page.locator('#title-screen')).toBeVisible();
  await beginStory(page);
  // 本編の画面: タイトル画面の要素（バックアップ・インストール・バージョン）は出ない
  await expect(page.locator('#game-screen')).toBeVisible();
  await expect(page.locator('#title-screen')).toBeHidden();
  await expect(page.locator('.backup')).toBeHidden();
  await expect(page.locator('#install-open')).toBeHidden();
  await expect(page.locator('#version-line')).toBeHidden();
  await expect(page.locator('#story-text')).toBeVisible();
  // 本編から戻ると本棚、そこから戻るとタイトル画面だけになる
  await page.locator('#to-title-button').click();
  await expect(page.locator('#shelf-screen')).toBeVisible();
  await expect(page.locator('#game-screen')).toBeHidden();
  await page.getByRole('button', { name: 'タイトルに戻る' }).click();
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('#shelf-screen')).toBeHidden();
});

test('本文は縦書き（小説風）で表示される', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  const writingMode = await page.locator('#story-text .segment').first().evaluate((el) => getComputedStyle(el).writingMode);
  expect(writingMode).toBe('vertical-rl');
  // 数字は縦中横（tcy）で包まれている（11時57分 の場面まで進めて確認）
  for (let i = 0; i < 3; i++) await page.locator('#message-window').click();
  await expect(page.locator('#story-text')).toContainText('11時57分');
  await expect(page.locator('#story-text .tcy').filter({ hasText: '11' }).first()).toHaveText('11');
});

test('文章は消えずに左へ追加され、選択肢では直前の文章だけが残る', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
  await page.locator('#message-window').click();
  // 前の文章が残ったまま、次の文章が追加されている
  await expect(page.locator('#story-text')).toContainText('文化祭を明日に控えた');
  await expect(page.locator('#story-text')).toContainText('夕方から降り始めた雨');
  // 文章ごとに改行され、2つ目の文章は1つ目より左の列から始まる
  const broken = await page.evaluate(() => {
    const segs = [...document.querySelectorAll('#story-text .segment')].map((el) => el.getBoundingClientRect());
    return segs.length === 2 && segs[1].right <= segs[0].left + 1;
  });
  expect(broken).toBe(true);
  // 選択肢まで進めると、それまでの文章は消え、直前の文章（選択肢の場面の文章）だけが残る
  for (let i = 0; i < 12 && !(await page.locator('#choices').isVisible()); i++) {
    await page.locator('#message-window').click();
  }
  await expect(page.locator('#choices')).toBeVisible();
  await expect(page.locator('#story-text')).toContainText('廊下は真っ暗だ');
  await expect(page.locator('#story-text')).not.toContainText('文化祭を明日に控えた');
  const centered = await page.evaluate(() => {
    const stage = document.querySelector('.stage')!.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('#choices button')].map((b) => b.getBoundingClientRect());
    const left = Math.min(...buttons.map((r) => r.left));
    const right = Math.max(...buttons.map((r) => r.right));
    return Math.abs((left + right) / 2 - (stage.left + stage.right) / 2);
  });
  expect(centered).toBeLessThan(24);
});

test('読み返しで、前のページや、選んだ選択肢だけをさかのぼれる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  await page.locator('#message-window').click();
  await page.locator('#message-window').click();
  await page.getByRole('button', { name: '読み返す' }).click();
  await expect(page.locator('#backlog-screen')).toBeVisible();
  await expect(page.locator('#backlog-text')).toContainText('文化祭を明日に控えた');
  await expect(page.locator('#backlog-text')).toContainText('仕上がった看板を壁に立てかけた');
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('#game-screen')).toBeVisible();
  // 最初の選択肢まで進めて、懐中電灯を選ぶ
  for (let i = 0; i < 12 && !(await page.locator('#choices').isVisible()); i++) {
    await page.locator('#message-window').click();
  }
  // 選択肢が出ている最中でも、右端の三角から読み返しを開ける
  await page.getByRole('button', { name: '読み返す' }).click();
  await expect(page.locator('#backlog-screen')).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('#choices')).toBeVisible();
  await page.getByRole('button', { name: '懐中電灯を持っていく' }).click();
  await page.getByRole('button', { name: '読み返す' }).click();
  // 読み返しに残るのは、選んだ選択肢だけ（選ばなかった方は出てこない）
  await expect(page.locator('#backlog-text')).toContainText('懐中電灯を持っていく');
  await expect(page.locator('#backlog-text')).not.toContainText('明かりはなくても');
});

test('文章で画面がいっぱいになったら、ページがめくれて新しいページが始まる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await beginStory(page);
  for (let i = 0; i < 4; i++) await page.locator('#message-window').click();
  // 5つ目の文章まで進むと、ページがめくれて、最初の文章は本文から消えている
  await expect(page.locator('#story-text')).toContainText('画面は黒く落ちた');
  await expect(page.locator('#story-text')).not.toContainText('文化祭を明日に控えた');
  // めくれたページも「読み返す」で読める
  await page.getByRole('button', { name: '読み返す' }).click();
  await expect(page.locator('#backlog-text')).toContainText('文化祭を明日に控えた');
});

test('文章は背景の上に重なり、選択肢は縦書きで選べる', async ({ page }) => {
  await page.goto('/');
  await beginStory(page);
  // 文章が背景イラストの上に重なっている
  const overlap = await page.evaluate(() => {
    const bg = document.getElementById('scene-img')!.getBoundingClientRect();
    const text = document.getElementById('story-text')!.getBoundingClientRect();
    return Math.min(bg.right, text.right) - Math.max(bg.left, text.left) > 0
      && Math.min(bg.bottom, text.bottom) - Math.max(bg.top, text.top) > 0;
  });
  expect(overlap).toBe(true);
  // 最初の選択肢まで進める。選択肢は縦書きの帯（高さ > 幅）で、実際に選べる
  for (let i = 0; i < 12 && !(await page.locator('#choices').isVisible()); i++) {
    await page.locator('#message-window').click();
  }
  const firstChoice = page.locator('#choices button').first();
  const writingMode = await firstChoice.evaluate((el) => getComputedStyle(el).writingMode);
  expect(writingMode).toBe('vertical-rl');
  const box = await firstChoice.boundingBox();
  expect(box!.height).toBeGreaterThan(box!.width);
  await firstChoice.click();
  await expect(page.locator('#story-text')).toContainText('懐中電灯');
});

test('音のオン/オフを切り替えられる', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '設定' }).click();
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

test('設定の画面からインストール方法を開ける（使っている端末の説明が開いている）', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '設定' }).click();
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
  await beginStory(page);
  await page.locator('#message-window').click();
  await page.locator('#to-title-button').click();
  await page.getByRole('button', { name: 'タイトルに戻る' }).click();
  await page.getByRole('button', { name: '設定' }).click();
  await page.getByText('記録のバックアップ').click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ファイルに書き出す' }).click()]);
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const text = readFileSync(path, 'utf8');
  const progress = JSON.parse(JSON.parse(text).data[`${APP_ID}-story:midnight-school:progress`] as string) as { nodeId: string };
  expect(progress.nodeId).toBe('start2');

  // 記録を消す → 読み込んで戻す
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.book-card').first()).not.toContainText('つづきから読む');
  await page.getByRole('button', { name: 'タイトルに戻る' }).click();
  await page.getByRole('button', { name: '設定' }).click();
  await page.getByText('記録のバックアップ').click();
  await page.locator('#backup-import').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#backup-message')).toContainText('読み込みました');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.book-card').first()).toContainText('つづきから読む');
});

test('おかしいバックアップファイルは、理由を表示して読み込まない', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '設定' }).click();
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
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.book-card').first()).toContainText('到達した結末: 1 / 3');
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
  // 左下のデバッグパネルがボタンに重なるため、このボタンだけ DOM 経由で押す
  await page.locator('#ending-title-button').evaluate((el) => (el as HTMLElement).click());
  await expect(page.locator('.book-card').first()).toContainText('到達した結末: 0 / 3'); // デバッグを使った回は記録しない
  await expect(panel).toBeVisible(); // オン/オフは保存される
  await page.getByRole('button', { name: 'デバッグモードを終える' }).click();
  await expect(panel).toBeHidden();
});
