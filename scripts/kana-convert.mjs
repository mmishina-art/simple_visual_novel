// 『日曜日、井戸の底で』の本文を、kuromoji（IPADIC）の読みでかな化する試験用スクリプト。
// 既存の READING_OVERRIDES（人名・難読語の固定）を先に適用してから、漢字を含む
// トークンだけを辞書の読み（ひらがな）に置き換える。かな・記号・数字はそのまま。
import { readFileSync, writeFileSync } from 'node:fs';
import kuromoji from 'kuromoji';

const REPO = '/home/hatch/workspace/simple_visual_novel';
const STORY = process.argv[2] ?? 'sunday-well';

// build-narration.mjs の READING_OVERRIDES を取り出す（正本はそちら）
const buildSrc = readFileSync(`${REPO}/scripts/build-narration.mjs`, 'utf8');
const tableText = buildSrc.match(/const READING_OVERRIDES = \[([\s\S]*?)\];/)[1];
const READING_OVERRIDES = eval(`[${tableText}]`);
const applyReadings = (t) => READING_OVERRIDES.reduce((x, [re, yomi]) => x.replace(re, yomi), t);

// 物語テキストの抽出
const src = readFileSync(`${REPO}/src/stories/${STORY}.ts`, 'utf8');
const nodes = {};
for (const m of src.matchAll(/id: '([a-z_0-9]+)'[^{]*?text: '([^']*)'/gs)) nodes[m[1]] = m[2];

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: `${REPO}/node_modules/kuromoji/dict` }).build((err, t) => (err ? reject(err) : resolve(t)));
});
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const hasKanji = (s) => /[一-龥]/.test(s);

const out = {};
const review = [];
for (const [id, text] of Object.entries(nodes)) {
  const base = applyReadings(text);
  const tokens = tokenizer.tokenize(base);
  const kana = tokens.map((tok) => (hasKanji(tok.surface_form) && tok.reading ? kataToHira(tok.reading) : tok.surface_form)).join('');
  out[`${STORY}/${id}`] = kana;
  review.push(`### ${id}\n原文: ${text}\nかな: ${kana}\n`);
}
writeFileSync(`${REPO}/scripts/kana-texts.json`, JSON.stringify(out, null, 2) + '\n');
writeFileSync('/home/hatch/workspace/.kana-work/review.md', review.join('\n'));
console.log(`converted ${Object.keys(out).length} scenes`);
