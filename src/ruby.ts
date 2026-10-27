// フリガナ（ルビ）の記法と変換。
// 物語の本文には、青空文庫式に「漢字《よみ》」と書ける。表示側（main.ts）が
// <ruby> に変換し、読み上げ側（scripts/build-narration.mjs）は記法を取り除いて使う。
// 記法の付いていない本文は、そのまま（従来通り）扱われる。
//
// 対応する書き方:
//   久瀬遥《くぜはるか》   … 直前の漢字の並び（漢字・々・〆など）が対象
//   ｜午前0時《ごぜんれいじ》 … ｜（全角縦線）で対象の始まりを明示した場合は、
//                              ｜から《までのすべてが対象（漢字以外を含んでもよい）
// 《》が漢字の直後でない場合や、対応する《》が無い場合は、記法として扱わずそのまま出す。

export interface RubyPart {
  text: string;
  ruby?: string;
}

const KANJI = /[一-龥々〆ヵヶ]/;

/** 本文を「通常の文字列」と「ルビ付き」の部分に分ける */
export function parseRuby(text: string): RubyPart[] {
  const parts: RubyPart[] = [];
  let plain = '';
  const flush = (): void => {
    if (plain) {
      parts.push({ text: plain });
      plain = '';
    }
  };
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('《', i);
    if (open === -1) {
      plain += text.slice(i);
      break;
    }
    const close = text.indexOf('》', open + 1);
    if (close === -1) {
      plain += text.slice(i);
      break;
    }
    const yomi = text.slice(open + 1, close);
    const before = plain + text.slice(i, open);
    // ｜で明示された範囲が優先。無ければ、直前の漢字の並びが対象
    let baseStart = -1;
    const bar = before.lastIndexOf('｜');
    if (bar !== -1 && bar < before.length - 0 && !/[《》]/.test(before.slice(bar + 1))) {
      baseStart = bar;
    } else {
      let j = before.length;
      while (j > 0 && KANJI.test(before[j - 1])) j--;
      if (j < before.length) baseStart = j;
    }
    if (baseStart === -1 || yomi.length === 0) {
      // 記法として成立しない《》は、そのまま文字として出す
      plain = before + text.slice(open, close + 1);
      i = close + 1;
      continue;
    }
    const head = before.slice(0, baseStart);
    const base = before.slice(baseStart).replace(/^｜/, '');
    plain = head;
    flush();
    parts.push({ text: base, ruby: yomi });
    plain = '';
    i = close + 1;
  }
  flush();
  return parts;
}

/** ルビ記法を取り除き、対象の漢字だけを残した素の本文を返す（読み上げ・照合用） */
export function stripRuby(text: string): string {
  return parseRuby(text)
    .map((p) => p.text)
    .join('');
}

/** ルビ記法を含んでいるか */
export function hasRuby(text: string): boolean {
  return parseRuby(text).some((p) => p.ruby !== undefined);
}

/**
 * ルビを「初出だけ」にするための記録。一般の小説の慣例に合わせ、同じ語
 * （対象の文字列＋読みの組）は、作品の中で最初に表示した場面でのみルビ付きにし、
 * それ以降の場面では素の漢字だけにする。
 *
 * 場面（context）ごとに安定させるのが肝心で、同じ場面を再表示しても
 * （再描画・設定の切り替え・読み返しなど）結果が変わらない。
 * 作品を開き直したら reset() して、また初出から数え直す。
 */
export class RubyFirstOnlyTracker {
  private firstContextByKey = new Map<string, string>();

  reset(): void {
    this.firstContextByKey.clear();
  }

  /**
   * その部分をルビ付きで表示するか。
   * context: 場面の識別子（場面ID）。同じ場面なら常に同じ値を渡すこと
   * occurrence: その場面の本文の中で、同じ語が何回目に出てきたか（0始まり）。
   *   初出の場面でも、2回目以降はルビを付けない
   */
  shouldShow(part: RubyPart, context: string, occurrence: number): boolean {
    if (!part.ruby) return false;
    const key = `${part.text}《${part.ruby}》`;
    const first = this.firstContextByKey.get(key);
    if (first === undefined) {
      this.firstContextByKey.set(key, context);
    } else if (first !== context) {
      return false;
    }
    return occurrence === 0;
  }
}
