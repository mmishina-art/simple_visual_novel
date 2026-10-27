import { beforeEach, describe, expect, it, vi } from 'vitest';

// narration.ts は読み込み時に保存値を読むので、localStorage を差し替えて
// モジュールを読み直しながら、保存と復元を確認する
function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

const SPEED_KEY = () => `${__APP_ID__}-narration-speed`;

async function freshNarration() {
  vi.resetModules();
  return import('../src/narration');
}

describe('朗読の速度', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it('初期値は 1.0 倍で、候補は 0.8 / 1 / 1.25 / 1.5 / 2', async () => {
    const n = await freshNarration();
    expect(n.NARRATION_SPEEDS).toEqual([0.8, 1, 1.25, 1.5, 2]);
    expect(n.getNarrationSpeed()).toBe(1);
  });

  it('表示は「1.0x」「1.25x」の形にする', async () => {
    const n = await freshNarration();
    expect(n.formatNarrationSpeed(0.8)).toBe('0.8x');
    expect(n.formatNarrationSpeed(1)).toBe('1.0x');
    expect(n.formatNarrationSpeed(1.25)).toBe('1.25x');
    expect(n.formatNarrationSpeed(1.5)).toBe('1.5x');
    expect(n.formatNarrationSpeed(2)).toBe('2.0x');
    expect(n.formatNarrationSpeed()).toBe('1.0x');
  });

  it('切り替えると候補を順に進み、一番速い次は一番遅いに戻る', async () => {
    const n = await freshNarration();
    expect(n.cycleNarrationSpeed()).toBe(1.25);
    expect(n.cycleNarrationSpeed()).toBe(1.5);
    expect(n.cycleNarrationSpeed()).toBe(2);
    expect(n.cycleNarrationSpeed()).toBe(0.8);
    expect(n.cycleNarrationSpeed()).toBe(1);
    expect(n.getNarrationSpeed()).toBe(1);
  });

  it('設定した速度は保存され、読み直すと復元される', async () => {
    const store = stubLocalStorage();
    const n = await freshNarration();
    n.setNarrationSpeed(1.5);
    expect(store.get(SPEED_KEY())).toBe('1.5');
    const again = await freshNarration();
    expect(again.getNarrationSpeed()).toBe(1.5);
    expect(again.formatNarrationSpeed()).toBe('1.5x');
  });

  it('候補にない保存値は、1.0 倍に戻す', async () => {
    const store = stubLocalStorage();
    store.set(SPEED_KEY(), '3');
    const n = await freshNarration();
    expect(n.getNarrationSpeed()).toBe(1);
  });
});
