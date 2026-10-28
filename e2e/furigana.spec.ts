import { expect, test, type Page } from '@playwright/test';

/** トップで「はじめる」を押し、本棚で『午前0時の校舎』を選んで本編に入る */
async function beginStory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'はじめる' }).click();
  await page.locator('.book-card').first().click();
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#resume-dialog').isVisible()) {
      await page.getByRole('button', { name: 'つづきから読む' }).click();
      break;
    }
    if (await page.locator('#story-text').isVisible()) break;
    await page.waitForTimeout(100);
  }
}

/** 設定画面でフリガナのボタンを押して、タイトルに戻る */
async function toggleFuriganaFromSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '設定' }).click();
  await page.locator('#furigana-button').click();
  await page.getByRole('button', { name: 'タイトルに戻る' }).click();
}

/** ルビの読み（rt）を除いた本文テキスト。textContent のままだと読みが割り込んで文がつながらない */
async function storyPlainText(page: Page): Promise<string> {
  return page.locator('#story-text').evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('rt').forEach((rt) => rt.remove());
    return clone.textContent ?? '';
  });
}

/**
 * 本文に needle が出るまで読み進める。途中で選択肢が出たら choiceLabels から選ぶ。
 * 『午前0時の校舎』の経路：懐中電灯を取る → 廊下（上履きの初出）→ 音楽室をのぞく → music4（上履き2回目）
 */
async function playUntil(page: Page, needle: string, choiceLabels: string[] = []): Promise<void> {
  const labels = [...choiceLabels];
  for (let i = 0; i < 60; i++) {
    if ((await storyPlainText(page)).includes(needle)) return;
    if (await page.locator('#choices').isVisible()) {
      const label = labels.shift();
      if (label === undefined) throw new Error(`想定外の選択肢が出ました（${needle} を探し中）`);
      await page.locator('#choices button', { hasText: label }).first().click();
    } else {
      await page.locator('#message-window').click();
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`「${needle}」までたどり着けませんでした`);
}

const LIGHT_LABEL = '教室の後ろの棚から、懐中電灯を持っていく';
const MUSIC_LABEL = '足跡をたどって、音楽室をのぞく';

test.describe('フリガナ表示', () => {
  test('初期状態（オフ）ではルビが出ず、記法も本文に残らない', async ({ page }) => {
    await page.goto('/');
    await beginStory(page);
    const storyText = page.locator('#story-text');
    await expect(storyText).toContainText('久瀬遥');
    await expect(storyText.locator('ruby')).toHaveCount(0);
    await expect(storyText).not.toContainText('《');
    await expect(storyText).not.toContainText('くぜはるか');
  });

  test('オンにすると <ruby> で読みが付き、本文の表示は変わらない', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await beginStory(page);
    const storyText = page.locator('#story-text');
    const ruby = storyText.locator('ruby', { hasText: '久瀬遥' });
    await expect(ruby).toHaveCount(1);
    await expect(ruby.locator('rt')).toHaveText('くぜはるか');
    // 明日《あした》のルビも付く。本文そのものは記法のない元本文どおり
    await expect(storyText.locator('ruby', { hasText: '明日' }).locator('rt')).toHaveText('あした');
    // 本文そのもの（ルビの読みを除いた並び）は、記法のない元本文どおり
    expect(await storyPlainText(page)).toContain('文化祭を明日に控えた金曜日');
    await expect(storyText).not.toContainText('《');
  });

  test('オンは保存され、再読み込み後も効く。オフに戻すと消える', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await page.reload();
    await page.getByRole('button', { name: '設定' }).click();
    await expect(page.locator('#furigana-button')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'タイトルに戻る' }).click();
    await beginStory(page);
    await expect(page.locator('#story-text ruby')).not.toHaveCount(0);

    // 本棚・タイトルへ戻り、設定でオフに戻すと aria-pressed が false になる
    await page.locator('#to-title-button').click();
    await page.locator('#shelf-back').click();
    await page.getByRole('button', { name: '設定' }).click();
    await page.locator('#furigana-button').click();
    await expect(page.locator('#furigana-button')).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'タイトルに戻る' }).click();
    await beginStory(page);
    await expect(page.locator('#story-text ruby')).toHaveCount(0);
    await expect(page.locator('#story-text')).toContainText('久瀬遥');
  });

  test('『午前0時の校舎』も全文フリガナで、同じ語の2回目以降にもルビが付く', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await beginStory(page);
    // 廊下の場面（corridor1）が上履きの初出。語幹（上履《うわば》）にルビが付く
    await playUntil(page, '自分の上履きの音が', [LIGHT_LABEL]);
    const storyText = page.locator('#story-text');
    const firstRuby = storyText.locator('ruby', { hasText: '上履' });
    await expect(firstRuby).toHaveCount(1);
    await expect(firstRuby.locator('rt')).toHaveText('うわば');
    // 読み返しを開いて閉じる（＝同じ場面の再描画）でも、ルビは消えたり増えたりしない
    await page.locator('#backlog-button').click();
    const backlogRuby = page.locator('#backlog-text ruby', { hasText: '上履' });
    await expect(backlogRuby).toHaveCount(1);
    await expect(backlogRuby.locator('rt')).toHaveText('うわば');
    await page.locator('#backlog-close').click();
    await expect(storyText.locator('ruby', { hasText: '上履' })).toHaveCount(1);
    // 音楽室の場面（music4）の上履き（2回目）にも、全文フリガナなのでルビが付く
    await playUntil(page, '濡れた片方だけの上履き', [MUSIC_LABEL]);
    expect(await storyPlainText(page)).toContain('濡れた片方だけの上履きが置いてあった');
    await expect(storyText.locator('ruby', { hasText: '上履' })).toHaveCount(1);
    // その場面の他の語（譜面）にもルビが付く
    const musicRuby = storyText.locator('ruby', { hasText: '譜面' });
    await expect(musicRuby).toHaveCount(1);
    await expect(musicRuby.locator('rt')).toHaveText('ふめん');
  });

  test('『午前0時の校舎』も他作品と同じ密度でルビが付く', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await beginStory(page);
    // 冒頭の場面だけで2桁のルビが付く（旧・選択的な付け方では数個だけだった）
    const count = await page.locator('#story-text ruby').count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('全文フリガナの作品では、同じ語の2回目以降にもルビが付く', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await page.getByRole('button', { name: 'はじめる' }).click();
    // 『日曜日、井戸の底で』は本棚の6冊目（index 5）
    await page.locator('.book-card').nth(5).click();
    for (let i = 0; i < 10; i++) {
      if (await page.locator('#story-text').isVisible()) break;
      await page.waitForTimeout(100);
    }
    // 「井戸」が2回出る場面（start5）まで読み進める
    for (let i = 0; i < 20; i++) {
      if ((await storyPlainText(page)).includes('――井戸だ')) break;
      await page.locator('#message-window').click();
      await page.waitForTimeout(120);
    }
    expect(await storyPlainText(page)).toContain('――井戸だ');
    const storyText = page.locator('#story-text');
    // 初出だけの作品なら1つだけだが、全文フリガナでは両方に付く
    await expect(storyText.locator('ruby', { hasText: '井戸' })).toHaveCount(2);
  });

  test('他の作品にもルビが付き、記法は本文に残らない', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await page.getByRole('button', { name: 'はじめる' }).click();
    // 2冊目（『月夜の図書室』）を開く
    await page.locator('.book-card').nth(1).click();
    for (let i = 0; i < 10; i++) {
      if (await page.locator('#story-text').isVisible()) break;
      await page.waitForTimeout(100);
    }
    const storyText = page.locator('#story-text');
    await expect(storyText.locator('ruby').first()).toBeVisible();
    await expect(storyText).not.toContainText('《');
  });
});
