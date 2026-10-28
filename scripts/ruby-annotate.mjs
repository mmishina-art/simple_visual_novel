// 表示文へのフリガナ（ルビ）一括付与スクリプト。
// 対象の作品ファイルの全場面の本文に、青空文庫式「漢字《よみ》」記法を付ける。
// 読みの正は、読み上げ用かな修正（scripts/kana-texts.json、scripts/kana-convert.mjs の
// 読み替え表）と一致させる。人名・難読語・文脈依存の語は OVERRIDES で固定し、
// それ以外は kuromoji の読みを使う（動詞・形容詞は語幹だけに付ける）。
// 使い方: node scripts/ruby-annotate.mjs <story-id> [--write]
//   --write を付けないときは、付与結果と読み一覧を表示するだけ（ファイルは変えない）。
import { readFileSync, writeFileSync } from 'node:fs';
import kuromoji from 'kuromoji';

const REPO = '/home/hatch/workspace/simple_visual_novel';
const STORY = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!STORY) throw new Error('story id required');

// 手動の読み指定。[surface, reading] は surface 全体に、[surface, base, reading] は
// 先頭の base（漢字部分）だけにルビを付け、残りはそのまま出す。
// 優先順位: 場面別 > 作品別 > 共通。長い surface を先に照合する。
const COMMON = [
  ['私たち', 'わたしたち'], ['私', 'わたし'],
  ['何人', 'なんにん'], ['何度', 'なんど'], ['何か', 'なにか'], ['何も', '何', 'なに'], ['何を', '何', 'なに'],
  ['一人', 'ひとり'], ['二人', 'ふたり'], ['三人', 'さんにん'],
  ['二日', 'ふつか'], ['三日', 'みっか'], ['四日', 'よっか'], ['五日', 'いつか'], ['六日', 'むいか'],
  ['七日', 'なのか'], ['八日', 'ようか'], ['九日', 'ここのか'], ['十日', 'とおか'], ['二十日', 'はつか'],
  ['今朝', 'けさ'], ['今夜', 'こんや'],
  ['大人', 'おとな'], ['誕生日', 'たんじょうび'],
  ['短編集', 'たんぺんしゅう'], ['短編', 'たんぺん'], ['一文字', 'いちもじ'],
  ['失く', '失', 'な'], ['失い', '失', 'な'],
  ['真っ直ぐ', 'まっすぐ'], ['真っ白', 'まっしろ'], ['真っ暗', 'まっくら'], ['真っ先', 'まっさき'],
];
const BY_STORY = {
  'moon-library': [
    ['森下栞', 'もりしたしおり'], ['篠宮湊', 'しのみやみなと'], ['篠宮 湊', 'しのみやみなと'],
    ['篠宮', 'しのみや'], ['湊', 'みなと'], ['栞', 'しおり'],
  ],
  'missing-trophy': [
    ['高嶺', 'たかみね'], ['潤', 'じゅん'], ['施錠', 'せじょう'],
    ['磨き粉', 'みがきこ'], ['行われ', '行', 'おこな'], ['行う', '行', 'おこな'],
  ],
  'stardust-station': [
    ['子守唄', 'こもりうた'],
  ],
  'cafe-tsubame': [
    ['床屋', 'とこや'], ['羽繕い', '羽繕', 'はづくろ'], ['羽繕', 'はづくろ'], ['囁', 'ささや'], ['太麺', 'ふとめん'],
  ],
  'yubisaki': [
    ['帳場', 'ちょうば'], ['圭介', 'けいすけ'], ['律子', 'りつこ'], ['河原', 'かわら'], ['他愛', 'たあい'],
  ],
  'sunday-well': [
    ['真由', 'まゆ'], ['十日', 'とおか'], ['一編', 'いっぺん'], ['洗濯物', 'せんたくもの'],
    ['滲み', '滲', 'にじ'], ['滲ん', '滲', 'にじ'], ['三日', 'みっか'], ['一番上', 'いちばんうえ'],
    ['軍手', 'ぐんて'], ['茹で', '茹', 'ゆ'], ['茹', 'ゆで'], ['萎び', '萎', 'しな'], ['覗', 'のぞ'], ['顎', 'あご'],
  ],
  'maou-diner': [
    ['灰谷誠一', 'はいたにせいいち'], ['誠一', 'せいいち'], ['女将さん', 'おかみさん'], ['女将', 'おかみ'],
    ['椀', 'わん'], ['行き倒れ', 'いきたおれ'], ['頷', 'うなず'], ['閑古鳥', 'かんこどり'],
    ['干し茸', 'ほしきのこ'], ['粥', 'かゆ'], ['儂', 'わし'], ['焚き火', 'たきび'], ['明日', 'あした'],
    ['二十歳', 'はたち'], ['三日月型', 'みかづきがた'], ['三日月', 'みかづき'],
    ['戦が', '戦', 'たたか'], ['戦の', '戦', 'たたか'],
  ],
};
const BY_SCENE = {
  'moon-library/end_happy': [['最後の行', '行', 'ぎょう']],
  // 井戸の縁（ふち）。他の場面の「縁」は人間関係の えん なので場面で固定する
  'sunday-well/start6': [['縁', 'ふち']],
  // 「二人の間に」「ページの間」の 間 は あいだ（他の本の「瞬間」などに埋もれないよう場面で固定）
  'maou-diner/last2': [['間に', '間', 'あいだ']],
  'moon-library/start2': [['間から', '間', 'あいだ']],
  'yubisaki/end_happy': [['間に', '間', 'あいだ']],
  // 「ケースの中が空だった」の 空 は から（空っぽ）
  'missing-trophy/start2': [['空だ', '空', 'から']],
};

const KANJI_RE = /[一-龥々〆]/;
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji.builder({ dicPath: `${REPO}/node_modules/kuromoji/dict` }).build((err, t) => (err ? reject(err) : resolve(t)));
});

// 出力の組み立て。前の文字が漢字（未区切り）なら ｜ で範囲を明示する
class Emitter {
  constructor() { this.out = ''; this.prevKanji = false; }
  plain(s) {
    this.out += s;
    if (s) this.prevKanji = KANJI_RE.test(s[s.length - 1]);
  }
  ruby(base, reading) {
    // base 全体にルビ。前が漢字で連続しているときと、base に漢字以外を含むときは ｜ 形式
    const needBar = this.prevKanji || /[^一-龥々〆]/.test(base);
    this.out += `${needBar ? '｜' : ''}${base}《${reading}》`;
    this.prevKanji = false;
  }
}

const stats = { total: 0, byScene: {} };
const pairs = new Map(); // base《reading》 -> count
const noReading = [];

// 数字の並び（三十六歳・十七年・午前十時など）は、kuromoji が1字ずつに割るので
// 助数詞までを1つのルビ単位にまとめる。読みは各トークンの読みの連結。
const COUNTERS = new Set(['歳', '年', '月', '日', '時', '分', '秒', '人', '回', '階', '倍', '冊', '枚', '本', '軒', '匹', '頭', '羽', '台', '個', '週間', '月間', '年間', '時間']);
function annotateTokens(em, tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.pos_detail_1 === '数' && tok.reading) {
      let surface = tok.surface_form;
      let reading = tok.reading;
      let j = i + 1;
      while (j < tokens.length && tokens[j].pos_detail_1 === '数' && tokens[j].reading) {
        surface += tokens[j].surface_form;
        reading += tokens[j].reading;
        j++;
      }
      if (j < tokens.length && tokens[j].pos_detail_1 === '接尾' && COUNTERS.has(tokens[j].surface_form) && tokens[j].reading) {
        surface += tokens[j].surface_form;
        reading += tokens[j].reading;
        j++;
      }
      const hira = kataToHira(reading);
      em.ruby(surface, hira);
      pairs.set(`${surface}《${hira}》`, (pairs.get(`${surface}《${hira}》`) ?? 0) + 1);
      stats.total++;
      i = j - 1;
      continue;
    }
    annotateToken(em, tok);
  }
}

function annotateToken(em, tok) {
  const s = tok.surface_form;
  if (!KANJI_RE.test(s)) { em.plain(s); return; }
  if (['助詞', '助動詞', '記号'].includes(tok.pos)) { em.plain(s); return; }
  if (!tok.reading) {
    // kuromoji 辞書に読みが無い語の補完（曜は「日曜日」等の複合語に埋もれないよう、ここで受ける）
    const fallback = { '曜': 'よう' }[s];
    if (fallback) {
      em.ruby(s, fallback);
      pairs.set(`${s}《${fallback}》`, (pairs.get(`${s}《${fallback}》`) ?? 0) + 1);
      stats.total++;
    } else { em.plain(s); noReading.push(s); }
    return;
  }
  const reading = kataToHira(tok.reading);
  // 末尾のかな（送り仮名）を分ける。語幹に漢字以外（かな）が混ざる場合は全体に付ける
  const trail = s.match(/[ぁ-んァ-ヶ]+$/)?.[0] ?? '';
  const stem = trail ? s.slice(0, -trail.length) : s;
  if (trail && stem && !/[ぁ-んァ-ヶ]/.test(stem) && reading.length > trail.length) {
    const stemReading = reading.slice(0, reading.length - trail.length);
    em.ruby(stem, stemReading);
    pairs.set(`${stem}《${stemReading}》`, (pairs.get(`${stem}《${stemReading}》`) ?? 0) + 1);
    stats.total++;
    em.plain(trail);
  } else {
    em.ruby(s, reading);
    pairs.set(`${s}《${reading}》`, (pairs.get(`${s}《${reading}》`) ?? 0) + 1);
    stats.total++;
  }
}

function annotateText(text, sceneKey) {
  const table = [
    ...(BY_SCENE[sceneKey] ?? []),
    ...(BY_STORY[STORY] ?? []),
    ...COMMON,
  ].sort((a, b) => b[0].length - a[0].length);
  const em = new Emitter();
  let i = 0;
  let plainBuf = '';
  const flushPlain = () => {
    if (!plainBuf) return;
    annotateTokens(em, tokenizer.tokenize(plainBuf));
    plainBuf = '';
  };
  while (i < text.length) {
    const hit = table.find(([surface]) => text.startsWith(surface, i));
    if (hit) {
      flushPlain();
      const [surface, a, b] = hit;
      const base = b !== undefined ? a : surface;
      const reading = b !== undefined ? b : a;
      em.ruby(base, reading);
      pairs.set(`${base}《${reading}》`, (pairs.get(`${base}《${reading}》`) ?? 0) + 1);
      stats.total++;
      if (surface.length > base.length) em.plain(surface.slice(base.length));
      i += surface.length;
    } else {
      plainBuf += text[i];
      i++;
    }
  }
  flushPlain();
  return em.out;
}

const path = `${REPO}/src/stories/${STORY}.ts`;
const src = readFileSync(path, 'utf8');
let out = '';
let last = 0;
let scenes = 0;
for (const m of src.matchAll(/id: '([a-z_0-9]+)'([^{]*?)text: '([^']*)'/gs)) {
  const [whole, id, mid, text] = m;
  const annotated = annotateText(text, `${STORY}/${id}`);
  const rubyCount = (annotated.match(/《/g) ?? []).length;
  stats.byScene[id] = rubyCount;
  scenes++;
  out += src.slice(last, m.index) + `id: '${id}'${mid}text: '${annotated}'`;
  last = m.index + whole.length;
  console.log(`--- ${STORY}/${id} ruby=${rubyCount}`);
  console.log(annotated);
}
out += src.slice(last);
console.log(`== ${STORY}: scenes=${scenes} rubyTotal=${stats.total}`);
console.log('== readings pairs:');
for (const [k, v] of [...pairs.entries()].sort()) console.log(`  ${k} x${v}`);
if (noReading.length) console.log('== no-reading tokens (left plain):', [...new Set(noReading)].join(' '));
if (WRITE) {
  writeFileSync(path, out);
  console.log('WROTE', path);
}
