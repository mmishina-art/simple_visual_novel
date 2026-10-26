import { describe, expect, it } from 'vitest';
import { TITLE_BPM, TITLE_LOOP_BEATS, TITLE_MELODY, buildTitleEvents } from '../src/title-song';

describe('タイトルBGMの曲データ', () => {
  const events = buildTitleEvents();

  it('イベントは拍順で、すべてループの中に収まる', () => {
    for (let i = 1; i < events.length; i++)
      expect(events[i].beat).toBeGreaterThanOrEqual(events[i - 1].beat);
    for (const ev of events) {
      expect(ev.beat).toBeGreaterThanOrEqual(0);
      expect(ev.beat).toBeLessThan(TITLE_LOOP_BEATS);
    }
    expect(TITLE_LOOP_BEATS).toBe(64);
    expect(TITLE_BPM).toBe(58);
  });

  it('旋律は作曲どおりに全部入っている', () => {
    const mel = events.filter((e) => e.kind === 'melody');
    expect(mel).toHaveLength(TITLE_MELODY.length);
    for (const [beat, midi] of TITLE_MELODY)
      expect(mel.some((e) => e.kind === 'melody' && e.beat === beat && e.midi === midi)).toBe(true);
  });

  it('ベース・和音・ブラシ・チッの数が構成どおり', () => {
    expect(events.filter((e) => e.kind === 'bass')).toHaveLength(32); // 8ブロック×4
    expect(events.filter((e) => e.kind === 'pad')).toHaveLength(124); // 4か所×（4音×7 + 3音×1）
    expect(events.filter((e) => e.kind === 'brush')).toHaveLength(16);
    expect(events.filter((e) => e.kind === 'tick')).toHaveLength(128);
  });
});
