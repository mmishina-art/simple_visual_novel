// 効果音は Web Audio で合成する（音声ファイルは持たない）。オン/オフ設定は必ず用意する。
import { load, save } from './storage';
import { TITLE_BPM, TITLE_LOOP_BEATS, buildTitleEvents, type TitleEvent } from './title-song';
import type { SceneSound } from './logic';

let ctx: AudioContext | undefined;
let enabled = load('sound', true);

export const isSoundOn = (): boolean => enabled;

export function setSound(on: boolean): void {
  enabled = on;
  save('sound', on);
  if (!on) stopBgmInternal(false);
  else if (titleWanted) startTitleBgm();
  else if (bgmWanted) startBgm();
}

function ac(): AudioContext {
  ctx ??= new AudioContext();
  // iPhone では操作のあとに resume が必要
  void ctx.resume();
  return ctx;
}

function tone(frequency: number, seconds: number, type: OscillatorType = 'sine', volume = 0.1, delay = 0, slideTo?: number): void {
  const c = ac();
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + seconds);
}

function noise(seconds: number, filterFrequency: number, volume = 0.06, delay = 0, type: BiquadFilterType = 'lowpass'): void {
  const c = ac();
  const t = c.currentTime + delay;
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFrequency;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + seconds);
}

export function beep(frequency = 660, seconds = 0.08): void {
  if (!enabled) return;
  try {
    tone(frequency, seconds, 'sine', 0.1);
    // テストが「どの音が鳴ったか」を確認できるようにイベントを出す
    document.dispatchEvent(new CustomEvent('app:sound', { detail: { frequency } }));
  } catch {
    // 音が出せなくても続行する
  }
}

/**
 * 場面に合った音の対応表（src/logic.ts の SceneSound と対応）。
 * 音の種類を足すときは、SceneSound への追加と、ここへの1行が要る（無いと型で落ちる）。
 */
const SCENE_SOUNDS: Record<SceneSound, () => void> = {
  rain: () => noise(1.8, 700, 0.05),
  phone: () => { tone(140, 0.09, 'square', 0.05); tone(140, 0.09, 'square', 0.05, 0.16); tone(140, 0.09, 'square', 0.05, 0.32); },
  steps: () => { tone(82, 0.13, 'sine', 0.16); tone(76, 0.13, 'sine', 0.16, 0.38); },
  piano: () => { tone(196, 1.4, 'triangle', 0.12); tone(98, 1.4, 'sine', 0.06); },
  chime: () => { tone(392, 1.6, 'sine', 0.09); tone(784, 1.2, 'sine', 0.03); },
  knock: () => { tone(120, 0.07, 'sine', 0.18); tone(120, 0.07, 'sine', 0.18, 0.28); tone(120, 0.07, 'sine', 0.18, 0.56); },
  door: () => tone(96, 0.5, 'sawtooth', 0.03, 0, 58),
  thunder: () => noise(1.6, 180, 0.14),
  whisper: () => { noise(0.7, 2400, 0.035, 0, 'bandpass'); noise(0.5, 1800, 0.03, 0.5, 'bandpass'); },
  beep: () => { tone(880, 0.07, 'square', 0.03); tone(880, 0.07, 'square', 0.03, 0.13); tone(1320, 0.09, 'square', 0.025, 0.26); },
  bell: () => { tone(1568, 0.5, 'triangle', 0.045); tone(2093, 0.35, 'sine', 0.02); },
};

/** 場面に合った音を合成して鳴らす */
export function playSceneSound(key: SceneSound): void {
  if (!enabled) return;
  try {
    ac();
    SCENE_SOUNDS[key]();
    document.dispatchEvent(new CustomEvent('app:sound', { detail: { key } }));
  } catch {
    // 音が出せなくても続行する
  }
}

/**
 * ボタンを押したときの音。全体の静かな雰囲気に合わせ、
 * 木を軽く打つような、短く小さな音にする
 */
export function playButtonSound(): void {
  if (!enabled) return;
  try {
    noise(0.05, 750, 0.05, 0, 'bandpass');
    tone(392, 0.07, 'sine', 0.035);
    document.dispatchEvent(new CustomEvent('app:sound', { detail: { ui: 'button' } }));
  } catch {
    // 音が出せなくても続行する
  }
}

/** 本を開く音。本棚で本を選んだ瞬間に、全冊共通で鳴らす。「コト→パラ」の短い音 */
export function playBookOpenSound(): void {
  if (!enabled) return;
  try {
    // コト：本を置くような乾いた打音。響くサイン波は使わない（「ポーン」と聞こえるため）
    noise(0.035, 360, 0.055, 0, 'lowpass');
    tone(118, 0.04, 'sine', 0.022, 0, 84);
    // パラ：ページが開いて落ち着く、短い紙の音
    noise(0.05, 2000, 0.05, 0.15, 'bandpass');
    noise(0.06, 1500, 0.055, 0.22, 'bandpass');
    noise(0.1, 950, 0.04, 0.3, 'bandpass');
    document.dispatchEvent(new CustomEvent('app:sound', { detail: { ui: 'book' } }));
  } catch {
    // 音が出せなくても続行する
  }
}

/** 文章を進める操作の音（紙をめくるような、短く柔らかい音） */
export function playAdvanceSound(): void {
  if (!enabled) return;
  try {
    noise(0.07, 1100, 0.055, 0, 'bandpass');
    noise(0.09, 480, 0.04, 0.045, 'bandpass');
    document.dispatchEvent(new CustomEvent('app:sound', { detail: { ui: 'advance' } }));
  } catch {
    // 音が出せなくても続行する
  }
}

// ---- BGM：夜の校舎をイメージした、生成型のアンビエント ----
// 低いドローン＋ゆっくり移ろう短調のパッド＋まばらなピアノの単音＋風のノイズを合成する。
// 音声ファイルは持たず、開始操作（ユーザーのタップ）を起点に鳴らす。

let bgmWanted = false;
let titleWanted = false;
let bgmKind: 'story' | 'title' | undefined;
let bgmNodes: { master: GainNode; timer: ReturnType<typeof setInterval>; sources: OscillatorNode[] } | undefined;

export type BgmMood = 'normal' | 'happy' | 'bad';

interface BgmConfig {
  chords: number[][];
  bells: number[];
  drone: number[];
  chordSec: number;
  bellChance: number;
  bellGain: number;
  wind: number;
  padGain: number;
  /** ドローンの音量（恋愛ものは弱く、ホラーは標準） */
  droneGain?: number;
  /** パッドの波形（恋愛ものは柔らかいサイン波） */
  padWave?: OscillatorType;
  /** パッドのローパス（推理ものは低く鈍く、恋愛ものは高く明るく） */
  padCutoff?: number;
  /** 単音の余韻の長さ（秒） */
  bellDecay?: number;
  /** 単音の波形（推理ものは乾いた三角波の短い音） */
  bellWave?: OscillatorType;
  /** 推理もの用：持続するパッドではなく、打って消える和音にする */
  stab?: boolean;
  /** stab の余韻の長さ（秒） */
  stabDecay?: number;
}

export type BgmTheme = 'horror' | 'romance' | 'mystery' | 'sf' | 'comedy' | 'literary' | 'tavern' | 'sensual';

const BGM_THEMES: Record<BgmTheme, Record<BgmMood, BgmConfig>> = {
  // ホラー（『午前0時の校舎』）：夜の校舎。短調のパッドと、まばらなピアノ、風の音
  horror: {
    normal: {
      chords: [
        [110.0, 164.81, 246.94, 261.63],
        [87.31, 130.81, 220.0, 329.63],
        [130.81, 196.0, 246.94, 392.0],
        [98.0, 146.83, 246.94, 293.66],
      ],
      bells: [440.0, 523.25, 587.33, 659.25, 783.99, 880.0],
      drone: [55, 110.4],
      chordSec: 9, bellChance: 0.28, bellGain: 0.045, wind: 0.007, padGain: 0.014,
    },
    happy: {
      chords: [
        [87.31, 130.81, 220.0, 261.63],
        [130.81, 196.0, 329.63, 392.0],
        [110.0, 164.81, 261.63, 329.63],
        [98.0, 146.83, 246.94, 392.0],
      ],
      bells: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],
      drone: [65.41, 130.81],
      chordSec: 8, bellChance: 0.5, bellGain: 0.04, wind: 0.004, padGain: 0.015,
    },
    bad: {
      chords: [
        [110.0, 130.81, 164.81],
        [103.83, 123.47, 146.83],
        [98.0, 116.54, 139.69],
        [110.0, 130.81, 155.56],
      ],
      bells: [220.0, 233.08, 110.0, 116.54],
      drone: [55, 58.27],
      chordSec: 12, bellChance: 0.16, bellGain: 0.05, wind: 0.012, padGain: 0.016,
    },
  },
  // 恋愛もの（『月夜の図書室』）：温かい長調。風はほぼなし、単音は柔らかく高く
  romance: {
    normal: {
      chords: [
        [130.81, 196.0, 246.94, 329.63], // Cmaj7
        [110.0, 164.81, 261.63, 392.0], // Am7
        [87.31, 130.81, 220.0, 349.23], // Fmaj7
        [98.0, 146.83, 246.94, 293.66], // G(add9)
      ],
      bells: [523.25, 659.25, 783.99, 880.0, 1046.5],
      drone: [65.41, 98.0],
      chordSec: 10, bellChance: 0.38, bellGain: 0.032, wind: 0.0015, padGain: 0.016,
      droneGain: 0.012, padWave: 'sine', padCutoff: 1300, bellDecay: 4.2,
    },
    happy: {
      chords: [
        [87.31, 130.81, 220.0, 349.23],
        [130.81, 196.0, 293.66, 329.63],
        [98.0, 146.83, 246.94, 392.0],
        [130.81, 196.0, 246.94, 329.63],
      ],
      bells: [659.25, 783.99, 880.0, 1046.5, 1318.5],
      drone: [65.41, 130.81],
      chordSec: 9, bellChance: 0.55, bellGain: 0.034, wind: 0.001, padGain: 0.017,
      droneGain: 0.012, padWave: 'sine', padCutoff: 1400, bellDecay: 4.2,
    },
    bad: {
      chords: [
        [110.0, 164.81, 261.63, 329.63], // Am7
        [87.31, 130.81, 220.0, 261.63], // Fmaj7
        [130.81, 196.0, 246.94, 329.63], // Cmaj7
        [82.41, 123.47, 196.0, 293.66], // Em7
      ],
      bells: [392.0, 440.0, 523.25, 587.33],
      drone: [55, 82.41],
      chordSec: 11, bellChance: 0.22, bellGain: 0.03, wind: 0.003, padGain: 0.015,
      droneGain: 0.014, padWave: 'sine', padCutoff: 1100, bellDecay: 4.6,
    },
  },
  // 推理もの（『消えた優勝杯』）：ドローンも風も持続音もない。乾いた和音を打っては消し、無音を挟む。短く切れる単音と合わせて、ホラーの「広い闇」と区別する
  mystery: {
    normal: {
      chords: [
        [110.0, 220.0, 261.63, 329.63], // Am（高めに開く）
        [174.61, 220.0, 261.63, 349.23], // F
        [130.81, 196.0, 261.63, 392.0], // C（長調で少し軽く）
        [164.81, 207.65, 246.94, 329.63], // E（最後に緊張を戻す）
      ],
      bells: [329.63, 392.0, 440.0, 523.25],
      drone: [55, 82.41],
      chordSec: 5.5, bellChance: 0.28, bellGain: 0.05, wind: 0, padGain: 0.015,
      padWave: 'triangle', padCutoff: 1600, droneGain: 0, bellWave: 'triangle', bellDecay: 0.8,
      stab: true, stabDecay: 1.7,
    },
    happy: {
      chords: [
        [130.81, 196.0, 246.94, 329.63],
        [87.31, 130.81, 220.0, 261.63],
        [110.0, 164.81, 261.63, 329.63],
        [98.0, 146.83, 246.94, 392.0],
      ],
      bells: [440.0, 523.25, 659.25, 783.99],
      drone: [65.41, 98.0],
      chordSec: 6, bellChance: 0.4, bellGain: 0.042, wind: 0, padGain: 0.016,
      padWave: 'triangle', padCutoff: 1700, droneGain: 0, bellWave: 'triangle', bellDecay: 0.9,
      stab: true, stabDecay: 2.1,
    },
    bad: {
      chords: [
        [110.0, 130.81, 164.81],
        [123.47, 146.83, 174.61],
        [103.83, 130.81, 155.56],
        [110.0, 116.54, 164.81],
      ],
      bells: [110.0, 116.54, 220.0],
      drone: [55, 58.27],
      chordSec: 7, bellChance: 0.14, bellGain: 0.05, wind: 0, padGain: 0.016,
      padWave: 'triangle', padCutoff: 1000, droneGain: 0, bellWave: 'triangle', bellDecay: 0.5,
      stab: true, stabDecay: 1.4,
    },
  },
  // SF（『星屑ステーション』）：無重力に漂う音。サイン波の浮遊する和音と、遠くの信号のような高い単音
  sf: {
    normal: {
      chords: [
        [110.0, 220.0, 246.94, 329.63],
        [87.31, 174.61, 261.63, 392.0],
        [130.81, 196.0, 293.66, 493.88],
        [98.0, 196.0, 293.66, 349.23],
      ],
      bells: [880.0, 1174.66, 1318.5, 1760.0],
      drone: [220.0, 220.4],
      chordSec: 11, bellChance: 0.16, bellGain: 0.03, wind: 0, padGain: 0.014,
      padWave: 'sine', padCutoff: 2200, droneGain: 0.008, bellDecay: 5,
    },
    happy: {
      chords: [
        [130.81, 196.0, 293.66, 493.88],
        [87.31, 174.61, 261.63, 392.0],
        [110.0, 220.0, 261.63, 493.88],
        [98.0, 196.0, 293.66, 392.0],
      ],
      bells: [1174.66, 1318.5, 1760.0, 2349.32],
      drone: [196.0, 196.3],
      chordSec: 10, bellChance: 0.3, bellGain: 0.03, wind: 0, padGain: 0.015,
      padWave: 'sine', padCutoff: 2400, droneGain: 0.008, bellDecay: 5,
    },
    bad: {
      chords: [
        [110.0, 220.0, 261.63],
        [103.83, 207.65, 311.13],
        [87.31, 174.61, 207.65],
        [110.0, 220.0, 261.63],
      ],
      bells: [440.0, 415.3],
      drone: [110.0, 110.5],
      chordSec: 13, bellChance: 0.1, bellGain: 0.032, wind: 0, padGain: 0.014,
      padWave: 'sine', padCutoff: 1200, droneGain: 0.01, bellDecay: 5.5,
    },
  },
  // コメディ（『喫茶つばめの災難』）：軽快で跳ねる音。短く打つ長調の和音と、転がるような単音
  comedy: {
    normal: {
      chords: [
        [130.81, 164.81, 196.0, 261.63],
        [87.31, 174.61, 220.0, 261.63],
        [130.81, 164.81, 196.0, 261.63],
        [98.0, 196.0, 246.94, 293.66],
      ],
      bells: [523.25, 587.33, 659.25, 783.99],
      drone: [65.41, 98.0],
      chordSec: 4.5, bellChance: 0.5, bellGain: 0.045, wind: 0, padGain: 0.014,
      padWave: 'triangle', padCutoff: 1800, droneGain: 0, bellWave: 'triangle', bellDecay: 0.7,
      stab: true, stabDecay: 0.8,
    },
    happy: {
      chords: [
        [130.81, 164.81, 196.0, 261.63],
        [98.0, 196.0, 246.94, 293.66],
        [110.0, 164.81, 220.0, 329.63],
        [87.31, 174.61, 220.0, 349.23],
      ],
      bells: [659.25, 783.99, 880.0, 1046.5],
      drone: [65.41, 98.0],
      chordSec: 4, bellChance: 0.6, bellGain: 0.045, wind: 0, padGain: 0.015,
      padWave: 'triangle', padCutoff: 2000, droneGain: 0, bellWave: 'triangle', bellDecay: 0.8,
      stab: true, stabDecay: 0.9,
    },
    bad: {
      chords: [
        [110.0, 164.81, 220.0, 261.63],
        [87.31, 174.61, 220.0, 261.63],
        [146.83, 174.61, 220.0, 293.66],
        [82.41, 164.81, 207.65, 246.94],
      ],
      bells: [392.0, 440.0, 523.25],
      drone: [55, 82.41],
      chordSec: 5.5, bellChance: 0.3, bellGain: 0.04, wind: 0, padGain: 0.014,
      padWave: 'triangle', padCutoff: 1400, droneGain: 0, bellWave: 'triangle', bellDecay: 0.9,
      stab: true, stabDecay: 1.1,
    },
  },
  // 純文学（『日曜日、井戸の底で』）：静かな午後。柔らかい和音がゆっくり移ろい、単音はまばら
  literary: {
    normal: {
      chords: [
        [87.31, 130.81, 220.0, 329.63], // Fmaj7
        [82.41, 123.47, 196.0, 293.66], // Em7
        [65.41, 130.81, 246.94, 293.66], // Cmaj9
        [110.0, 164.81, 246.94, 261.63], // Am9
      ],
      bells: [523.25, 587.33, 659.25, 783.99],
      drone: [43.65, 87.31],
      chordSec: 11, bellChance: 0.3, bellGain: 0.028, wind: 0.001, padGain: 0.014,
      droneGain: 0.008, padWave: 'sine', padCutoff: 1100, bellDecay: 5.0,
    },
    happy: {
      chords: [
        [65.41, 130.81, 246.94, 329.63], // Cmaj9
        [87.31, 130.81, 220.0, 349.23], // Fmaj7
        [98.0, 146.83, 246.94, 392.0], // G(add9)
        [110.0, 164.81, 261.63, 392.0], // Am7
      ],
      bells: [659.25, 783.99, 880.0, 1046.5],
      drone: [65.41, 98.0],
      chordSec: 10, bellChance: 0.42, bellGain: 0.03, wind: 0.001, padGain: 0.015,
      droneGain: 0.009, padWave: 'sine', padCutoff: 1300, bellDecay: 5.0,
    },
    bad: {
      chords: [
        [110.0, 164.81, 261.63], // Am
        [87.31, 130.81, 220.0], // F
        [98.0, 146.83, 196.0], // G
        [103.83, 155.56, 233.08], // G#
      ],
      bells: [329.63, 392.0, 440.0],
      drone: [55, 82.41],
      chordSec: 13, bellChance: 0.18, bellGain: 0.03, wind: 0.002, padGain: 0.015,
      droneGain: 0.01, padWave: 'sine', padCutoff: 800, bellDecay: 5.5,
    },
  },
  // 異世界食堂（『魔王のいない国の食堂』）：温かい木の店内。フォーク調の和音と、弾くような単音
  tavern: {
    normal: {
      chords: [
        [98.0, 146.83, 246.94, 293.66], // G(add9)
        [130.81, 196.0, 329.63, 392.0], // C
        [82.41, 164.81, 246.94, 392.0], // Em
        [73.42, 146.83, 220.0, 293.66], // D
      ],
      bells: [587.33, 659.25, 783.99, 880.0, 987.77, 1174.66],
      drone: [49.0, 98.0],
      chordSec: 8, bellChance: 0.5, bellGain: 0.03, wind: 0.002, padGain: 0.014,
      droneGain: 0.01, padWave: 'triangle', padCutoff: 950, bellWave: 'triangle', bellDecay: 1.8,
    },
    happy: {
      chords: [
        [98.0, 196.0, 293.66, 392.0], // G
        [130.81, 196.0, 329.63, 392.0], // C
        [110.0, 220.0, 329.63, 440.0], // Am
        [146.83, 220.0, 293.66, 369.99], // D7
      ],
      bells: [659.25, 783.99, 880.0, 987.77, 1174.66, 1318.51],
      drone: [49.0, 98.0],
      chordSec: 8, bellChance: 0.6, bellGain: 0.03, wind: 0.0015, padGain: 0.015,
      droneGain: 0.01, padWave: 'triangle', padCutoff: 1100, bellWave: 'triangle', bellDecay: 1.8,
    },
    bad: {
      chords: [
        [82.41, 164.81, 246.94], // Em
        [110.0, 164.81, 220.0], // Am
        [61.74, 123.47, 196.0], // B
        [82.41, 146.83, 196.0], // Em(add)
      ],
      bells: [329.63, 392.0, 493.88],
      drone: [41.2, 82.41],
      chordSec: 11, bellChance: 0.2, bellGain: 0.028, wind: 0.003, padGain: 0.014,
      droneGain: 0.011, padWave: 'triangle', padCutoff: 700, bellWave: 'triangle', bellDecay: 2.6,
    },
  },
  // 官能（『指先の温度』）：雨の夜の古書店。低く暖かい和音がゆっくり移ろい、単音は儚く
  sensual: {
    normal: {
      chords: [
        [87.31, 130.81, 174.61, 261.63], // Fmaj7（低め）
        [73.42, 110.0, 146.83, 220.0], // Dm7
        [58.27, 116.54, 174.61, 233.08], // Bbmaj7
        [65.41, 98.0, 196.0, 246.94], // C(add9)
      ],
      bells: [523.25, 587.33, 698.46, 783.99],
      drone: [43.65, 65.41],
      chordSec: 12, bellChance: 0.26, bellGain: 0.026, wind: 0.0012, padGain: 0.015,
      droneGain: 0.01, padWave: 'sine', padCutoff: 900, bellDecay: 6.0,
    },
    happy: {
      chords: [
        [87.31, 130.81, 220.0, 261.63], // Fmaj7
        [98.0, 146.83, 196.0, 293.66], // G7sus 的な広がり
        [110.0, 164.81, 220.0, 329.63], // Am7
        [65.41, 130.81, 196.0, 329.63], // C
      ],
      bells: [587.33, 698.46, 783.99, 880.0],
      drone: [43.65, 87.31],
      chordSec: 11, bellChance: 0.34, bellGain: 0.027, wind: 0.001, padGain: 0.015,
      droneGain: 0.009, padWave: 'sine', padCutoff: 1100, bellDecay: 6.0,
    },
    bad: {
      chords: [
        [73.42, 110.0, 146.83], // Dm
        [69.3, 110.0, 138.59], // Dm(b5) 的な翳り
        [65.41, 103.83, 155.56], // Cm の翳り
        [73.42, 110.0, 174.61], // Dm
      ],
      bells: [293.66, 349.23, 440.0],
      drone: [36.71, 73.42],
      chordSec: 14, bellChance: 0.14, bellGain: 0.026, wind: 0.002, padGain: 0.015,
      droneGain: 0.011, padWave: 'sine', padCutoff: 650, bellDecay: 6.5,
    },
  },
};

let bgmMood: BgmMood = 'normal';
let bgmTheme: BgmTheme = 'horror';

export function startBgm(mood?: BgmMood, theme?: BgmTheme): void {
  bgmWanted = true;
  titleWanted = false;
  const target = mood ?? bgmMood;
  const targetTheme = theme ?? bgmTheme;
  if (bgmNodes && bgmKind === 'story' && target === bgmMood && targetTheme === bgmTheme) return;
  if (bgmNodes) stopBgmInternal(false);
  bgmKind = 'story';
  bgmMood = target;
  bgmTheme = targetTheme;
  if (!enabled) return;
  const cfg = BGM_THEMES[bgmTheme][bgmMood];
  try {
    const c = ac();
    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(0.9, c.currentTime + 2.5);
    // 空間感のための簡易エコー
    const delay = c.createDelay(1);
    delay.delayTime.value = 0.42;
    const feedback = c.createGain();
    feedback.gain.value = 0.34;
    const echoGain = c.createGain();
    echoGain.gain.value = 0.3;
    delay.connect(feedback).connect(delay);
    delay.connect(echoGain).connect(master);
    master.connect(c.destination);

    const sources: OscillatorNode[] = [];
    // ドローン（低い持続音）
    const droneFilter = c.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 240;
    const droneGain = c.createGain();
    droneGain.gain.value = cfg.droneGain ?? 0.038;
    droneFilter.connect(droneGain).connect(master);
    for (const f of cfg.drone) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(droneFilter);
      o.start();
      sources.push(o);
    }
    // 風のノイズ（ループ＋ゆっくりうねる音量）
    const noiseBuffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const wind = c.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = c.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 460;
    windFilter.Q.value = 0.5;
    const windGain = c.createGain();
    windGain.gain.value = cfg.wind;
    const windLfo = c.createOscillator();
    windLfo.frequency.value = 0.06;
    const windLfoGain = c.createGain();
    windLfoGain.gain.value = cfg.wind * 0.6;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
    windLfo.start();
    sources.push(windLfo);

    // パッドの和音と、まばらなピアノの単音を定期的に差し込む
    let chordIndex = 0;
    let nextChordAt = c.currentTime + 0.1;
    const playChord = (at: number): void => {
      const chord = cfg.chords[chordIndex % cfg.chords.length];
      chordIndex += 1;
      if (cfg.stab) {
        // 推理もの：ピアノを打つように和音を鳴らし、余韻を残して消す（持続させない）
        const dec = cfg.stabDecay ?? 1.5;
        for (const f of chord) {
          const o = c.createOscillator();
          o.type = cfg.padWave ?? 'triangle';
          o.frequency.value = f;
          const g = c.createGain();
          g.gain.setValueAtTime(cfg.padGain * 2.6, at);
          g.gain.exponentialRampToValueAtTime(0.0001, at + dec);
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = cfg.padCutoff ?? 850;
          o.connect(lp).connect(g).connect(master);
          o.start(at);
          o.stop(at + dec + 0.1);
        }
        return;
      }
      for (const f of chord) {
        for (const detune of [-4, 4]) {
          const o = c.createOscillator();
          o.type = cfg.padWave ?? 'triangle';
          o.frequency.value = f;
          o.detune.value = detune;
          const g = c.createGain();
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(cfg.padGain, at + cfg.chordSec * 0.35);
          g.gain.setValueAtTime(cfg.padGain, at + cfg.chordSec * 0.7);
          g.gain.linearRampToValueAtTime(0, at + cfg.chordSec * 1.15);
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = cfg.padCutoff ?? 850;
          o.connect(lp).connect(g).connect(master);
          o.start(at);
          o.stop(at + cfg.chordSec * 1.2);
        }
      }
    };
    const decay = cfg.bellDecay ?? 2.8;
    const playBell = (at: number): void => {
      const f = cfg.bells[Math.floor(Math.random() * cfg.bells.length)];
      const o = c.createOscillator();
      o.type = cfg.bellWave ?? 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(cfg.bellGain, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      o.connect(g).connect(master);
      g.connect(delay);
      o.start(at);
      o.stop(at + decay + 0.3);
    };
    const timer = setInterval(() => {
      const now = c.currentTime;
      if (now >= nextChordAt) {
        playChord(nextChordAt);
        nextChordAt += cfg.chordSec;
      }
      if (Math.random() < cfg.bellChance) playBell(now + 0.05);
    }, 1200);

    bgmNodes = { master, timer, sources };
    document.body.dataset.bgm = 'on';
    document.body.dataset.bgmMood = bgmMood;
    document.body.dataset.bgmTheme = bgmTheme;
    document.dispatchEvent(new CustomEvent('app:bgm', { detail: { on: true } }));
  } catch {
    // 音が出せなくても続行する
  }
}

/**
 * 結末パネルが出る瞬間の音。どちらも全体の静かな雰囲気に合わせ、
 * 小さな音量で余韻を長く残す。
 * バッド：遠くの低い鐘のような音と、半音の薄いうなりがゆっくり消える。
 * ハッピー：夜明けのオルゴールのように、柔らかい音が間を置いて昇っていく。
 */
export function playEndingJingle(kind: 'happy' | 'bad'): void {
  if (!enabled) return;
  try {
    if (kind === 'bad') {
      // 低い鐘。打ち始めをはっきりさせ、倍音を足して輪郭を出す。
      // 余韻は長く、少し遅れて半音のうなりと、弱い2打目が重なる
      noise(0.06, 900, 0.05, 0, 'bandpass');
      tone(98, 5.5, 'sine', 0.22);
      tone(196, 4.5, 'sine', 0.08);
      tone(297, 3.0, 'sine', 0.05);
      tone(392, 2.0, 'sine', 0.028);
      tone(116.54, 4.5, 'sine', 0.05, 0.5);
      tone(98, 4.0, 'sine', 0.1, 2.2);
      tone(196, 3.0, 'sine', 0.032, 2.2);
      noise(3.0, 240, 0.04);
    } else {
      // オルゴール風：小さな音を間を置いて昇らせ、最後の音に薄い残響を添える
      tone(261.63, 3.4, 'triangle', 0.028);
      tone(523.25, 2.8, 'sine', 0.05, 0);
      tone(1046.5, 2.2, 'sine', 0.012, 0);
      tone(659.25, 2.8, 'sine', 0.05, 0.24);
      tone(1318.5, 2.2, 'sine', 0.012, 0.24);
      tone(783.99, 3.2, 'sine', 0.05, 0.48);
      tone(1568, 2.4, 'sine', 0.01, 0.48);
      tone(1046.5, 3.8, 'sine', 0.045, 0.78);
      tone(1046.5, 2.4, 'sine', 0.016, 1.3);
    }
    document.dispatchEvent(new CustomEvent('app:sound', { detail: { ui: `ending-${kind}` } }));
  } catch {
    // 音が出せなくても続行する
  }
}

export function stopBgm(): void {
  titleWanted = false;
  stopBgmInternal(true);
}

/** バックグラウンドに移ったときに、音の出口そのものを止める（取りこぼし防止） */
export function suspendAudioContext(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
}

/** フォアグラウンドに戻ったときに、音の出口を再開する */
export function resumeAudioContext(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

function stopBgmInternal(clearWanted: boolean): void {
  if (clearWanted) bgmWanted = false;
  bgmKind = undefined;
  if (!bgmNodes) {
    document.body.dataset.bgm = 'off';
    delete document.body.dataset.bgmMood;
    delete document.body.dataset.bgmTheme;
    return;
  }
  const { master, timer, sources } = bgmNodes;
  bgmNodes = undefined;
  try {
    clearInterval(timer);
    const c = ac();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime);
    master.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
    for (const o of sources) {
      try { o.stop(c.currentTime + 0.9); } catch { /* 停止済み */ }
    }
    setTimeout(() => master.disconnect(), 1000);
  } catch {
    // 音が出せなくても続行する
  }
  document.body.dataset.bgm = 'off';
  delete document.body.dataset.bgmMood;
  delete document.body.dataset.bgmTheme;
  document.dispatchEvent(new CustomEvent('app:bgm', { detail: { on: false } }));
}

// ---- タイトルBGM：固定の作曲（src/title-song.ts）を再生する ----
// 物語のBGM（生成型）とは別に、タイトル・本棚・設定の画面で流す。
// 音の作りは、やわらかいピアノ＋静かなベース＋ブラシ＋ライド風のチッ。
// 全体にローパスをかけて角を取り、ビブラートやトレモロは使わない。

const midiFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

function titlePiano(c: AudioContext, dest: AudioNode, midi: number, at: number, durSec: number, gain: number, pan: number): void {
  const f = midiFreq(midi);
  const panner = c.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(dest);
  const harm = (mult: number, peak: number, tau: number): void => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.014);
    g.gain.setTargetAtTime(0, at + 0.014, tau);
    o.connect(g).connect(panner);
    o.start(at);
    o.stop(at + durSec + 1.6);
  };
  harm(1, gain, 0.69);
  harm(2, gain * 0.3, 0.22);
  harm(3, gain * 0.09, 0.125);
}

function titleBass(c: AudioContext, dest: AudioNode, midi: number, at: number, durSec: number, gain: number): void {
  const f = midiFreq(midi);
  const harm = (mult: number, peak: number, tau: number): void => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * mult;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.011);
    g.gain.setTargetAtTime(0, at + 0.011, tau);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + durSec + 1.4);
  };
  harm(1, gain, 1.0);
  harm(2, gain * 0.13, 0.33);
}

function titleBrush(c: AudioContext, dest: AudioNode, noiseBuf: AudioBuffer, at: number, durSec: number, gain: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 750;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.6);
  g.gain.setTargetAtTime(0, at + 0.6, 0.5);
  src.connect(lp).connect(g).connect(dest);
  src.start(at, Math.random() * 1.2);
  src.stop(at + durSec + 1.0);
}

function titleTick(c: AudioContext, dest: AudioNode, noiseBuf: AudioBuffer, at: number, gain: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5200;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  src.connect(hp).connect(g).connect(dest);
  src.start(at, Math.random() * 1.5);
  src.stop(at + 0.08);
}

export function startTitleBgm(): void {
  titleWanted = true;
  if (bgmNodes && bgmKind === 'title') return;
  if (bgmNodes) stopBgmInternal(false);
  bgmKind = 'title';
  bgmWanted = false;
  if (!enabled) return;
  try {
    const c = ac();
    const master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(0.9, c.currentTime + 2.5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4800;
    lp.Q.value = 0.3;
    master.connect(lp).connect(c.destination);

    const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const events = buildTitleEvents();
    const beatSec = 60 / TITLE_BPM;
    let idx = 0;
    let loopStart = c.currentTime + 0.15;
    const schedule = (ev: TitleEvent, at: number): void => {
      if (ev.kind === 'bass') titleBass(c, master, ev.midi, at, ev.durBeats * beatSec, ev.gain);
      else if (ev.kind === 'pad') titlePiano(c, master, ev.midi, at + ev.staggerSec, 3.2, ev.gain, -0.03);
      else if (ev.kind === 'melody') titlePiano(c, master, ev.midi, at, Math.max(2.0, ev.lenBeats * beatSec * 1.05), ev.gain, 0.05);
      else if (ev.kind === 'brush') titleBrush(c, master, noiseBuf, at, ev.durBeats * beatSec, ev.gain);
      else titleTick(c, master, noiseBuf, at, ev.gain);
    };
    const timer = setInterval(() => {
      if (c.state === 'suspended') void c.resume();
      const horizon = c.currentTime + 0.9;
      for (;;) {
        const ev = events[idx];
        const at = loopStart + ev.beat * beatSec;
        if (at > horizon) break;
        if (at >= c.currentTime - 0.3) schedule(ev, at);
        idx += 1;
        if (idx >= events.length) {
          idx = 0;
          loopStart += TITLE_LOOP_BEATS * beatSec;
        }
      }
    }, 300);

    bgmNodes = { master, timer, sources: [] };
    document.body.dataset.bgm = 'on';
    document.body.dataset.bgmTheme = 'title';
    delete document.body.dataset.bgmMood;
    document.dispatchEvent(new CustomEvent('app:bgm', { detail: { on: true } }));
  } catch {
    // 音が出せなくても続行する
  }
}

export function stopTitleBgm(): void {
  titleWanted = false;
  if (bgmKind === 'title') stopBgmInternal(false);
}
