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
    await expect(storyText).toContainText('文化祭を明日');
    await expect(storyText).toContainText('に控えた金曜日');
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

  test('同じ語のルビは初出の場面だけに付き、2回目以降は素の漢字になる', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await beginStory(page);
    // 廊下の場面（corridor1）が上履きの初出。ルビ付きで出る
    await playUntil(page, '自分の上履きの音が', [LIGHT_LABEL]);
    const storyText = page.locator('#story-text');
    const firstRuby = storyText.locator('ruby', { hasText: '上履き' });
    await expect(firstRuby).toHaveCount(1);
    await expect(firstRuby.locator('rt')).toHaveText('うわばき');
    // 読み返しを開いて閉じる（＝同じ場面の再描画）でも、初出のルビは消えたり増えたりしない。
    // 読み返しの中でも、初出の場面にはルビが付く
    await page.locator('#backlog-button').click();
    const backlogRuby = page.locator('#backlog-text ruby', { hasText: '上履き' });
    await expect(backlogRuby).toHaveCount(1);
    await expect(backlogRuby.locator('rt')).toHaveText('うわばき');
    await page.locator('#backlog-close').click();
    await expect(storyText.locator('ruby', { hasText: '上履き' })).toHaveCount(1);
    // 音楽室の場面（music4）にも上履きが出るが、もうルビは付かない。本文には残る
    await playUntil(page, '濡れた片方だけの上履き', [MUSIC_LABEL]);
    await expect(storyText).toContainText('濡れた片方だけの上履きが置いてあった');
    await expect(storyText.locator('ruby', { hasText: '上履き' })).toHaveCount(0);
    // 初出がこの場面の語（譜面台）には、きちんとルビが付く
    const musicRuby = storyText.locator('ruby', { hasText: '譜面台' });
    await expect(musicRuby).toHaveCount(1);
    await expect(musicRuby.locator('rt')).toHaveText('ふめんだい');
  });

  test('作品を開き直すと初出の記録がリセットされ、また初出からルビが付く', async ({ page }) => {
    await page.goto('/');
    await toggleFuriganaFromSettings(page);
    await beginStory(page);
    // 上履きの2回目（music4）まで進め、ルビが付かないことを確認しておく
    await playUntil(page, '自分の上履きの音が', [LIGHT_LABEL]);
    await playUntil(page, '濡れた片方だけの上履き', [MUSIC_LABEL]);
    await expect(page.locator('#story-text ruby', { hasText: '上履き' })).toHaveCount(0);
    // タイトルへ戻り、同じ作品を最初から開き直すと、初出の場面でまたルビが付く
    await page.locator('#to-title-button').click();
    await page.locator('#shelf-back').click();
    await page.getByRole('button', { name: 'はじめる' }).click();
    await page.locator('.book-card').first().click();
    await page.getByRole('button', { name: '最初から読む' }).click();
    await playUntil(page, '自分の上履きの音が', [LIGHT_LABEL]);
    const ruby = page.locator('#story-text ruby', { hasText: '上履き' });
    await expect(ruby).toHaveCount(1);
    await expect(ruby.locator('rt')).toHaveText('うわばき');
  });

  test('ルビ記法の無い他の作品は、オンでも従来通り表示される', async ({ page }) => {
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
    await expect(storyText.locator('ruby')).toHaveCount(0);
    await expect(storyText).not.toContainText('《');
  });
});
