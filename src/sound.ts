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
}

const BGM_MOODS: Record<BgmMood, BgmConfig> = {
  // 通常：夜の校舎。短調のパッドと、まばらなピアノ
  normal: {
    chords: [
      [110.0, 164.81, 246.94, 261.63], // Am(add9)
      [87.31, 130.81, 220.0, 329.63], // Fmaj7
      [130.81, 196.0, 246.94, 392.0], // Cmaj7
      [98.0, 146.83, 246.94, 293.66], // G(add9)寄り
    ],
    bells: [440.0, 523.25, 587.33, 659.25, 783.99, 880.0],
    drone: [55, 110.4],
    chordSec: 9, bellChance: 0.28, bellGain: 0.045, wind: 0.007, padGain: 0.014,
  },
  // ハッピーエンド：夜明け。長調に転じ、単音は高く明るく、風は弱まる
  happy: {
    chords: [
      [87.31, 130.81, 220.0, 261.63], // Fmaj7
      [130.81, 196.0, 329.63, 392.0], // Cmaj7
      [110.0, 164.81, 261.63, 329.63], // Am7
      [98.0, 146.83, 246.94, 392.0], // G(add9)
    ],
    bells: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],
    drone: [65.41, 130.81],
    chordSec: 8, bellChance: 0.5, bellGain: 0.04, wind: 0.004, padGain: 0.015,
  },
  // バッドエンド：不協和な短調。半音の緊張、遅い和音、低い単音、風が強まる
  bad: {
    chords: [
      [110.0, 130.81, 164.81], // Am
      [103.83, 123.47, 146.83], // 半音下の減和音寄り
      [98.0, 116.54, 139.69], // さらに不穏に
      [110.0, 130.81, 155.56], // Am に♭5 の緊張
    ],
    bells: [220.0, 233.08, 110.0, 116.54],
    drone: [55, 58.27], // 半音のうなり
    chordSec: 12, bellChance: 0.16, bellGain: 0.05, wind: 0.012, padGain: 0.016,
  },
};

let bgmMood: BgmMood = 'normal';

export function startBgm(mood?: BgmMood): void {
  bgmWanted = true;
  const target = mood ?? bgmMood;
  if (bgmNodes && target === bgmMood) return;
  if (bgmNodes) stopBgmInternal(false);
  bgmMood = target;
  if (!enabled) return;
  const cfg = BGM_MOODS[bgmMood];
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
    droneGain.gain.value = 0.038;
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
          o.type = 'triangle';
          o.frequency.value = f;
          o.detune.value = detune;
          const g = c.createGain();
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(cfg.padGain, at + cfg.chordSec * 0.35);
          g.gain.setValueAtTime(cfg.padGain, at + cfg.chordSec * 0.7);
          g.gain.linearRampToValueAtTime(0, at + cfg.chordSec * 1.15);
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 850;
          o.connect(lp).connect(g).connect(master);
          o.start(at);
          o.stop(at + cfg.chordSec * 1.2);
        }
      }
    };
    const playBell = (at: number): void => {
      const f = cfg.bells[Math.floor(Math.random() * cfg.bells.length)];
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(cfg.bellGain, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
      o.connect(g).connect(master);
      g.connect(delay);
      o.start(at);
      o.stop(at + 3);
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
    document.dispatchEvent(new CustomEvent('app:bgm', { detail: { on: true } }));
  } catch {
    // 音が出せなくても続行する
  }
}

/** 結末に着いた瞬間の音。バッドは低い衝撃と半音の不協和、ハッピーは澄んだ上昇音 */
export function playEndingJingle(kind: 'happy' | 'bad'): void {
  if (!enabled) return;
  try {
    if (kind === 'bad') {
      // 悲鳴のような音：高音から滑り落ちる鋸波を、声のフォルマント風の
      // バンドパスと震え（振幅・周波数の揺れ）で声らしくし、立ち上がりを
      // 急にして驚かせる。バッドエンドのパネルが出る瞬間に鳴らす。
      const c = ac();
      const t = c.currentTime;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(1900, t);
      bp.frequency.exponentialRampToValueAtTime(650, t + 0.85);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.24, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      const tremolo = c.createOscillator();
      tremolo.frequency.value = 27;
      const tremoloGain = c.createGain();
      tremoloGain.gain.value = 0.09;
      tremolo.connect(tremoloGain).connect(g.gain);
      bp.connect(g).connect(c.destination);
      for (const mult of [1, 1.007, 0.5]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1250 * mult, t);
        o.frequency.exponentialRampToValueAtTime(420 * mult, t + 0.85);
        const vib = c.createOscillator();
        vib.frequency.value = 11;
        const vibGain = c.createGain();
        vibGain.gain.value = 18 * mult;
        vib.connect(vibGain).connect(o.frequency);
        o.connect(bp);
        o.start(t);
        o.stop(t + 1);
        vib.start(t);
        vib.stop(t + 1);
      }
      tremolo.start(t);
      tremolo.stop(t + 1);
      noise(0.16, 2600, 0.1, 0, 'highpass');
      tone(66, 0.7, 'sine', 0.22, 0, 34);
    } else {
      tone(523.25, 1.6, 'sine', 0.06, 0);
      tone(659.25, 1.6, 'sine', 0.06, 0.14);
      tone(783.99, 2.4, 'sine', 0.06, 0.28);
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
  document.dispatchEvent(new CustomEvent('app:bgm', { detail: { on: false } }));
}
