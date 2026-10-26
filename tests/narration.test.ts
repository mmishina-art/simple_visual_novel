import { createHash } from 'node:crypto';
// かな化した読み上げ文（scripts/build-narration.mjs と同じ正）
const KANA_TEXTS: Record<string, string> = existsSync('scripts/kana-texts.json')
  ? (JSON.parse(readFileSync('scripts/kana-texts.json', 'utf8')) as Record<string, string>)
  : {};
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/stories';

// 読み上げ音声は事前生成（npm run narration）。文章を直したら生成し直す必要があるので、
// 全場面ぶんの音声がそろっていて、本文と一致しているかをここで照合する。
describe('読み上げ音声', () => {
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as Record<string, { hash: string }>;
  const hashOf = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 10);
  // 読み上げ専用の読み替えと、場面ごとの読み上げ文の差し替え
  // （scripts/build-narration.mjs と同じ表。両方そろえること）
  const SPOKEN_TEXT_OVERRIDES: Record<string, string> = {
    'midnight-school/blackout1': '次の瞬間、非常灯がすべて消えた。完全な暗闇の中で、背後に人の気配があった。',
    'midnight-school/choice_voice': '声が、もう一度、私の名前を呼んだ。',
    'midnight-school/answer2': 'そして、すぐ後ろで声がした。『みつけた』',
    'midnight-school/music4': '譜面台の上には、濡れた上履きが片方だけ置いてあった。サイズは私のものとよく似ていた。',
    'missing-trophy/start5': '写真部の同級生、潤がカメラを下げて駆けつけた。式まで、あと三時間。犯人捜し、手伝うよ。まず、どこから調べよう。',
    'missing-trophy/end_truth': '優勝杯の授与式。ステージの上で、優勝杯はスポットライトを受けて輝いた。事情を知るのは、私と潤と、部長だけ。部長の直した小さな傷跡は、優勝したクラスの、新しい歴史の始まりになった。',
    'stardust-station/locate2': '四十年かけて描いた大きな弧の果てに、船は帰り道の上にいた。まるで、ずっと帰ろうとしていたみたいに。',
    'cafe-tsubame/calm1': '嵐のような一日も、夕方が近づく頃には静かになった。社長はカウンターでうとうとしている。平和だ。平和が一番だ。',
    'cafe-tsubame/recipe2': '太麺をよく炒めて、ケチャップを寝かせて、最後に隠し味。運ばれた皿を見て、美食家の目がはっきりと見開かれた。これだ。この味だ。',
    'yubisaki/night3': 'ランプの橙の中で、彼は何度も「律子、律子」と私の名を呼んだ。そのたびに私は、若かった自分と今の自分が、ひとつの身体の中で重なっていくのを感じた。激しさよりも、確かさだった。求める手つきに迷いがなく、委ねることに怖さがなかった。雨はまだ降っていた。けれどこの部屋だけは、世界のどこよりも静かで、温かかった。',
  };
  const READING_OVERRIDES: [RegExp, string][] = [
    [/AI/g, 'エーアイ'],
    [/久瀬遥/g, 'くぜはるか'],
    [/篠宮 湊/g, 'しのみや みなと'],
    [/灰谷誠一/g, 'はいたにせいいち'],
    [/森下栞/g, 'もりしたしおり'],
    [/女将さん/g, 'おかみさん'],
    [/佐伯/g, 'さえき'],
    [/篠宮/g, 'しのみや'],
    [/高嶺/g, 'たかみね'],
    [/真由/g, 'まゆ'],
    [/誠一/g, 'せいいち'],
    [/律子/g, 'りつこ'],
    [/圭介/g, 'けいすけ'],
    [/遥/g, 'はるか'],
    [/湊/g, 'みなと'],
    [/栞/g, 'しおり'],
    [/潤/g, 'じゅん'],
    [/女将/g, 'おかみ'],
    [/儂/g, 'わし'],
    [/萎び/g, 'しなび'],
    [/帳場/g, 'ちょうば'],
    [/頷/g, 'うなず'],
    [/囁/g, 'ささや'],
    [/顎/g, 'あご'],
    [/覗/g, 'のぞ'],
    [/焚き火/g, 'たきび'],
    [/行き倒れ/g, 'いきたおれ'],
    [/椀/g, 'わん'],
    [/粥/g, 'かゆ'],
  [/軍手/g, 'ぐんて'],
  [/茹で/g, 'ゆで'],
  [/太麺/g, 'ふとめん'],
  [/河原/g, 'かわら'],
  ];
  const spokenText = (key: string, text: string): string =>
    READING_OVERRIDES.reduce((x, [re, yomi]) => x.replace(re, yomi), SPOKEN_TEXT_OVERRIDES[key] ?? text);
  // 物語ごとの語り手プロファイルの tag（scripts/build-narration.mjs の VOICE_PROFILES と合わせること）。
  // 声や後加工が違う本は、ハッシュに tag を混ぜて区別する
  const VOICE_PROFILE_TAGS: Record<string, string> = { 'sunday-well': 'g-mod3a', 'maou-diner': 'g-mod3a' };
  // 文ごとに分割して合成する場面（scripts/build-narration.mjs の CHUNKED_NARRATION と合わせること）
  const CHUNKED_NARRATION = new Set([
    'midnight-school/stairs2',
    'midnight-school/answer2',
    'midnight-school/entrance1',
    'midnight-school/music1',
    'moon-library/silent2',
    'missing-trophy/end_wrong',
    'missing-trophy/photo1',
    'sunday-well/nopre1',
    'sunday-well/down3',
    'sunday-well/climb_safe_a',
    'sunday-well/climb_safe_b',
    'sunday-well/sit_a',
    'maou-diner/hero2',
    'maou-diner/end_closed',
    'maou-diner/refuse1',
    'maou-diner/cook1',
    'maou-diner/truth2',
    'maou-diner/pro1',
    'maou-diner/end_taste',
    'yubisaki/visit1',
    'yubisaki/night3',
    'yubisaki/end_dream',
    'missing-trophy/end_truth',
    'yubisaki/past1',
    'sunday-well/start6',
  ]);
  const expectedHash = (key: string, text: string): string => {
    const spoken = KANA_TEXTS[key] ?? spokenText(key, text);
    const tag = VOICE_PROFILE_TAGS[key.split('/')[0]];
    const base = tag ? `${spoken}|${tag}` : spoken;
    return hashOf(CHUNKED_NARRATION.has(key) ? `${base}|chunked-v1` : base);
  };

  it('全作品・全場面ぶんの音声があり、本文と一致している', () => {
    for (const story of STORIES) {
      for (const node of Object.values(story.nodes)) {
        const key = `${story.id}/${node.id}`;
        expect(manifest[key], `${key} の音声が未生成（npm run narration）`).toBeDefined();
        expect(manifest[key].hash, `${key} の文章が音声と食い違っている（npm run narration で再生成）`).toBe(expectedHash(key, node.text));
        expect(existsSync(`public/audio/${key}.mp3`), `${key}.mp3 が無い`).toBe(true);
      }
    }
  });
});
