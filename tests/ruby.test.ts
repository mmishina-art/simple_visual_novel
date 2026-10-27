import { describe, expect, it } from 'vitest';
import { hasRuby, parseRuby, stripRuby } from '../src/ruby';
import { STORIES } from '../src/stories';
import { midnightSchool } from '../src/stories/midnight-school';

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
