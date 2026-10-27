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

  it('ルビは一部の場面だけに付き、全漢字には振らない', () => {
    const withRuby = texts.filter((t) => hasRuby(t));
    expect(withRuby.length).toBeGreaterThan(0);
    expect(withRuby.length).toBeLessThan(texts.length);
    const rubyCount = (all.match(/《/g) ?? []).length;
    const kanjiCount = (all.match(/[一-龥]/g) ?? []).length;
    expect(rubyCount).toBeGreaterThanOrEqual(20);
    expect(rubyCount * 10).toBeLessThan(kanjiCount); // ルビ対象は漢字総数の1割未満
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

  it('他の作品にはルビ記法が混ざっていない', () => {
    for (const story of STORIES) {
      if (story.id === 'midnight-school') continue;
      for (const node of Object.values(story.nodes)) {
        expect(hasRuby(node.text), `${story.id}/${node.id}`).toBe(false);
      }
    }
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
    // 上履きは4場面に出るが、ルビが付くのは初出の1回だけ
    expect(shown.filter((k) => k === '上履き《うわばき》')).toHaveLength(1);
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
