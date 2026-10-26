// 背景イラストの登録はここだけ。新しい絵を足すときは、
// src/assets/scenes/ に SVG を置いて、import と SCENES への1行を足す。
// 種類（SceneBg）は SCENES のキーから自動で決まるので、他のファイルの型定義は触らなくてよい。
import classroom from './assets/scenes/classroom.svg';
import corridor from './assets/scenes/corridor.svg';
import stairs from './assets/scenes/stairs.svg';
import music from './assets/scenes/music.svg';
import entrance from './assets/scenes/entrance.svg';
import dark from './assets/scenes/dark.svg';
import outside from './assets/scenes/outside.svg';
import library from './assets/scenes/library.svg';
import trophy from './assets/scenes/trophy.svg';
import archlibrary from './assets/scenes/archlibrary.svg';
import station from './assets/scenes/station.svg';
import diner from './assets/scenes/diner.svg';
import well from './assets/scenes/well.svg';

export const SCENES = {
  classroom,
  corridor,
  stairs,
  music,
  entrance,
  dark,
  outside,
  library,
  trophy,
  archlibrary,
  station,
  diner,
  well,
} as const;

/** 背景イラストの種類（SCENES に登録した名前そのまま） */
export type SceneBg = keyof typeof SCENES;
