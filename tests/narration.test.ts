import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/stories';

// 読み上げ音声は事前生成（npm run narration）。文章を直したら生成し直す必要があるので、
// 全場面ぶんの音声がそろっていて、本文と一致しているかをここで照合する。
describe('読み上げ音声', () => {
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as Record<string, { hash: string }>;
  const hashOf = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 10);
  // 読み上げ専用の読み替え（scripts/build-narration.mjs と同じ表。両方そろえること）
  const spokenText = (text: string): string => text.replace(/AI/g, 'エーアイ');

  it('全作品・全場面ぶんの音声があり、本文と一致している', () => {
    for (const story of STORIES) {
      for (const node of Object.values(story.nodes)) {
        const key = `${story.id}/${node.id}`;
        expect(manifest[key], `${key} の音声が未生成（npm run narration）`).toBeDefined();
        expect(manifest[key].hash, `${key} の文章が音声と食い違っている（npm run narration で再生成）`).toBe(hashOf(spokenText(node.text)));
        expect(existsSync(`public/audio/${key}.mp3`), `${key}.mp3 が無い`).toBe(true);
      }
    }
  });
});
