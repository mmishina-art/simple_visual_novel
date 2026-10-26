import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/stories';

// 紹介ページ（public/home/）は静的な HTML で、本のラインナップは手で載せている。
// 本を足したときに載せ忘れると、アプリと紹介ページの顔ぶれがずれるので、ここで照合する。
describe('紹介ページのラインナップ', () => {
  const html = readFileSync('public/home/index.html', 'utf8');

  it('全作品の題名が載っている', () => {
    for (const story of STORIES.filter((s) => !s.hidden)) {
      expect(html, `紹介ページに『${story.title}』が載っていない`).toContain(story.title);
    }
  });

  it('表紙画像の数が作品数と一致する', () => {
    const covers = readdirSync('public/home/assets').filter((f) => f.startsWith('cover-') && f.endsWith('.svg'));
    expect(covers.length).toBe(STORIES.filter((s) => !s.hidden).length);
  });
});
