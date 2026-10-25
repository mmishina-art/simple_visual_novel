import './style.css';
import {
  advance, backToCheckpoint, choose, endingsOf, isEnding, nodeOf, startState,
  type PlayState, type SceneBg,
} from './logic';
import { STORIES, storyById } from './stories';
import { setupDebug } from './debug';
import { setupInstallGuide } from './install';
import { setupUpdateBanner } from './pwa';
import { isSoundOn, playSceneSound, setSound } from './sound';
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

let screen: 'title' | 'game' = 'title';
let state: PlayState | null = load<PlayState | null>('progress', null);
if (state && !storyById(state.storyId)) state = null;
let seenEndings: string[] = load<string[]>('endings', []);
/** デバッグの操作を使った回は、到達した結末を記録しない */
let cheated = false;
let lastNodeId = '';
let currentBg: SceneBg = 'classroom';
/** 表示中の文章。読み進めると左へ追加されていき、選択肢が出ると消える */
let segments: string[] = [];

function persist(): void {
  if (state && !isEnding(story, state)) save('progress', state);
  else remove('progress');
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
function renderStoryText(texts: string[]): void {
  const el = $('story-text');
  el.replaceChildren();
  texts.forEach((text) => {
    const seg = document.createElement('span');
    seg.className = 'segment';
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
    el.append(seg);
  });
  // いちばん新しい列（左端）が見える位置まで寄せる
  requestAnimationFrame(() => { el.scrollLeft = -el.scrollWidth; });
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

function renderGame(): void {
  $('game-screen').hidden = screen !== 'game';
  if (screen !== 'game' || !state) return;
  const node = nodeOf(story, state);
  if (node.bg) currentBg = node.bg;
  $<HTMLImageElement>('scene-img').src = SCENES[currentBg];
  $('speaker').textContent = node.speaker ?? '';
  if (node.id !== lastNodeId) {
    const prev = lastNodeId ? story.nodes[lastNodeId] : undefined;
    if (node.choices) {
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
  $('next-hint').hidden = !!node.choices || !!node.ending;

  const choicesEl = $('choices');
  choicesEl.replaceChildren();
  choicesEl.hidden = !node.choices;
  (node.choices ?? []).forEach((choice, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = choice.label;
    b.addEventListener('click', () => {
      if (!state) return;
      state = choose(story, state, i);
      persist();
      render();
    });
    choicesEl.append(b);
  });

  const endingPanel = $('ending-panel');
  endingPanel.hidden = !node.ending;
  if (node.ending) $('ending-title').textContent = node.ending.title;
  $('to-title-button').hidden = !!node.ending;

  // 場面が変わったときだけ、その場面の音を鳴らす
  if (node.id !== lastNodeId) {
    lastNodeId = node.id;
    if (node.se) playSceneSound(node.se);
    if (node.ending) recordEnding();
  }
}

function render(): void {
  $('title-screen').hidden = screen !== 'title';
  $('game-screen').hidden = screen !== 'game';
  renderTitle();
  renderGame();
}

function startGame(fromState: PlayState, resume = false): void {
  state = fromState;
  segments = resume ? [nodeOf(story, fromState).text] : [];
  lastNodeId = resume ? fromState.nodeId : '';
  currentBg = 'classroom';
  screen = 'game';
  persist();
  render();
}

$('start-button').addEventListener('click', () => {
  cheated = false;
  startGame(startState(story));
});
$('continue-button').addEventListener('click', () => {
  if (state) startGame(state, true);
});
$('message-window').addEventListener('click', () => {
  if (!state || screen !== 'game') return;
  const next = advance(story, state);
  if (next !== state) {
    state = next;
    persist();
    render();
  }
});
$('retry-button').addEventListener('click', () => {
  if (state) startGame(backToCheckpoint(story, state));
});
const toTitle = (): void => {
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
