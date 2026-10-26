// サウンドノベルのエンジン。ルール・進行は DOM に触れない純関数にして、tests/ で単体テストする。
// シナリオのデータは src/stories/ に分けて置く（このファイルはデータを持たない）。

/** 背景イラストの種類（src/assets/scenes/ の SVG と対応する） */
export type SceneBg = 'classroom' | 'corridor' | 'stairs' | 'music' | 'entrance' | 'dark' | 'outside' | 'library' | 'trophy' | 'libraryhall' | 'station' | 'diner';

/** 場面で鳴らす音の種類（src/sound.ts の合成音と対応する） */
export type SceneSound = 'rain' | 'phone' | 'steps' | 'piano' | 'chime' | 'knock' | 'door' | 'thunder' | 'whisper' | 'beep' | 'bell';

export interface Choice {
  label: string;
  /** 遷移先のノード ID */
  to: string;
  /** このフラグを持っているときだけ、to の代わりに遷移する先（例: 懐中電灯を持っていると逃げ切れる） */
  toIfFlag?: { flag: string; to: string };
  /** この選択をしたときに付くフラグ */
  set?: string[];
}

export interface StoryNode {
  id: string;
  bg?: SceneBg;
  se?: SceneSound;
  /** 話者名（地の文は省略） */
  speaker?: string;
  text: string;
  /** このノードに入ったときに付くフラグ */
  set?: string[];
  /** 次のノード ID（choices / ending があるノードには付けない） */
  next?: string;
  choices?: Choice[];
  ending?: { kind: 'happy' | 'bad'; title: string };
}

export interface Story {
  id: string;
  title: string;
  description: string;
  /** 読了の目安（例: '5〜10分'） */
  length: string;
  /** 本棚で表紙に使う背景（省略時は 'classroom'） */
  cover?: SceneBg;
  /** 表紙の帯の色・形（省略時は 'red'） */
  coverObi?: 'red' | 'cream' | 'navy' | 'silver' | 'orange';
  /** 表紙の題字の改行位置（言葉の途中では切らない）。連結すると title と一致すること */
  coverLines?: string[];
  /** 題字の置き方。絵の落ち着いた場所に合わせて選ぶ（通常は右上の縦書き） */
  coverTitleLayout?: 'vertical' | 'horizontal' | 'window';
  /** BGM のテーマ（省略時は 'horror'） */
  bgm?: 'horror' | 'romance' | 'mystery' | 'sf' | 'comedy';
  /** 表紙の色調（省略時は 'dark'）。明るい絵には 'light' */
  coverTone?: 'dark' | 'light';
  start: string;
  nodes: Record<string, StoryNode>;
}

export interface Checkpoint {
  nodeId: string;
  flags: string[];
}

export interface PlayState {
  storyId: string;
  nodeId: string;
  flags: string[];
  /** 直近の選択肢ノードと、その時点のフラグ（バッドエンドからやり直すために使う） */
  checkpoint: Checkpoint | null;
}

const withFlags = (flags: string[], add?: string[]): string[] => {
  if (!add?.length) return flags;
  const next = [...flags];
  for (const f of add) if (!next.includes(f)) next.push(f);
  return next;
};

/** ノードに入る（フラグを付け、選択肢ノードならチェックポイントを記録する） */
function enter(story: Story, nodeId: string, flags: string[], checkpoint: Checkpoint | null): PlayState {
  const node = story.nodes[nodeId];
  if (!node) throw new Error(`ノードがありません: ${nodeId}`);
  const entered = withFlags(flags, node.set);
  return {
    storyId: story.id,
    nodeId,
    flags: entered,
    checkpoint: node.choices ? { nodeId, flags: entered } : checkpoint,
  };
}

export function startState(story: Story): PlayState {
  return enter(story, story.start, [], null);
}

export function nodeOf(story: Story, state: PlayState): StoryNode {
  const node = story.nodes[state.nodeId];
  if (!node) throw new Error(`ノードがありません: ${state.nodeId}`);
  return node;
}

export const isEnding = (story: Story, state: PlayState): boolean => !!nodeOf(story, state).ending;
export const hasFlag = (state: PlayState, flag: string): boolean => state.flags.includes(flag);

/** 本文を1つ進める。選択肢ノードとエンディングでは動かない。 */
export function advance(story: Story, state: PlayState): PlayState {
  const node = nodeOf(story, state);
  if (node.choices || node.ending || !node.next) return state;
  return enter(story, node.next, state.flags, state.checkpoint);
}

/** 選択肢を選ぶ。toIfFlag の条件を満たせばそちらへ進む。 */
export function choose(story: Story, state: PlayState, index: number): PlayState {
  const node = nodeOf(story, state);
  const choice = node.choices?.[index];
  if (!choice) return state;
  const flags = withFlags(state.flags, choice.set);
  const to = choice.toIfFlag && flags.includes(choice.toIfFlag.flag) ? choice.toIfFlag.to : choice.to;
  return enter(story, to, flags, state.checkpoint);
}

/** 最後の選択肢まで戻る（バッドエンドのやり直し用）。チェックポイントがなければ先頭から。 */
export function backToCheckpoint(story: Story, state: PlayState): PlayState {
  if (!state.checkpoint) return startState(story);
  return enter(story, state.checkpoint.nodeId, [...state.checkpoint.flags], state.checkpoint);
}

/** このデータで到達できるエンディングの一覧 */
export function endingsOf(story: Story): StoryNode[] {
  return Object.values(story.nodes).filter((n) => n.ending);
}

/**
 * シナリオデータの検証。問題があれば日本語の理由を返す（空なら正常）。
 * 作品を足したときに、リンク切れや到達できない場面に気づけるようにする。
 */
export function validateStory(story: Story): string[] {
  const coverErrors: string[] = [];
  if (story.coverLines && story.coverLines.join('') !== story.title) {
    coverErrors.push(`coverLines をつなげると題名と一致しません: ${story.id}`);
  }
  const errors: string[] = [...coverErrors];
  const ids = new Set(Object.keys(story.nodes));
  if (!ids.has(story.start)) errors.push(`開始ノードがありません: ${story.start}`);
  for (const node of Object.values(story.nodes)) {
    if (node.next && !ids.has(node.next)) errors.push(`${node.id} の next が存在しません: ${node.next}`);
    if (!node.next && !node.choices && !node.ending) errors.push(`${node.id} に next / choices / ending がありません`);
    for (const c of node.choices ?? []) {
      if (!ids.has(c.to)) errors.push(`${node.id} の選択肢の遷移先が存在しません: ${c.to}`);
      if (c.toIfFlag && !ids.has(c.toIfFlag.to)) errors.push(`${node.id} の選択肢の条件分岐先が存在しません: ${c.toIfFlag.to}`);
    }
  }
  // 到達可能性（開始ノードからの幅優先探索）
  if (ids.has(story.start)) {
    const seen = new Set<string>([story.start]);
    const queue = [story.start];
    while (queue.length) {
      const node = story.nodes[queue.shift()!];
      const tos = [node.next, ...(node.choices ?? []).flatMap((c) => [c.to, c.toIfFlag?.to])].filter(
        (t): t is string => !!t,
      );
      for (const t of tos) if (ids.has(t) && !seen.has(t)) { seen.add(t); queue.push(t); }
    }
    for (const id of ids) if (!seen.has(id)) errors.push(`到達できないノードがあります: ${id}`);
    const reached = [...seen].map((id) => story.nodes[id]).filter((n) => n?.ending);
    if (!reached.some((n) => n.ending?.kind === 'happy')) errors.push('ハッピーエンドに到達できません');
    if (!reached.some((n) => n.ending?.kind === 'bad')) errors.push('バッドエンドに到達できません');
  }
  return errors;
}
