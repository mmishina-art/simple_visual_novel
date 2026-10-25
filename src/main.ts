import './style.css';
import {
  advance, backToCheckpoint, choose, endingsOf, isEnding, nodeOf, startState,
  type PlayState, type SceneBg,
} from './logic';
import { STORIES, storyById } from './stories';
import { setupDebug } from './debug';
import { setupInstallGuide } from './install';
import { setupUpdateBanner } from './pwa';
import { isSoundOn, playAdvanceSound, playEndingJingle, playSceneSound, setSound, startBgm, stopBgm } from './sound';
import { exportBackup, importBackup, load, migrateStorage, remove, requestPersist, save } from './storage';

import classroom from './assets/scenes/classroom.svg';
import corridor from './assets/scenes/corridor.svg';
import stairs from './assets/scenes/stairs.svg';
import music from './assets/scenes/music.svg';
import entrance from './assets/scenes/entrance.svg';
import dark from './assets/scenes/dark.svg';
import outside from './assets/scenes/outside.svg';

const SCENES: Record<SceneBg, string> = { classroom, corridor, stairs, music, entrance, dark, outside };

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

migrateStorage();

// MVP は1作品。将来は本棚画面で STORIES から選ぶ（src/stories/index.ts）。
const story = STORIES[0];
const totalEndings = endingsOf(story).length;

let screen: 'title' | 'game' | 'backlog' = 'title';
let state: PlayState | null = load<PlayState | null>('progress', null);
if (state && !storyById(state.storyId)) state = null;
let seenEndings: string[] = load<string[]>('endings', []);

/** 読み返し用の履歴。文章と、選んだ選択肢だけを記録する（選ばなかった選択肢は残らない）。進行と一緒に保存する */
type BacklogEntry = { kind: 'text' | 'choice'; text: string };
const loadedBacklog = load<unknown>('backlog', []);
let backlog: BacklogEntry[] = Array.isArray(loadedBacklog)
  ? loadedBacklog.filter(
      (e): e is BacklogEntry =>
        typeof e === 'object' && e !== null &&
        ((e as BacklogEntry).kind === 'text' || (e as BacklogEntry).kind === 'choice') &&
        typeof (e as BacklogEntry).text === 'string',
    )
  : [];
/** デバッグの操作を使った回は、到達した結末を記録しない */
let cheated = false;
let lastNodeId = '';
/** 結末の文章をまず読んでもらい、もう一度押してから結末パネルを出すための状態 */
let endingRevealed = false;
let currentBg: SceneBg = 'classroom';
/** 表示中の文章。読み進めると左へ追加されていき、選択肢が出ると消える */
let segments: string[] = [];

function persist(): void {
  if (state && !isEnding(story, state)) {
    save('progress', state);
    save('backlog', backlog);
  } else {
    remove('progress');
    remove('backlog');
  }
}

function recordEnding(): void {
  const node = state ? nodeOf(story, state) : null;
  if (!node?.ending || cheated) return;
  if (!seenEndings.includes(node.id)) {
    seenEndings = [...seenEndings, node.id];
    save('endings', seenEndings);
  }
}

/** 本文を縦書きで出す。数字（11時57分など）は縦中横になるよう、数字の並びだけ span.tcy で包む */
function buildSegment(text: string, className = 'segment'): HTMLSpanElement {
  const seg = document.createElement('span');
  seg.className = className;
  for (const part of text.split(/(\d+%?)/g)) {
    if (!part) continue;
    if (/^\d/.test(part)) {
      const span = document.createElement('span');
      span.className = 'tcy';
      span.textContent = part;
      seg.append(span);
    } else {
      seg.append(document.createTextNode(part));
    }
  }
  return seg;
}

function renderStoryText(texts: string[]): void {
  const el = $('story-text');
  el.replaceChildren();
  texts.forEach((text) => el.append(buildSegment(text)));
  el.scrollLeft = 0;
}

function renderBacklog(): void {
  const el = $('backlog-text');
  el.replaceChildren();
  if (backlog.length === 0) el.append(buildSegment('まだ文章がありません。'));
  for (const entry of backlog) {
    el.append(
      entry.kind === 'choice'
        ? buildSegment(`▶ ${entry.text}`, 'segment choice-entry')
        : buildSegment(entry.text),
    );
  }
  // 開いたときは先頭（右端）ではなく、いちばん新しい文章（左端）から表示する。
  // row-reverse のはみ出し方向は左で、scrollLeft は負方向に進む
  el.scrollLeft = -el.scrollWidth;
  // 開いたときは最初（右端）から読める位置にする
  requestAnimationFrame(() => { el.scrollLeft = 0; });
}

function renderTitle(): void {
  $('continue-button').hidden = !state || (state !== null && isEnding(story, state));
  $('endings-progress').textContent = `到達した結末: ${seenEndings.length} / ${totalEndings}`;
  // 音ボタンはタイトル画面と本編の画面の両方にあるので、表示をそろえる
  for (const id of ['sound-button', 'sound-button-game']) {
    const sound = $(id);
    sound.textContent = isSoundOn() ? '🔊' : '🔇';
    sound.setAttribute('aria-pressed', String(isSoundOn()));
  }
}

/**
 * 選択肢の文字が帯の中で見切れないよう、収まるまで文字を少しずつ小さくする。
 * 端末やフォントの差で1行に収まる文字数が変わるため、実測で合わせる。
 */
function fitChoiceButtons(container: HTMLElement): void {
  for (const b of container.querySelectorAll('button')) {
    b.style.fontSize = '';
    let size = 1;
    while (
      (b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1) &&
      size > 0.68
    ) {
      size -= 0.04;
      b.style.fontSize = `${size}rem`;
    }
  }
}

function renderGame(): void {
  $('game-screen').hidden = screen !== 'game';
  if (screen !== 'game' || !state) return;
  const node = nodeOf(story, state);
  if (node.bg) currentBg = node.bg;
  $<HTMLImageElement>('scene-img').src = SCENES[currentBg];
  $('speaker').textContent = node.speaker ?? '';
  if (node.id !== lastNodeId) {
    endingRevealed = false;
    const prev = lastNodeId ? story.nodes[lastNodeId] : undefined;
    if (node.ending) {
      // 結末は独立したページにする（前の文章と重なって読めなくならないように）
      segments = [node.text];
    } else if (node.choices) {
      // 選択肢の場面では、それまでの文章は消し、直前の文章（その場面の文章）だけを残す
      segments = [node.text];
    } else if (prev?.choices) {
      // 選択肢を選んだあとは、まっさらな状態から文章が足されていく
      segments = [node.text];
    } else {
      segments = [...segments, node.text];
    }
  }
  renderStoryText(segments);
  // ページめくり: 文章が画面いっぱいになってはみ出したら、ページをめくる感じで
  // 全部消して、その文章だけを右から始める（前のページは「読み返す」で読める）
  if (!node.choices && !node.ending) {
    const textEl = $('story-text');
    if (segments.length > 1 && textEl.scrollWidth > textEl.clientWidth + 1) {
      segments = [node.text];
      renderStoryText(segments);
    }
  }
  // 結末では、パネルを出すまでは「進む」合図を出して、もう一度押してもらう
  $('next-hint').hidden = !!node.choices || (!!node.ending && endingRevealed);

  const choicesEl = $('choices');
  choicesEl.replaceChildren();
  choicesEl.hidden = !node.choices;
  (node.choices ?? []).forEach((choice, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = choice.label;
    b.addEventListener('click', () => {
      if (!state) return;
      backlog = [...backlog, { kind: 'choice', text: choice.label }];
      state = choose(story, state, i);
      persist();
      render();
    });
    choicesEl.append(b);
  });
  if (node.choices) fitChoiceButtons(choicesEl);

  const endingPanel = $('ending-panel');
  // 結末パネルは先に出さない。文章を表示し、もう一度押されたら出す
  endingPanel.hidden = !node.ending || !endingRevealed;
  if (node.ending) $('ending-title').textContent = node.ending.title;
  $('to-title-button').hidden = !!node.ending;

  // 場面が変わったときだけ、その場面の音を鳴らし、読み返し用に文章を記録する
  if (node.id !== lastNodeId) {
    lastNodeId = node.id;
    backlog = [...backlog, { kind: 'text', text: node.text }];
    if (node.se) playSceneSound(node.se);
    if (node.ending) {
      recordEnding();
      // ハッピーのジングルは文章の表示と一緒に。バッドの悲鳴は、
      // パネルが出る瞬間に鳴らす（そちらは操作ハンドラ側）
      if (node.ending.kind === 'happy') playEndingJingle('happy');
      startBgm(node.ending.kind);
    }
  }
}

function render(): void {
  $('title-screen').hidden = screen !== 'title';
  $('game-screen').hidden = screen !== 'game';
  $('backlog-screen').hidden = screen !== 'backlog';
  renderTitle();
  renderGame();
  if (screen === 'backlog') renderBacklog();
}

function startGame(fromState: PlayState, resume = false): void {
  state = fromState;
  if (!resume) backlog = [];
  else if (backlog.length === 0) backlog = [{ kind: 'text', text: nodeOf(story, fromState).text }];
  segments = resume ? [nodeOf(story, fromState).text] : [];
  lastNodeId = resume ? fromState.nodeId : '';
  currentBg = 'classroom';
  screen = 'game';
  persist();
  startBgm('normal');
  render();
}

$('start-button').addEventListener('click', () => {
  cheated = false;
  startGame(startState(story));
});
$('backlog-button').addEventListener('click', () => {
  screen = 'backlog';
  render();
});
$('backlog-close').addEventListener('click', () => {
  screen = 'game';
  render();
});
$('continue-button').addEventListener('click', () => {
  if (state) startGame(state, true);
});
$('message-window').addEventListener('click', () => {
  if (!state || screen !== 'game') return;
  // 結末の文章が表示された状態でもう一度押されたら、結末パネルを出す。
  // バッドエンドでは、この瞬間に悲鳴のような効果音を鳴らす
  const ending = nodeOf(story, state).ending;
  if (ending && !endingRevealed) {
    endingRevealed = true;
    if (ending.kind === 'bad') playEndingJingle('bad');
    else playAdvanceSound();
    render();
    return;
  }
  const next = advance(story, state);
  if (next !== state) {
    state = next;
    playAdvanceSound();
    persist();
    render();
  }
});
$('retry-button').addEventListener('click', () => {
  if (state) startGame(backToCheckpoint(story, state));
});
const toTitle = (): void => {
  stopBgm();
  screen = 'title';
  render();
};
$('ending-title-button').addEventListener('click', toTitle);
$('to-title-button').addEventListener('click', toTitle);
for (const id of ['sound-button', 'sound-button-game']) {
  $(id).addEventListener('click', () => {
    setSound(!isSoundOn());
    render();
  });
}

$('backup-export').addEventListener('click', () => {
  const blob = new Blob([exportBackup()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${__APP_ID__}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$<HTMLInputElement>('backup-import').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const message = $('backup-message');
  try {
    const n = importBackup(await file.text());
    state = load<PlayState | null>('progress', null);
    seenEndings = load<string[]>('endings', []);
    backlog = load<BacklogEntry[]>('backlog', []);
    screen = 'title';
    render();
    message.textContent = `${n} 件の記録を読み込みました`;
  } catch (err) {
    message.textContent = err instanceof Error ? err.message : '読み込めませんでした';
  }
  input.value = '';
});

$<HTMLImageElement>('title-art').src = SCENES.classroom;
$('story-length').textContent = story.length;
$('ending-total').textContent = String(totalEndings);
$('version').textContent = __APP_VERSION__;
// デバッグモード: バージョンの表示を続けて 5 回タップで切り替え
setupDebug($('debug-panel'), $('version-line'), [
  {
    label: '結末',
    title: '最後の選択肢へ飛ぶ（懐中電灯あり。この回は結末を記録しない）',
    run: () => {
      cheated = true;
      startGame({ storyId: story.id, nodeId: 'choice_final', flags: ['flashlight'], checkpoint: { nodeId: 'choice_final', flags: ['flashlight'] } });
    },
  },
  {
    label: '最初',
    title: '物語の最初へ戻る（この回は結末を記録しない）',
    run: () => { cheated = true; startGame(startState(story)); },
  },
]);
requestPersist();
setupUpdateBanner($('update-banner'), $('update-button'));
setupInstallGuide($<HTMLButtonElement>('install-open'), $<HTMLDialogElement>('install-dialog'), $<HTMLButtonElement>('install-now'));
render();

// ここまで来たら起動成功（public/boot.js が見ている）
window.__appStarted = true;
