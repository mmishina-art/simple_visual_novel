// 効果音は Web Audio で合成する（音声ファイルは持たない）。オン/オフ設定は必ず用意する。
import { load, save } from './storage';
import type { SceneSound } from './logic';

let ctx: AudioContext | undefined;
let enabled = load('sound', true);

export const isSoundOn = (): boolean => enabled;

export function setSound(on: boolean): void {
  enabled = on;
  save('sound', on);
  if (!on) stopBgmInternal(false);
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

/** 場面に合った音を合成して鳴らす（src/logic.ts の SceneSound と対応） */
export function playSceneSound(key: SceneSound): void {
  if (!enabled) return;
  try {
    ac();
    switch (key) {
      case 'rain': noise(1.8, 700, 0.05); break;
      case 'phone': tone(140, 0.09, 'square', 0.05); tone(140, 0.09, 'square', 0.05, 0.16); tone(140, 0.09, 'square', 0.05, 0.32); break;
      case 'steps': tone(82, 0.13, 'sine', 0.16); tone(76, 0.13, 'sine', 0.16, 0.38); break;
      case 'piano': tone(196, 1.4, 'triangle', 0.12); tone(98, 1.4, 'sine', 0.06); break;
      case 'chime': tone(392, 1.6, 'sine', 0.09); tone(784, 1.2, 'sine', 0.03); break;
      case 'knock': tone(120, 0.07, 'sine', 0.18); tone(120, 0.07, 'sine', 0.18, 0.28); tone(120, 0.07, 'sine', 0.18, 0.56); break;
      case 'door': tone(96, 0.5, 'sawtooth', 0.03, 0, 58); break;
      case 'thunder': noise(1.6, 180, 0.14); break;
      case 'whisper': noise(0.7, 2400, 0.035, 0, 'bandpass'); noise(0.5, 1800, 0.03, 0.5, 'bandpass'); break;
    }
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
    // コト：本を置くような、低い小さな音
    tone(145, 0.1, 'sine', 0.07, 0, 92);
    noise(0.04, 420, 0.032, 0, 'lowpass');
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
}

export type BgmTheme = 'horror' | 'romance' | 'mystery';

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
  // 推理もの（『消えた優勝杯』）：ドローンも風もない、乾いた音。鋸波の鈍いパッド、短く切れる単音、速めの和音の動きで、ホラーの「広い闇」と区別する
  mystery: {
    normal: {
      chords: [
        [110.0, 130.81, 164.81], // Am
        [110.0, 130.81, 164.81],
        [87.31, 110.0, 130.81, 174.61], // F
        [82.41, 103.83, 123.47, 164.81], // E
      ],
      bells: [220.0, 261.63, 329.63, 196.0],
      drone: [55, 82.41],
      chordSec: 7, bellChance: 0.22, bellGain: 0.05, wind: 0, padGain: 0.015,
      padWave: 'sawtooth', padCutoff: 480, droneGain: 0, bellWave: 'triangle', bellDecay: 0.55,
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
      chordSec: 7.5, bellChance: 0.4, bellGain: 0.042, wind: 0, padGain: 0.016,
      padWave: 'sawtooth', padCutoff: 700, droneGain: 0, bellWave: 'triangle', bellDecay: 0.9,
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
      chordSec: 9.5, bellChance: 0.14, bellGain: 0.05, wind: 0, padGain: 0.016,
      padWave: 'sawtooth', padCutoff: 430, droneGain: 0, bellWave: 'triangle', bellDecay: 0.5,
    },
  },
};

let bgmMood: BgmMood = 'normal';
let bgmTheme: BgmTheme = 'horror';

export function startBgm(mood?: BgmMood, theme?: BgmTheme): void {
  bgmWanted = true;
  const target = mood ?? bgmMood;
  const targetTheme = theme ?? bgmTheme;
  if (bgmNodes && target === bgmMood && targetTheme === bgmTheme) return;
  if (bgmNodes) stopBgmInternal(false);
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
  stopBgmInternal(true);
}

function stopBgmInternal(clearWanted: boolean): void {
  if (clearWanted) bgmWanted = false;
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
