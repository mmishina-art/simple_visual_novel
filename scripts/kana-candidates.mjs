// 本ごとに、漢字を含む語と辞書の読みの一覧を出す（要注意語の選定用）。
import { readFileSync, writeFileSync } from 'node:fs';
import kuromoji from 'kuromoji';
const REPO = '/home/hatch/workspace/simple_visual_novel';
const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: `${REPO}/node_modules/kuromoji/dict` }).build((err, t) => (err ? reject(err) : resolve(t)));
});
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const stories = ['midnight-school', 'moon-library', 'missing-trophy', 'stardust-station', 'cafe-tsubame', 'maou-diner', 'yubisaki'];
let out = '';
for (const story of stories) {
  const src = readFileSync(`${REPO}/src/stories/${story}.ts`, 'utf8');
  const counts = new Map();
  for (const m of src.matchAll(/text: '([^']*)'/g)) {
    for (const tok of tokenizer.tokenize(m[1])) {
      if (/[一-龥]/.test(tok.surface_form) && tok.reading) {
        const key = `${tok.surface_form}（${kataToHira(tok.reading)}）${tok.pos_detail_1 === '固有名詞' ? ' [固]' : ''}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const items = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`);
  out += `\n## ${story}（${items.length}語）\n${items.join('、')}\n`;
}
writeFileSync('/home/hatch/workspace/.kana-work/candidates.md', out);
console.log('candidates written');
