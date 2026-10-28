// 読み上げ文の「部分かな化」スクリプト。
// 全文かな化はイントネーションが不自然になるため、漢字は基本そのまま残し、
// (1) 既存の READING_OVERRIDES（人名・難読語）、(2) 本ごとの要注意語、
// (3) 固有名詞だけをかなに変える。表示文は変えない。
// 使い方: node scripts/kana-convert.mjs <story-id>（kana-texts.json の当該冊を更新）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import kuromoji from 'kuromoji';

const REPO = '/home/hatch/workspace/simple_visual_novel';
const STORY = process.argv[2];
if (!STORY) throw new Error('story id required');

const buildSrc = readFileSync(`${REPO}/scripts/build-narration.mjs`, 'utf8');
const tableText = buildSrc.match(/const READING_OVERRIDES = \[([\s\S]*?)\];/)[1];
const READING_OVERRIDES = eval(`[${tableText}]`);

// 本ごとに読みが揺れる語（文脈を確認して選んだものだけをかなで固定する）
const RISKY_BY_STORY = {
  'sunday-well': [
    [/十日/g, 'とおか'], [/一編/g, 'いっぺん'], [/洗濯物/g, 'せんたくもの'],
    [/滲み/g, 'にじみ'], [/三日/g, 'みっか'], [/一番上/g, 'いちばんうえ'],
    // 縁はこの作品では井戸の縁（ふち）の1箇所だけ。一文字は「字を一文字もらう」の いちもじ
    [/縁/g, 'ふち'], [/一文字/g, 'いちもじ'],
  ],
  'midnight-school': [
    [/明日/g, 'あした'],
    // ユーザー実機指摘（2026-10-28）: 「3年2組」を ふたくみ、私を わたくし と読む回の音声があった
    [/3年2組/g, 'さんねんにくみ'], [/私たち/g, 'わたしたち'], [/私/g, 'わたし'],
  ],
  'moon-library': [[/最後の行に/g, 'さいごのぎょうに'], [/一冊/g, 'いっさつ'], [/一本/g, 'いっぽん']],
  'missing-trophy': [[/施錠/g, 'せじょう'], [/磨き粉/g, 'みがきこ'], [/行われ/g, 'おこなわれ'],
    [/三十分/g, 'さんじゅっぷん']],
  'stardust-station': [[/子守唄/g, 'こもりうた'], [/滲ん/g, 'にじん']],
  // 十分後は時間（じっぷんご）。三軒は さんげん
  'cafe-tsubame': [[/床屋/g, 'とこや'], [/羽繕い/g, 'はづくろい'],
    [/十分後/g, 'じっぷんご'], [/三軒/g, 'さんげん']],
  // 戦（単独）=いくさ、額=ひたい、角=つの、被った=かぶった は、この作品では全出現が
  // 同じ文脈読み（2026-10-28 ユーザー実機指摘。エンジン既定は セン／ガク／カド／コオム）
  'maou-diner': [[/干し茸/g, 'ほしきのこ'], [/閑古鳥/g, 'かんこどり'], [/明日/g, 'あした'],
    [/(^|[^一-龥々])戦が/g, '$1いくさが'], [/(^|[^一-龥々])戦の/g, '$1いくさの'],
    [/額/g, 'ひたい'], [/角/g, 'つの'], [/被った/g, 'かぶった']],
  // 三分後・四十分は時間の読み（さんぷんご／よんじゅっぷん）。「それで十分だった」の
  // 十分（じゅうぶん）には触れないよう、語を限定する
  'yubisaki': [[/他愛/g, 'たあい'], [/三分後/g, 'さんぷんご'], [/四十分/g, 'よんじゅっぷん']],
};
const applyAll = (t) =>
  [...READING_OVERRIDES, ...(RISKY_BY_STORY[STORY] ?? [])].reduce((x, [re, yomi]) => x.replace(re, yomi), t);

const src = readFileSync(`${REPO}/src/stories/${STORY}.ts`, 'utf8');
const nodes = {};
// フリガナ記法「漢字《よみ》」は表示専用。かな化の対象は記法を取り除いた本文にする
const stripRuby = (t) => t.replace(/｜([^《]*)《[^》]*》/g, '$1').replace(/《[^》]*》/g, '');
for (const m of src.matchAll(/id: '([a-z_0-9]+)'[^{]*?text: '([^']*)'/gs)) nodes[m[1]] = stripRuby(m[2]);

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: `${REPO}/node_modules/kuromoji/dict` }).build((err, t) => (err ? reject(err) : resolve(t)));
});
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

const jsonPath = `${REPO}/scripts/kana-texts.json`;
const all = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : {};
for (const key of Object.keys(all)) if (key.startsWith(`${STORY}/`)) delete all[key];
let count = 0;
for (const [id, text] of Object.entries(nodes)) {
  const base = applyAll(text);
  const tokens = tokenizer.tokenize(base);
  const spoken = tokens
    .map((tok) =>
      tok.pos === '名詞' && tok.pos_detail_1 === '固有名詞' && tok.reading && /[一-龥]/.test(tok.surface_form)
        ? kataToHira(tok.reading)
        : tok.surface_form,
    )
    .join('');
  if (spoken !== text) {
    all[`${STORY}/${id}`] = spoken;
    count++;
  }
}
writeFileSync(jsonPath, JSON.stringify(all, null, 2) + '\n');
console.log(`${STORY}: partial-kana scenes ${count} / ${Object.keys(nodes).length}`);
