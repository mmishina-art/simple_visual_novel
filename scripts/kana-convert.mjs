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
  ],
  'midnight-school': [[/明日/g, 'あした']],
  'moon-library': [[/最後の行に/g, 'さいごのぎょうに']],
  'missing-trophy': [[/施錠/g, 'せじょう'], [/磨き粉/g, 'みがきこ'], [/行われ/g, 'おこなわれ']],
  'stardust-station': [[/子守唄/g, 'こもりうた'], [/滲ん/g, 'にじん']],
  'cafe-tsubame': [[/床屋/g, 'とこや'], [/羽繕い/g, 'はづくろい']],
  'maou-diner': [[/干し茸/g, 'ほしきのこ'], [/閑古鳥/g, 'かんこどり'], [/明日/g, 'あした']],
  'yubisaki': [[/他愛/g, 'たあい']],
};
const applyAll = (t) =>
  [...READING_OVERRIDES, ...(RISKY_BY_STORY[STORY] ?? [])].reduce((x, [re, yomi]) => x.replace(re, yomi), t);

const src = readFileSync(`${REPO}/src/stories/${STORY}.ts`, 'utf8');
const nodes = {};
for (const m of src.matchAll(/id: '([a-z_0-9]+)'[^{]*?text: '([^']*)'/gs)) nodes[m[1]] = m[2];

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
