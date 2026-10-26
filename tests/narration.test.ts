import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/stories';

// 読み上げ音声は事前生成（npm run narration）。文章を直したら生成し直す必要があるので、
// 全場面ぶんの音声がそろっていて、本文と一致しているかをここで照合する。
describe('読み上げ音声', () => {
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as Record<string, { hash: string }>;
  const hashOf = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 10);
  // 読み上げ専用の読み替えと、場面ごとの読み上げ文の差し替え
  // （scripts/build-narration.mjs と同じ表。両方そろえること）
  const SPOKEN_TEXT_OVERRIDES: Record<string, string> = {
    'midnight-school/blackout1': '次の瞬間、非常灯がすべて消えた。完全な暗闇の中で、背後に人の気配があった。',
    'midnight-school/choice_voice': '声が、もう一度、私の名前を呼んだ。',
    'midnight-school/music4': '譜面台の上には、濡れた上履きが片方だけ置いてあった。サイズは私のものとよく似ていた。',
    'missing-trophy/start5': '写真部の同級生、潤がカメラを下げて駆けつけた。式まで、あと三時間。犯人捜し、手伝うよ。まず、どこから調べよう。',
    'missing-trophy/end_truth': '授与式。ステージの優勝杯はスポットライトを受けて輝いた。事情を知るのは、私と、潤と、部長だけ。部長の直した小さな傷跡は、優勝したクラスの、新しい歴史の始まりになった。',
    'stardust-station/locate2': '四十年かけて描いた大きな弧の果てに、船は帰り道の上にいた。まるで、ずっと帰ろうとしていたみたいに。',
    'cafe-tsubame/calm1': '嵐のような一日も、夕方が近づく頃には静かになった。社長はカウンターでうとうとしている。平和だ。平和が一番だ。',
    'cafe-tsubame/recipe2': '太麺をよく炒めて、ケチャップを寝かせて、最後に隠し味。運ばれた皿を見て、美食家の目がはっきりと見開かれた。これだ。この味だ。',
  };
  const spokenText = (key: string, text: string): string => (SPOKEN_TEXT_OVERRIDES[key] ?? text).replace(/AI/g, 'エーアイ');

  it('全作品・全場面ぶんの音声があり、本文と一致している', () => {
    for (const story of STORIES) {
      for (const node of Object.values(story.nodes)) {
        const key = `${story.id}/${node.id}`;
        expect(manifest[key], `${key} の音声が未生成（npm run narration）`).toBeDefined();
        expect(manifest[key].hash, `${key} の文章が音声と食い違っている（npm run narration で再生成）`).toBe(hashOf(spokenText(key, node.text)));
        expect(existsSync(`public/audio/${key}.mp3`), `${key}.mp3 が無い`).toBe(true);
      }
    }
  });
});
