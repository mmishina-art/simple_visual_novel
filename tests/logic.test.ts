import { describe, expect, it } from 'vitest';
import {
  advance, backToCheckpoint, choose, endingsOf, hasFlag, nodeOf, startState, validateStory,
  type PlayState, type Story,
} from '../src/logic';
import { midnightSchool } from '../src/stories/midnight-school';

const story = midnightSchool;

/** 選択肢に着くまで進める（最大 steps 回） */
function walkToChoice(state: PlayState): PlayState {
  let s = state;
  for (let i = 0; i < 60 && !nodeOf(story, s).choices && !nodeOf(story, s).ending; i++) s = advance(story, s);
  return s;
}

/** ラベルの一部で選択肢を選びながら、結末まで進める */
function play(choicesInOrder: string[]): PlayState {
  let s = startState(story);
  const queue = [...choicesInOrder];
  for (let i = 0; i < 200; i++) {
    const node = nodeOf(story, s);
    if (node.ending) return s;
    if (node.choices) {
      const label = queue.shift();
      const idx = label === undefined ? 0 : node.choices.findIndex((c) => c.label.includes(label));
      if (idx < 0) throw new Error(`選択肢が見つからない: ${label}（現在: ${node.id}）`);
      s = choose(story, s, idx);
    } else {
      s = advance(story, s);
    }
  }
  throw new Error('結末に着かなかった');
}

describe('進行', () => {
  it('開始ノードから始まり、タップで次へ進む', () => {
    const s = startState(story);
    expect(s.nodeId).toBe(story.start);
    expect(advance(story, s).nodeId).toBe('start2');
  });

  it('選択肢ノードでは advance しても進まない', () => {
    const s = walkToChoice(startState(story));
    expect(nodeOf(story, s).choices).toBeTruthy();
    expect(advance(story, s)).toBe(s);
  });

  it('選択肢のあるノードがチェックポイントになる', () => {
    const s = walkToChoice(startState(story));
    expect(s.checkpoint?.nodeId).toBe(s.nodeId);
  });
});

describe('フラグと分岐', () => {
  it('懐中電灯を持っていくとフラグが付き、持たなければ付かない', () => {
    const withLight = play(['懐中電灯']);
    expect(hasFlag(withLight, 'flashlight')).toBe(true);
    const without = play(['そのまま出る']);
    expect(hasFlag(without, 'flashlight')).toBe(false);
  });

  it('懐中電灯なしで裏口へ走ると捕まり、ありだと逃げ切れる', () => {
    const dark = play(['そのまま出る', '急ぐ', '返事をせず', '裏口へ走る']);
    expect(nodeOf(story, dark).ending?.kind).toBe('bad');
    const light = play(['懐中電灯', '急ぐ', '返事をせず', '裏口へ走る']);
    expect(nodeOf(story, light).ending?.kind).toBe('happy');
  });
});

describe('結末', () => {
  it('名前への返事でバッドエンドになる', () => {
    const s = play(['懐中電灯', '音楽室', '返事をする']);
    expect(nodeOf(story, s).id).toBe('end_voice');
    expect(nodeOf(story, s).ending?.kind).toBe('bad');
  });

  it('音楽室で手がかりを得て正しく選ぶとハッピーエンドになる', () => {
    const s = play(['懐中電灯', '音楽室', '返事をせず', '裏口へ走る']);
    expect(nodeOf(story, s).id).toBe('end_happy');
    expect(nodeOf(story, s).ending?.kind).toBe('happy');
  });

  it('振り返るとバッドエンドになる', () => {
    const s = play(['懐中電灯', '音楽室', '返事をせず', '振り返って']);
    expect(nodeOf(story, s).id).toBe('end_caught');
  });

  it('バッドエンドから最後の選択肢へ戻れる（フラグもその時点に戻る）', () => {
    const bad = play(['懐中電灯', '音楽室', '返事をする']);
    const back = backToCheckpoint(story, bad);
    expect(back.nodeId).toBe('choice_voice');
    expect(hasFlag(back, 'flashlight')).toBe(true);
    // 戻ったあとは選び直して先へ進める
    let s = back;
    s = choose(story, s, 1);
    expect(s.nodeId).toBe('silent1');
  });

  it('結末は全3通り（ハッピー1・バッド2）', () => {
    const ends = endingsOf(story);
    expect(ends).toHaveLength(3);
    expect(ends.filter((n) => n.ending?.kind === 'happy')).toHaveLength(1);
    expect(ends.filter((n) => n.ending?.kind === 'bad')).toHaveLength(2);
  });
});

describe('シナリオデータの検証', () => {
  it('『午前0時の校舎』にリンク切れや到達できない場面がない', () => {
    expect(validateStory(story)).toEqual([]);
  });

  it('選択肢は4か所ある', () => {
    const choices = Object.values(story.nodes).filter((n) => n.choices);
    expect(choices).toHaveLength(4);
  });

  it('壊れたデータ（遷移先がない）は検出できる', () => {
    const broken: Story = {
      ...story,
      nodes: { a: { id: 'a', text: 'x', next: 'missing' } },
      start: 'a',
    };
    expect(validateStory(broken).length).toBeGreaterThan(0);
  });
});
