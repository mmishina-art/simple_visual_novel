// 効果音は Web Audio で合成する（音声ファイルは持たない）。オン/オフ設定は必ず用意する。
import { load, save } from './storage';
import type { SceneSound } from './logic';

let ctx: AudioContext | undefined;
let enabled = load('sound', true);

export const isSoundOn = (): boolean => enabled;

export function setSound(on: boolean): void {
  enabled = on;
  save('sound', on);
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
