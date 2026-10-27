// フリガナ（ルビ）表示のオンオフ。本文に「漢字《よみ》」の記法がある場面で、
// オンなら <ruby> で読みを添えて表示し、オフなら記法を取り除いた通常表示にする。
// 設定は読み上げ（narration.ts）と同じ仕組みで保存する。
// ルビは「初出だけ」：同じ語は作品の中で最初に出た場面でのみ読みを添え、
// 2回目以降は素の漢字だけにする（rubyTracker が作品単位で記録する）。
import { load, save } from './storage';
import { RubyFirstOnlyTracker } from './ruby';

let enabled = load('furigana', false);

export const isFuriganaOn = (): boolean => enabled;

export function setFurigana(on: boolean): void {
  enabled = on;
  save('furigana', on);
}

/** ルビの初出を作品単位で記録する共有トラッカー */
export const rubyTracker = new RubyFirstOnlyTracker();

/** 作品を開き直したら、初出の記録をリセットする */
export function resetRubyTracker(): void {
  rubyTracker.reset();
}
