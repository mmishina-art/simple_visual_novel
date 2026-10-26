import './style.css';
import {
  advance, backToCheckpoint, choose, endingsOf, isEnding, nodeOf, startState,
  type PlayState, type SceneBg, type Story,
} from './logic';
import { STORIES, storyById } from './stories';
import { setupDebug } from './debug';
import { setupInstallGuide } from './install';
import { applyUpdate, checkForUpdate, onUpdateAvailable, setupPwa } from './pwa';
import { isSoundOn, playAdvanceSound, playBookOpenSound, playButtonSound, playEndingJingle, playSceneSound, setSound, startBgm, startTitleBgm, stopBgm } from './sound';
import { isNarrationOn, onNarrationFinish, resetNarration, setNarration, stopNarration, suspendNarration, syncNarration } from './narration';
import { exportBackup, importBackup, load, migrateStorage, remove, requestPersist, save } from './storage';

import { SCENES } from './scenes';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

migrateStorage();

// 本棚（src/stories/index.ts の STORIES）から選んだ作品を遊ぶ。
// 進行・読み返し・到達した結末は作品ごとに分けて保存する。
let story: Story = STORIES[0];

let screen: 'title' | 'shelf' | 'settings' | 'game' | 'backlog' = 'title';
const skey = (base: string, target: Story = story): string => `story:${target.id}:${base}`;
let state: PlayState | null = null;
let seenEndings: string[] = [];

/** その作品の進行を読み込む（作品が存在しない・壊れている場合は空にする） */
function savedProgressOf(target: Story): PlayState | null {
  const saved = load<PlayState | null>(skey('progress', target), null);
  return saved && storyById(saved.storyId)?.id === target.id ? saved : null;
}

/** 読み返し用の履歴。文章と、選んだ選択肢だけを記録する（選ばなかった選択肢は残らない）。進行と一緒に保存する */
type BacklogEntry = { kind: 'text' | 'choice'; text: string };
let backlog: BacklogEntry[] = [];

function loadBacklogOf(target: Story): BacklogEntry[] {
  const raw = load<unknown>(skey('backlog', target), []);
  return Array.isArray(raw)
    ? raw.filter(
        (e): e is BacklogEntry =>
          typeof e === 'object' && e !== null &&
          ((e as BacklogEntry).kind === 'text' || (e as BacklogEntry).kind === 'choice') &&
          typeof (e as BacklogEntry).text === 'string',
      )
    : [];
}

/** 作品を選んだとき、その作品の進行・履歴・結末を読み込む */
function loadForStory(target: Story): void {
  state = savedProgressOf(target);
  seenEndings = load<string[]>(skey('endings', target), []);
  backlog = loadBacklogOf(target);
}
/** デバッグの操作を使った回は、到達した結末を記録しない */
let cheated = false;
let lastNodeId = '';
/** 結末の文章をまず読んでもらい、もう一度押してから結末パネルを出すための状態 */
let endingRevealed = false;
/** 選択肢の場面で、選択肢そのものを出したかどうか。まず文章だけを見せ、タッチで出す */
let choicesRevealed = false;
let currentBg: SceneBg = 'classroom';
/** 表示中の文章。読み進めると左へ追加されていき、選択肢が出ると消える */
let segments: string[] = [];

function persist(): void {
  if (state && !isEnding(story, state)) {
    save(skey('progress'), state);
    save(skey('backlog'), backlog);
  } else {
    remove(skey('progress'));
    remove(skey('backlog'));
  }
}

function recordEnding(): void {
  const node = state ? nodeOf(story, state) : null;
  if (!node?.ending || cheated) return;
  if (!seenEndings.includes(node.id)) {
    seenEndings = [...seenEndings, node.id];
    save(skey('endings'), seenEndings);
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
  // row-reverse のはみ出し方向は左で、scrollLeft は負方向に進む。
  // フォント読み込みで幅が変わることがあるので、落ち着いてからも合わせ直す
  const toNewest = (): void => {
    el.scrollLeft = -el.scrollWidth;
  };
  toNewest();
  requestAnimationFrame(toNewest);
  void document.fonts?.ready.then(toNewest);
}

function renderTitle(): void {
  // 音ボタンはタイトル画面と本編の画面の両方にあるので、表示をそろえる
  for (const id of ['sound-button', 'sound-button-game']) {
    const sound = $(id);
    sound.textContent = isSoundOn() ? '🔊' : '🔇';
    sound.setAttribute('aria-pressed', String(isSoundOn()));
  }
  for (const id of ['narration-button', 'narration-button-game']) {
    $(id).setAttribute('aria-pressed', String(isNarrationOn()));
  }
}

/** 本棚の画面。STORIES の作品を単行本の装丁で並べ、選ぶと本編が始まる */
function spanOf(className: string, text?: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * 表紙を作る。装丁は「帯のデザイン」（2026-10-26 決定）：
 * 縦書きの題字、赤い帯にあらすじ、左上に奥付
 */
function buildCover(item: { title: string; description: string; cover?: SceneBg; coverObi?: string; coverTone?: string; coverLines?: string[]; coverTitleLayout?: string }): HTMLSpanElement {
  const cover = spanOf(`book-cover obi-${item.coverObi ?? 'red'} tone-${item.coverTone ?? 'dark'}`);
  const img = document.createElement('img');
  img.className = 'book-cover-img';
  img.src = SCENES[item.cover ?? 'classroom'];
  img.alt = '';
  cover.append(img);
  const vtitle = spanOf('book-cover-vtitle');
  if (item.coverTitleLayout === 'horizontal') vtitle.classList.add('htitle');
  if (item.coverTitleLayout === 'window') vtitle.classList.add('inwindow');
  // 5文字以上の列がある本は、題字を少し小さくして帯に届かないようにする
  if (item.coverLines?.some((line) => line.length >= 5)) vtitle.classList.add('vt-long');
  if (item.coverLines) {
    for (const line of item.coverLines) vtitle.append(spanOf('book-cover-vline', line));
  } else {
    vtitle.textContent = item.title;
  }
  cover.append(vtitle);
  cover.append(spanOf('book-obi', item.description));
  cover.append(spanOf('book-colophon', 'サウンドノベル'));
  return cover;
}

function renderShelf(): void {
  const list = $('shelf-list');
  list.replaceChildren();
  for (const item of STORIES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'book-card';
    const resume = savedProgressOf(item) !== null;
    const endings = load<string[]>(skey('endings', item), []);
    card.append(buildCover(item));
    const meta = spanOf('book-meta muted', `読了目安 ${item.length} ／ 到達した結末: ${endings.length} / ${endingsOf(item).length}`);
    card.append(meta);
    card.addEventListener('click', () => {
      // 読みかけの本は、つづきから読むか最初から読むかをポップアップで選んでもらう
      if (resume) askResume(item);
      else openStory(item, 'new');
    });
    list.append(card);
  }

}

let resumeTarget: Story | null = null;

/** 読みかけの本を選んだとき：つづきから／最初からの確認を出す */
function askResume(item: Story): void {
  resumeTarget = item;
  $('resume-title').textContent = `『${item.title}』`;
  $<HTMLDialogElement>('resume-dialog').showModal();
}

/** 本棚で作品を選んだとき。本編の画面へ移る */
function openStory(target: Story, mode: 'new' | 'resume'): void {
  playBookOpenSound();
  story = target;
  loadForStory(target);
  document.querySelector('.game-title')!.textContent = target.title;
  cheated = false;
  if (mode === 'resume' && state) startGame(state, true);
  else startGame(startState(target));
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
    choicesRevealed = false;
    const prev = lastNodeId ? story.nodes[lastNodeId] : undefined;
    if (node.ending) {
      // 結末は独立したページにする（前の文章と重なって読めなくならないように）
      segments = [node.text];
    } else if (prev?.choices) {
      // 選択肢を選んだあとは、まっさらな状態から文章が足されていく
      segments = [node.text];
    } else {
      // 選択肢の場面も、まずは普通の文章として足していく（選択肢はタッチで出す）
      segments = [...segments, node.text];
    }
  }
  // 選択肢を出すときは、直前の一文とセットにする（それまでの文章は消す）
  if (node.choices && choicesRevealed) segments = [node.text];
  renderStoryText(segments);
  // ページめくり: 文章が画面いっぱいになってはみ出したら、ページをめくる感じで
  // 全部消して、その文章だけを右から始める（前のページは「読み返す」で読める）
  if ((!node.choices || !choicesRevealed) && !node.ending) {
    const textEl = $('story-text');
    if (segments.length > 1 && textEl.scrollWidth > textEl.clientWidth + 1) {
      segments = [node.text];
      renderStoryText(segments);
    }
  }
  // 結末では、パネルを出すまでは「進む」合図を出して、もう一度押してもらう。
  // 選択肢も同じで、出すまでは合図を出しておく
  $('next-hint').hidden = (!!node.choices && choicesRevealed) || (!!node.ending && endingRevealed);

  const choicesEl = $('choices');
  choicesEl.replaceChildren();
  choicesEl.hidden = !node.choices || !choicesRevealed;
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
  if (node.choices && choicesRevealed) fitChoiceButtons(choicesEl);

  const endingPanel = $('ending-panel');
  // 結末パネルは先に出さない。文章を表示し、もう一度押されたら出す
  endingPanel.hidden = !node.ending || !endingRevealed;
  if (node.ending) $('ending-title').textContent = node.ending.title;
  $('to-title-button').hidden = !!node.ending;

  // 読み上げ：結末パネルが出ているときは止め、それ以外は今の場面に合わせる
  if (node.ending && endingRevealed) stopNarration();
  else syncNarration(story.id, node.id);

  // 場面が変わったときだけ、その場面の音を鳴らし、読み返し用に文章を記録する
  if (node.id !== lastNodeId) {
    lastNodeId = node.id;
    backlog = [...backlog, { kind: 'text', text: node.text }];
    if (node.se) playSceneSound(node.se);
    if (node.ending) {
      recordEnding();
      // 結末の効果音は、結末パネルが出る瞬間に鳴らす
      // （そちらは操作ハンドラ側）。ここではBGMだけ切り替える
      startBgm(node.ending.kind, story.bgm);
    }
  }
}

function render(): void {
  // 読み上げは本編の画面だけ。読み返しでは一時停止、その他の画面では止める
  if (screen === 'backlog') suspendNarration();
  else if (screen !== 'game') stopNarration();
  $('title-screen').hidden = screen !== 'title';
  $('shelf-screen').hidden = screen !== 'shelf';
  $('settings-screen').hidden = screen !== 'settings';
  $('game-screen').hidden = screen !== 'game';
  $('backlog-screen').hidden = screen !== 'backlog';
  renderTitle();
  if (screen === 'shelf') renderShelf();
  renderGame();
  if (screen === 'backlog') renderBacklog();
  // タイトル・本棚・設定の画面ではタイトルのBGMを流す（本編と読み返しでは物語側のBGMが担当する）
  if (screen !== 'game' && screen !== 'backlog') startTitleBgm();
}

/** その場面に着いた時点で効いている背景を、物語の入口からたどって求める
 * （場面自身に指定がなければ、そこへ至る経路で最後に指定された背景が続く）。
 * 続きから再開したときや、選択肢へ戻ったときに、別の場面の背景が残らないようにするため */
function bgAtNode(targetId: string): SceneBg {
  const visited = new Set<string>();
  const walk = (nodeId: string, bg: SceneBg): SceneBg | null => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    const node = story.nodes[nodeId];
    if (!node) return null;
    const here = node.bg ?? bg;
    if (nodeId === targetId) return here;
    const nexts = [node.next, ...(node.choices ?? []).flatMap((c) => [c.to, c.toIfFlag?.to])]
      .filter((x): x is string => !!x);
    for (const n of nexts) {
      const found = walk(n, here);
      if (found) return found;
    }
    return null;
  };
  return walk(story.start, 'classroom') ?? 'classroom';
}

function startGame(fromState: PlayState, resume = false): void {
  resetNarration();
  state = fromState;
  if (!resume) backlog = [];
  else if (backlog.length === 0) backlog = [{ kind: 'text', text: nodeOf(story, fromState).text }];
  segments = resume ? [nodeOf(story, fromState).text] : [];
  lastNodeId = resume ? fromState.nodeId : '';
  currentBg = bgAtNode(fromState.nodeId);
  screen = 'game';
  persist();
  startBgm('normal', story.bgm);
  render();
}

// ボタンを押したときの操作音。個別のボタンに足すのではなく、
// まとめて拾う（音のオン/オフ、更新、復旧、デバッグのボタンは除く）
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest('button');
  if (!button) return;
  if (button.id === 'sound-button' || button.id === 'sound-button-game') return;
  if (button.id === 'narration-button' || button.id === 'narration-button-game') return;
  if (button.classList.contains('book-card')) return; // 本を開く音が鳴るので、ボタンの音は出さない
  if (button.id === 'update-button' || button.id === 'boot-repair') return;
  if (button.id === 'resume-continue' || button.id === 'resume-restart') return;
  if (button.closest('#debug-panel')) return;
  playButtonSound();
});

$('start-button').addEventListener('click', () => {
  screen = 'shelf';
  render();
});
$('shelf-back').addEventListener('click', () => {
  screen = 'title';
  render();
});
$('resume-continue').addEventListener('click', () => {
  const target = resumeTarget;
  $<HTMLDialogElement>('resume-dialog').close();
  if (target) openStory(target, 'resume');
});
$('resume-restart').addEventListener('click', () => {
  const target = resumeTarget;
  $<HTMLDialogElement>('resume-dialog').close();
  if (target) openStory(target, 'new');
});
$('resume-cancel').addEventListener('click', () => {
  $<HTMLDialogElement>('resume-dialog').close();
});
$<HTMLDialogElement>('resume-dialog').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) $<HTMLDialogElement>('resume-dialog').close();
});
$('settings-button').addEventListener('click', () => {
  screen = 'settings';
  render();
});
$('settings-back').addEventListener('click', () => {
  screen = 'title';
  render();
});
$('backlog-button').addEventListener('click', () => {
  screen = 'backlog';
  render();
});
$('backlog-close').addEventListener('click', () => {
  screen = 'game';
  render();
});
// 文章を1つ進める（結末なら、まず結末パネルを出す）。タップと、読み上げの自動再生で共用する
function advanceReading(): void {
  if (!state || screen !== 'game') return;
  // 結末の文章が表示された状態でもう一度押されたら、結末パネルを出す。
  // この瞬間に、結末ごとの効果音を鳴らす
  const ending = nodeOf(story, state).ending;
  if (ending && !endingRevealed) {
    endingRevealed = true;
    playEndingJingle(ending.kind);
    render();
    return;
  }
  // 選択肢の場面では、まず文章だけを見せる。タッチされたら選択肢を出す
  const current = nodeOf(story, state);
  if (current.choices && !choicesRevealed) {
    choicesRevealed = true;
    playAdvanceSound();
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
}
$('message-window').addEventListener('click', advanceReading);
// 最初のタップで音声が解放されたら、タイトルBGMの開始をもう一度試みる
document.addEventListener('pointerdown', () => {
  if (screen !== 'game' && screen !== 'backlog') startTitleBgm();
});
// 読み上げが終わったら自動で次へ。ただし選択肢の場面では、選んでもらうために止まる
onNarrationFinish(() => {
  if (!state || screen !== 'game') return;
  // 選択肢が出ているときは進まない。まだ出ていないときは、読み終わりを合図に選択肢を出す
  if (nodeOf(story, state).choices && choicesRevealed) return;
  advanceReading();
});
$('retry-button').addEventListener('click', () => {
  if (state) startGame(backToCheckpoint(story, state));
});
const toShelf = (): void => {
  stopBgm();
  screen = 'shelf';
  checkForUpdate();
  render();
};
$('ending-title-button').addEventListener('click', toShelf);
$('to-title-button').addEventListener('click', toShelf);
for (const id of ['sound-button', 'sound-button-game']) {
  $(id).addEventListener('click', () => {
    setSound(!isSoundOn());
    render();
  });
}
for (const id of ['narration-button', 'narration-button-game']) {
  $(id).addEventListener('click', () => {
    setNarration(!isNarrationOn());
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
    loadForStory(story);
    screen = 'title';
    render();
    message.textContent = `${n} 件の記録を読み込みました`;
  } catch (err) {
    message.textContent = err instanceof Error ? err.message : '読み込めませんでした';
  }
  input.value = '';
});

document.querySelector('.game-title')!.textContent = story.title;
$<HTMLImageElement>('title-bg').src = SCENES.archlibrary;
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
setupPwa();
setTimeout(() => checkForUpdate(), 5000);
onUpdateAvailable(() => {
  $('update-banner').hidden = false;
});
$('update-button').addEventListener('click', applyUpdate);
setupInstallGuide($<HTMLButtonElement>('install-open'), $<HTMLDialogElement>('install-dialog'), $<HTMLButtonElement>('install-now'));
render();

// ここまで来たら起動成功（public/boot.js が見ている）
window.__appStarted = true;
