// 作品の一覧。作品を足すときは、src/stories/ にファイルを増やして、ここに登録する。
// 将来の「本棚」形式の作品選択画面は、この一覧をもとに作る想定。
import type { Story } from '../logic';
import { midnightSchool } from './midnight-school';
import { missingTrophy } from './missing-trophy';
import { moonLibrary } from './moon-library';

export const STORIES: Story[] = [midnightSchool, moonLibrary, missingTrophy];

export const storyById = (id: string): Story | undefined => STORIES.find((s) => s.id === id);

/** 本棚に並べるだけのダミー（近日公開）。開くことはできない、表示専用の本 */
export interface DummyBook {
  title: string;
  description: string;
  length: string;
  cover: 'classroom' | 'corridor' | 'stairs' | 'music' | 'entrance' | 'dark' | 'outside';
}

export const COMING_SOON: DummyBook[] = [
  {
    title: '終電のいない駅',
    description: '終電を逃した夜、ホームの時計だけが逆に進んでいた。',
    length: '10〜15分',
    cover: 'outside',
  },
  {
    title: '音楽室の肖像画',
    description: '誰もいない音楽室から、毎夜ピアノの音がする。',
    length: '5〜10分',
    cover: 'music',
  },
  {
    title: '三階踊り場の鏡',
    description: '踊り場の鏡には、一段だけ段数の多い階段が映る。',
    length: '約10分',
    cover: 'stairs',
  },
];
