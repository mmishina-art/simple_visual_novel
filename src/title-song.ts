/**
 * タイトル画面のBGM（完全新作のジャズバラード）。
 * 物語のBGMが生成型なのに対し、こちらは固定の作曲をそのまま再生する。
 * 曲データとイベント展開だけを持つ純粋なモジュール（再生は src/sound.ts）。
 *
 * 構成：8つのコード（各2小節）のループ、全64拍、BPM 58。
 * ビブラート・トレモロ・スウィングは使わず、まっすぐで柔らかいピアノを中心にする。
 */

export const TITLE_BPM = 58;
export const TITLE_LOOP_BEATS = 64;

/** コード進行（bass=ルートのMIDI、fifth=5度、pad=和音の構成音） */
export const TITLE_BLOCKS: { bass: number; fifth: number; pad: number[] }[] = [
  { bass: 41, fifth: 48, pad: [57, 60, 64, 67] }, // Fmaj9
  { bass: 40, fifth: 47, pad: [55, 59, 62, 66] }, // Em9
  { bass: 38, fifth: 45, pad: [53, 57, 60, 64] }, // Dm9
  { bass: 48, fifth: 43, pad: [52, 55, 59, 62] }, // Cmaj9
  { bass: 41, fifth: 48, pad: [57, 60, 64, 67] }, // Fmaj9
  { bass: 40, fifth: 47, pad: [55, 59, 62, 66] }, // Em9
  { bass: 38, fifth: 45, pad: [53, 57, 60, 64] }, // Dm9
  { bass: 43, fifth: 50, pad: [53, 59, 64] }, //     G13
];

/** 旋律：[始まる拍, MIDI, 長さ（拍）] */
export const TITLE_MELODY: [number, number, number][] = [
  [0, 69, 3], [3.5, 67, 2], [6, 65, 2], [8, 64, 4], [12, 66, 2], [14, 67, 2],
  [16, 69, 4], [20, 65, 3], [23, 64, 1], [24, 62, 6], [30, 59, 2], [32, 72, 4],
  [36, 69, 3], [39, 67, 1], [40, 66, 4], [44, 64, 4], [48, 65, 3], [51, 69, 3],
  [54, 67, 2], [56, 65, 4], [60, 62, 4],
];

export type TitleEvent =
  | { kind: 'bass'; beat: number; midi: number; durBeats: number; gain: number }
  | { kind: 'pad'; beat: number; midi: number; staggerSec: number; gain: number }
  | { kind: 'melody'; beat: number; midi: number; lenBeats: number; gain: number }
  | { kind: 'brush'; beat: number; durBeats: number; gain: number }
  | { kind: 'tick'; beat: number; gain: number };

/** 曲データを、再生しやすいイベント列（拍順）に展開する */
export function buildTitleEvents(): TitleEvent[] {
  const events: TitleEvent[] = [];
  TITLE_BLOCKS.forEach((c, bi) => {
    const start = bi * 8;
    // ベース：ルート→5度→ルート（高）→オクターブ、と静かに歩く
    events.push({ kind: 'bass', beat: start, midi: c.bass, durBeats: 2.0, gain: 0.088 });
    events.push({ kind: 'bass', beat: start + 2, midi: c.fifth, durBeats: 1.8, gain: 0.067 });
    events.push({ kind: 'bass', beat: start + 4, midi: c.bass + 7 <= 52 ? c.bass + 7 : c.bass, durBeats: 1.8, gain: 0.062 });
    events.push({ kind: 'bass', beat: start + 7, midi: c.bass + 12, durBeats: 1.0, gain: 0.056 });
    // 和音：4か所で柔らかく打つ。構成音は少しずつずらして重ねる
    for (const off of [0, 2.5, 4, 6.5])
      c.pad.forEach((midi, i) => events.push({ kind: 'pad', beat: start + off, midi, staggerSec: i * 0.015, gain: 0.021 }));
    // ライド風の小さなチッ（半拍ごと）
    for (let b = 0; b < 16; b++)
      events.push({ kind: 'tick', beat: start + b * 0.5, gain: b % 2 ? 0.009 : 0.014 });
    // ブラシのスワール
    events.push({ kind: 'brush', beat: start + 1, durBeats: 1.8, gain: 0.045 });
    events.push({ kind: 'brush', beat: start + 7, durBeats: 1.8, gain: 0.045 });
  });
  for (const [beat, midi, lenBeats] of TITLE_MELODY)
    events.push({ kind: 'melody', beat, midi, lenBeats, gain: 0.062 });
  return events.sort((a, b) => a.beat - b.beat);
}
