// 作品の一覧。作品を足すときは、src/stories/ にファイルを増やして、ここに登録する。
// 将来の「本棚」形式の作品選択画面は、この一覧をもとに作る想定。
import type { Story } from '../logic';
import { midnightSchool } from './midnight-school';
import { missingTrophy } from './missing-trophy';
import { moonLibrary } from './moon-library';

export const STORIES: Story[] = [midnightSchool, moonLibrary, missingTrophy];

export const storyById = (id: string): Story | undefined => STORIES.find((s) => s.id === id);
