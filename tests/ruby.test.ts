import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasRuby, parseRuby, RubyFirstOnlyTracker, stripRuby, type RubyPart } from '../src/ruby';
import { STORIES } from '../src/stories';
import { midnightSchool } from '../src/stories/midnight-school';

/** 1場面分の本文を通し、ルビ表示する語（対象＋読み）の列を返す（buildSegment と同じ数え方） */
function shownRubies(tracker: RubyFirstOnlyTracker, text: string, context: string): string[] {
  const seen = new Map<string, number>();
  const shown: string[] = [];
  for (const part of parseRuby(text)) {
    if (!part.ruby) continue;
    const key = `${part.text}《${part.ruby}》`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    if (tracker.shouldShow(part, context, occurrence)) shown.push(key);
  }
  return shown;
}

const part = (text: string, ruby: string): RubyPart => ({ text, ruby });

describe('フリガナ記法 parseRuby', () => {
  it('漢字の直後の《よみ》をルビとして分ける', () => {
    expect(parseRuby('私、久瀬遥《くぜはるか》、ただ一人だった。')).toEqual([
      { text: '私、' },
      { text: '久瀬遥', ruby: 'くぜはるか' },
      { text: '、ただ一人だった。' },
    ]);
  });

  it('記法の無い本文はそのまま1つの部分になる（後方互換）', () => {
    const text = '夕方から降り始めた雨は、窓を叩く音をだんだん強くしていた。';
    expect(parseRuby(text)).toEqual([{ text }]);
    expect(hasRuby(text)).toBe(false);
  });

  it('1つの文に複数のルビがあっても順序を保つ', () => {
    expect(parseRuby('濡れた足跡《あしあと》が、下駄箱《げたばこ》から続いていた。')).toEqual([
      { text: '濡れた' },
      { text: '足跡', ruby: 'あしあと' },
      { text: 'が、' },
      { text: '下駄箱', ruby: 'げたばこ' },
      { text: 'から続いていた。' },
    ]);
  });

  it('｜で範囲を明示した場合は、漢字以外を含む範囲も対象になる', () => {
    expect(parseRuby('｜午前0時《ごぜんれいじ》を指した。')).toEqual([
      { text: '午前0時', ruby: 'ごぜんれいじ' },
      { text: 'を指した。' },
    ]);
  });

  it('対応する》が無い・漢字が直前に無い《》は記法として扱わない', () => {
    expect(parseRuby('記号《だけ')).toEqual([{ text: '記号《だけ' }]);
    expect(parseRuby('あ《い》う')).toEqual([{ text: 'あ《い》う' }]);
  });
});

describe('stripRuby（読み上げ側との整合）', () => {
  it('ルビを取り除き、対象の漢字だけを残す', () => {
    expect(stripRuby('文化祭を明日《あした》に控えた。私、久瀬遥《くぜはるか》。')).toBe('文化祭を明日に控えた。私、久瀬遥。');
    expect(stripRuby('記法のない文。')).toBe('記法のない文。');
  });

  it('scripts 側の正規表現版 stripRuby と、全作品の本文で結果が一致する', () => {
    // scripts/build-narration.mjs と tests/narration.test.ts は、正規表現で記法を取り除く。
    // 規則がずれて読み上げ文が変わらないよう、ここで一致を保証する
    const regexStrip = (t: string): string => t.replace(/｜([^《]*)《[^》]*》/g, '$1').replace(/《[^》]*》/g, '');
    for (const story of STORIES) {
      for (const node of Object.values(story.nodes)) {
        expect(regexStrip(node.text), `${story.id}/${node.id}`).toBe(stripRuby(node.text));
      }
    }
  });
});

describe('『午前0時の校舎』のルビ付け', () => {
  const texts = Object.values(midnightSchool.nodes).map((n) => n.text);
  const all = texts.join('');

  it('全場面にルビ記法が付く（他作品と同じ全文フリガナ）', () => {
    for (const text of texts) {
      expect(hasRuby(text)).toBe(true);
    }
    const rubyCount = (all.match(/《/g) ?? []).length;
    expect(rubyCount).toBeGreaterThanOrEqual(300);
  });

  it('記法を取り除くと、元の本文と一致する（表示以外のデータは変えない）', () => {
    for (const node of Object.values(midnightSchool.nodes)) {
      expect(stripRuby(node.text)).not.toContain('《');
      expect(stripRuby(node.text)).not.toContain('》');
    }
  });

  it('人名の読みは既存の読み指定（久瀬遥＝くぜはるか、佐伯＝さえき）と一致する', () => {
    expect(all).toContain('久瀬遥《くぜはるか》');
    expect(all).toContain('佐伯《さえき》');
  });

});

describe('全作品のルビ付け（2026-10-28 全文フリガナ展開）', () => {
  it('新規7冊は全場面にルビ記法が付き、全8冊で記法を取り除ける', () => {
    for (const story of STORIES) {
      for (const node of Object.values(story.nodes)) {
        expect(hasRuby(node.text), `${story.id}/${node.id}`).toBe(true);
        expect(stripRuby(node.text)).not.toContain('《');
        expect(stripRuby(node.text)).not.toContain('》');
      }
    }
  });

  it('全8冊とも rubyAll（初出に限らず全出現に付ける）', () => {
    for (const story of STORIES) {
      expect(story.rubyAll, story.id).toBe(true);
    }
  });

  it('全文フリガナの冊では、繰り返し出る語にも場面をまたいで記法が付いている', () => {
    // 『日曜日、井戸の底で』の「井戸」は多くの場面に出て、どの場面でもルビ記法がある
    const sunday = STORIES.find((s) => s.id === 'sunday-well')!;
    const withIdo = Object.values(sunday.nodes).filter((n) => stripRuby(n.text).includes('井戸'));
    expect(withIdo.length).toBeGreaterThan(5);
    for (const node of withIdo) {
      expect(node.text, node.id).toContain('井戸《いど》');
    }
  });

  it('人名・難読語の読みは、読み上げ用かな修正と一致する', () => {
    const all = Object.fromEntries(STORIES.map((s) => [s.id, Object.values(s.nodes).map((n) => n.text).join('')]));
    expect(all['moon-library']).toContain('森下栞《もりしたしおり》');
    expect(all['moon-library']).toContain('篠宮《しのみや》');
    expect(all['missing-trophy']).toContain('高嶺《たかみね》');
    expect(all['missing-trophy']).toContain('潤《じゅん》');
    expect(all['stardust-station']).toContain('子守唄《こもりうた》');
    expect(all['cafe-tsubame']).toContain('床屋《とこや》');
    expect(all['yubisaki']).toContain('律子《りつこ》');
    expect(all['yubisaki']).toContain('圭介《けいすけ》');
    expect(all['sunday-well']).toContain('真由《まゆ》');
    expect(all['maou-diner']).toContain('灰谷誠一《はいたにせいいち》');
    expect(all['maou-diner']).toContain('女将《おかみ》');
    expect(all['maou-diner']).toContain('閑古鳥《かんこどり》');
    expect(all['maou-diner']).toContain('明日《あした》');
  });
});

describe('ルビの初出だけ表示（RubyFirstOnlyTracker）', () => {
  it('初出の場面では表示し、別の場面では表示しない', () => {
    const tracker = new RubyFirstOnlyTracker();
    expect(tracker.shouldShow(part('上履き', 'うわばき'), 'corridor1', 0)).toBe(true);
    expect(tracker.shouldShow(part('上履き', 'うわばき'), 'music4', 0)).toBe(false);
    expect(tracker.shouldShow(part('上履き', 'うわばき'), 'end_caught', 0)).toBe(false);
  });

  it('同じ場面を再表示しても、初出の場面では表示し続ける（再描画で消えない）', () => {
    const tracker = new RubyFirstOnlyTracker();
    expect(tracker.shouldShow(part('久瀬遥', 'くぜはるか'), 'start1', 0)).toBe(true);
    // 再描画・設定の切り替えなどで同じ場面を何度描いても同じ結果になる
    expect(tracker.shouldShow(part('久瀬遥', 'くぜはるか'), 'start1', 0)).toBe(true);
    expect(tracker.shouldShow(part('久瀬遥', 'くぜはるか'), 'start1', 0)).toBe(true);
  });

  it('同じ場面の中でも、2回目以降の出現には付けない', () => {
    const tracker = new RubyFirstOnlyTracker();
    expect(tracker.shouldShow(part('足跡', 'あしあと'), 'start3', 0)).toBe(true);
    expect(tracker.shouldShow(part('足跡', 'あしあと'), 'start3', 1)).toBe(false);
    expect(tracker.shouldShow(part('足跡', 'あしあと'), 'start3', 2)).toBe(false);
  });

  it('読みが違えば別の語として扱い、それぞれ初出で表示する', () => {
    const tracker = new RubyFirstOnlyTracker();
    expect(tracker.shouldShow(part('明日', 'あした'), 'start1', 0)).toBe(true);
    expect(tracker.shouldShow(part('明日', 'あす'), 'start2', 0)).toBe(true);
    expect(tracker.shouldShow(part('明日', 'あした'), 'start3', 0)).toBe(false);
  });

  it('ルビの無い部分は常に対象外', () => {
    const tracker = new RubyFirstOnlyTracker();
    expect(tracker.shouldShow({ text: 'ただの文字' }, 'start1', 0)).toBe(false);
  });

  it('reset すると、また初出から数え直す（作品の切り替え）', () => {
    const tracker = new RubyFirstOnlyTracker();
    expect(tracker.shouldShow(part('上履き', 'うわばき'), 'corridor1', 0)).toBe(true);
    expect(tracker.shouldShow(part('上履き', 'うわばき'), 'music4', 0)).toBe(false);
    tracker.reset();
    expect(tracker.shouldShow(part('上履き', 'うわばき'), 'music4', 0)).toBe(true);
  });

  it('『午前0時の校舎』を通して読むと、繰り返す語のルビは全体で1回だけになる', () => {
    const tracker = new RubyFirstOnlyTracker();
    const shown: string[] = [];
    for (const node of Object.values(midnightSchool.nodes)) {
      shown.push(...shownRubies(tracker, node.text, node.id));
    }
    // 上履き（語幹は 上履《うわば》）は4場面に出るが、トラッカー表示では初出の1回だけ
    expect(shown.filter((k) => k === '上履《うわば》')).toHaveLength(1);
    // 記法のある語は、どれも必ず1回はルビ付きで出る（初出がどこかにはある）
    const annotated = new Set<string>();
    for (const node of Object.values(midnightSchool.nodes)) {
      for (const p of parseRuby(node.text)) {
        if (p.ruby) annotated.add(`${p.text}《${p.ruby}》`);
      }
    }
    for (const key of annotated) {
      expect(shown.filter((k) => k === key), key).toHaveLength(1);
    }
    expect(shown.length).toBe(annotated.size);
  });
});

describe('多読語の固定読み（2026-10-28 監査で確定した読み）', () => {
  // 多読語は辞書の代表読みでは決めず、文脈判断で確定した読みをここに固定する。
  // 表示（ルビ）と読み上げ（scripts/kana-texts.json）の両方で同じ読みになること。
  const storyText = (id: string): string => {
    const story = STORIES.find((s) => s.id === id);
    if (!story) throw new Error(`story not found: ${id}`);
    return Object.values(story.nodes).map((n) => n.text).join('\n');
  };
  const KANA_TEXTS = JSON.parse(readFileSync('scripts/kana-texts.json', 'utf8')) as Record<string, string>;

  it('『魔王のいない国の食堂』: 被る=かぶ、額=ひたい、角=つの、単独の戦=いくさ', () => {
    const text = storyText('maou-diner');
    expect(text).toContain('被《かぶ》った');
    expect(text).not.toContain('被《こうむ》');
    expect(text).toContain('額《ひたい》');
    expect(text).not.toContain('額《がく》');
    expect(text).toContain('角《つの》');
    expect(text).not.toContain('角《かく》');
    expect(text).toContain('戦《いくさ》が');
    expect(text).toContain('戦《いくさ》の');
    expect(text).not.toContain('戦《たたか》が');
    expect(text).not.toContain('戦《たたか》の話');
    expect(text).not.toContain('戦《たたか》の最中');
    // 複合語・動詞は対象外（現行維持）: 戦う、戦争、最終決戦
    expect(text).toContain('戦《たたか》う');
    expect(KANA_TEXTS['maou-diner/meet2']).toContain('いくさが終われば');
    expect(KANA_TEXTS['maou-diner/day1']).toContain('いくさの話');
    expect(KANA_TEXTS['maou-diner/day2']).toContain('いくさの最中');
    expect(KANA_TEXTS['maou-diner/demon1']).toContain('かぶった');
    expect(KANA_TEXTS['maou-diner/demon1']).toContain('ひたいには');
    expect(KANA_TEXTS['maou-diner/demon1']).toContain('つのの痕');
    expect(KANA_TEXTS['maou-diner/last1']).toContain('ひたいのつのは');
  });

  it('時間の読み: 十分=じっぷん、三分=さんぷん、三十分=さんじゅっぷん、四十分=よんじゅっぷん', () => {
    const cafe = storyText('cafe-tsubame');
    expect(cafe).toContain('十分《じっぷん》');
    expect(cafe).not.toContain('十分《じゅうふん》');
    expect(cafe).not.toContain('十分《じゅうぶん》');
    expect(cafe).toContain('三軒《さんげん》');
    expect(KANA_TEXTS['cafe-tsubame/candle1']).toContain('じっぷんご');
    expect(KANA_TEXTS['cafe-tsubame/call1']).toContain('じっぷんご');
    expect(KANA_TEXTS['cafe-tsubame/call1']).toContain('さんげん');

    const trophy = storyText('missing-trophy');
    expect(trophy).toContain('三十分《さんじゅっぷん》');
    expect(trophy).not.toContain('さんじゅうふん');
    expect(KANA_TEXTS['missing-trophy/choice_photo']).toContain('さんじゅっぷん');

    const yubi = storyText('yubisaki');
    expect(yubi).toContain('三分《さんぷん》');
    expect(yubi).toContain('四十分《よんじゅっぷん》');
    expect(yubi).not.toContain('さんふん');
    expect(yubi).not.toContain('よんじゅうふん');
    // 「それで十分だった」の十分は じゅうぶん（「足りる」の意）で正しい
    expect(yubi).toContain('十分《じゅうぶん》');
    expect(KANA_TEXTS['yubisaki/close1']).toContain('さんぷんご');
    expect(KANA_TEXTS['yubisaki/taxi1']).toContain('よんじゅっぷん');
  });

  it('助数詞の促音: 一冊=いっさつ、一本=いっぽん', () => {
    const moon = storyText('moon-library');
    expect(moon).toContain('一冊《いっさつ》');
    expect(moon).toContain('一本《いっぽん》');
    expect(moon).not.toContain('いちさつ');
    expect(moon).not.toContain('いちほん');
    expect(KANA_TEXTS['moon-library/start1']).toContain('いっさつずつ');
    expect(KANA_TEXTS['moon-library/start2']).toContain('いっさつは');
    expect(KANA_TEXTS['moon-library/choice_rain']).toContain('いっぽん');
  });

  it('『日曜日、井戸の底で』: 井戸の縁=ふち、一文字=いちもじ（読み上げ側）', () => {
    expect(KANA_TEXTS['sunday-well/start6']).toContain('このふちに座った');
    expect(KANA_TEXTS['sunday-well/happy1']).toContain('いちもじもらった');
  });
});
