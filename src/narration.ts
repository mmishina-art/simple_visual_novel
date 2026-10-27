// 読み上げ。本文の音声は、scripts/build-narration.mjs が事前に生成した
// public/audio/<物語ID>/<場面ID>.mp3 を、場面に合わせて再生する。
// オンにすると「自動再生」：読み終わると次の文章へ進み、選択肢の場面で止まる。
// タップされたら、その場で次の文章へスキップする（main.ts の進行処理が場面を変え、
// ここは sync で新しい場面の音声に切り替える）。
import { load, save } from './storage';

let enabled = load('narration', false);

/** 読み上げの速度の候補（倍率）。設定画面と本編のボタンで、順に切り替える */
export const NARRATION_SPEEDS = [0.8, 1, 1.25, 1.5, 2] as const;
export type NarrationSpeed = (typeof NARRATION_SPEEDS)[number];

const normalizeSpeed = (value: unknown): NarrationSpeed =>
  (NARRATION_SPEEDS as readonly number[]).includes(value as number) ? (value as NarrationSpeed) : 1;

let speed: NarrationSpeed = normalizeSpeed(load('narration-speed', 1));

export const getNarrationSpeed = (): NarrationSpeed => speed;

/** 速度ボタンの表示（1 は「1.0x」、1.25 は「1.25x」） */
export const formatNarrationSpeed = (value: NarrationSpeed = speed): string =>
  `${value % 1 === 0 ? value.toFixed(1) : value}x`;

export function setNarrationSpeed(next: NarrationSpeed): void {
  speed = next;
  save('narration-speed', next);
  if (audio) {
    // src を差し替えると playbackRate は defaultPlaybackRate に戻るので、両方に設定する
    audio.defaultPlaybackRate = next;
    audio.playbackRate = next;
  }
}

/** 次の候補に切り替える（一番速い候補の次は、一番遅い候補に戻る）。新しい速度を返す */
export function cycleNarrationSpeed(): NarrationSpeed {
  const next = NARRATION_SPEEDS[(NARRATION_SPEEDS.indexOf(speed) + 1) % NARRATION_SPEEDS.length];
  setNarrationSpeed(next);
  return next;
}

let audio: HTMLAudioElement | null = null;
let currentKey = '';
let finishHandler: (() => void) | null = null;
let fallbackTimer: number | undefined;
/** 場面の切り替え・停止・リセットのたびに増やす。古い再生の通知を無効にするため */
let generation = 0;

const clearFallback = (): void => {
  if (fallbackTimer !== undefined) {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
  }
};

// 音声が読めないとき（通信の失敗など）でも、自動再生が止まらないようにする
const scheduleFallback = (): void => {
  clearFallback();
  fallbackTimer = window.setTimeout(() => finishHandler?.(), 2500);
};

const ensureAudio = (): HTMLAudioElement => {
  if (!audio) {
    audio = new Audio();
    audio.id = 'narration-audio';
    audio.preload = 'auto';
    // 速度を変えても音程は変えない（ブラウザの既定のまま、明示だけしておく）
    audio.preservesPitch = true;
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
    audio.addEventListener('ended', () => {
      clearFallback();
      finishHandler?.();
    });
    audio.addEventListener('error', () => {
      // いま表示している場面の音声の失敗だけを拾う（古い場面の失敗は無視する）
      if (enabled && currentKey && audio?.currentSrc.endsWith(`${currentKey}.mp3`)) scheduleFallback();
    });
    document.body.append(audio);
  }
  return audio;
};

export const isNarrationOn = (): boolean => enabled;

export function setNarration(on: boolean): void {
  enabled = on;
  save('narration', on);
  if (!on) stopNarration();
}

/** 読み終わったときに呼ばれる処理（自動で次へ進める）を登録する */
export function onNarrationFinish(handler: () => void): void {
  finishHandler = handler;
}

/** 再生する。失敗したときのフォールバックは、その場面がまだ表示されているときだけ動かす */
function playCurrent(a: HTMLAudioElement, key: string, gen: number): void {
  void a.play().catch(() => {
    // すぐにタップで次へ進むと、前の再生リクエストが「中断」で失敗する。
    // それを拾って進めてしまうと、画面と読み上げが1場面ずれるので、古い失敗は無視する
    if (gen === generation && currentKey === key) scheduleFallback();
  });
}

/** その場面の読み上げに切り替える。同じ場面なら、止まっていたら再開するだけ */
export function syncNarration(storyId: string, nodeId: string): void {
  if (!enabled) return;
  const key = `${storyId}/${nodeId}`;
  const a = ensureAudio();
  if (key === currentKey) {
    a.playbackRate = speed;
    if (a.paused && !a.ended && a.currentTime > 0) playCurrent(a, key, generation);
    return;
  }
  generation += 1;
  currentKey = key;
  clearFallback();
  a.src = `audio/${key}.mp3`;
  // src の差し替えで速度が 1.0 に戻るので、差し替えた後に選び直す（場面が替わっても速度を維持する）
  a.defaultPlaybackRate = speed;
  a.playbackRate = speed;
  playCurrent(a, key, generation);
}

/** 完全に止める（本棚・タイトル・設定へ出たとき） */
export function stopNarration(): void {
  generation += 1;
  currentKey = '';
  clearFallback();
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}

/** 一時停止する（読み返し画面を開いたとき）。戻ると sync が続きから再開する */
export function suspendNarration(): void {
  clearFallback();
  audio?.pause();
}

/** 次の sync で同じ場面でも読み直すようにする（本を開き直したとき） */
export function resetNarration(): void {
  generation += 1;
  currentKey = '';
  clearFallback();
}
