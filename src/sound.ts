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

const BGM_CHORDS: number[][] = [
  [110.0, 164.81, 246.94, 261.63], // Am(add9)
  [87.31, 130.81, 220.0, 329.63], // Fmaj7
  [130.81, 196.0, 246.94, 392.0], // Cmaj7
  [98.0, 146.83, 246.94, 293.66], // G(add9)寄り
];
const BGM_BELLS = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

export function startBgm(): void {
  bgmWanted = true;
  if (!enabled || bgmNodes) return;
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
    for (const f of [55, 110.4]) {
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
    windGain.gain.value = 0.007;
    const windLfo = c.createOscillator();
    windLfo.frequency.value = 0.06;
    const windLfoGain = c.createGain();
    windLfoGain.gain.value = 0.004;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
    windLfo.start();
    sources.push(windLfo);

    // パッドの和音と、まばらなピアノの単音を定期的に差し込む
    let chordIndex = 0;
    let nextChordAt = c.currentTime + 0.1;
    const playChord = (at: number): void => {
      const chord = BGM_CHORDS[chordIndex % BGM_CHORDS.length];
      chordIndex += 1;
      for (const f of chord) {
        for (const detune of [-4, 4]) {
          const o = c.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f;
          o.detune.value = detune;
          const g = c.createGain();
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(0.014, at + 3.2);
          g.gain.setValueAtTime(0.014, at + 6.4);
          g.gain.linearRampToValueAtTime(0, at + 10.4);
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 850;
          o.connect(lp).connect(g).connect(master);
          o.start(at);
          o.stop(at + 10.6);
        }
      }
    };
    const playBell = (at: number): void => {
      const f = BGM_BELLS[Math.floor(Math.random() * BGM_BELLS.length)];
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.045, at);
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
        nextChordAt += 9;
      }
      if (Math.random() < 0.28) playBell(now + 0.05);
    }, 1200);

    bgmNodes = { master, timer, sources };
    document.body.dataset.bgm = 'on';
    document.dispatchEvent(new CustomEvent('app:bgm', { detail: { on: true } }));
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
