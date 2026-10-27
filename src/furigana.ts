// フリガナ（ルビ）表示のオンオフ。本文に「漢字《よみ》」の記法がある場面で、
// オンなら <ruby> で読みを添えて表示し、オフなら記法を取り除いた通常表示にする。
// 設定は読み上げ（narration.ts）と同じ仕組みで保存する。
import { load, save } from './storage';

let enabled = load('furigana', false);

export const isFuriganaOn = (): boolean => enabled;

export function setFurigana(on: boolean): void {
  enabled = on;
  save('furigana', on);
}
