// 読み上げ文の「部分かな化」試験用スクリプト。
// 全文かな化はイントネーションが不自然になるため、漢字は基本そのまま残し、
// (1) 既存の READING_OVERRIDES（人名・難読語）と (2) 下記の要注意語、
// (3) 固有名詞だけをかなに変える。表示文は変えない。
import { readFileSync, writeFileSync } from 'node:fs';
import kuromoji from 'kuromoji';

const REPO = '/home/hatch/workspace/simple_visual_novel';
const STORY = process.argv[2] ?? 'sunday-well';

const buildSrc = readFileSync(`${REPO}/scripts/build-narration.mjs`, 'utf8');
const tableText = buildSrc.match(/const READING_OVERRIDES = \[([\s\S]*?)\];/)[1];
const READING_OVERRIDES = eval(`[${tableText}]`);

// この本で読みが揺れる語（前もってかなで固定する）
const RISKY_OVERRIDES = [
  [/十日/g, 'とおか'],
  [/一編/g, 'いっぺん'],
  [/洗濯物/g, 'せんたくもの'],
  [/滲み/g, 'にじみ'],
  [/三日/g, 'みっか'],
  [/一番上/g, 'いちばんうえ'],
];
const applyAll = (t) => [...READING_OVERRIDES, ...RISKY_OVERRIDES].reduce((x, [re, yomi]) => x.replace(re, yomi), t);

const src = readFileSync(`${REPO}/src/stories/${STORY}.ts`, 'utf8');
const nodes = {};
for (const m of src.matchAll(/id: '([a-z_0-9]+)'[^{]*?text: '([^']*)'/gs)) nodes[m[1]] = m[2];

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: `${REPO}/node_modules/kuromoji/dict` }).build((err, t) => (err ? reject(err) : resolve(t)));
});
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

const out = {};
const review = [];
for (const [id, text] of Object.entries(nodes)) {
  const base = applyAll(text);
  const tokens = tokenizer.tokenize(base);
  const spoken = tokens
    .map((tok) => (tok.pos === '名詞' && tok.pos_detail_1 === '固有名詞' && tok.reading ? kataToHira(tok.reading) : tok.surface_form))
    .join('');
  // かな化で何も変わらない場面は登録しない（従来どおりの読み上げにする）
  if (spoken !== text) out[`${STORY}/${id}`] = spoken;
  review.push(`### ${id}\n原文: ${text}\n部分: ${spoken}\n`);
}
writeFileSync(`${REPO}/scripts/kana-texts.json`, JSON.stringify(out, null, 2) + '\n');
writeFileSync('/home/hatch/workspace/.kana-work/review-partial.md', review.join('\n'));
console.log(`partial-kana scenes: ${Object.keys(out).length} / ${Object.keys(nodes).length}`);
