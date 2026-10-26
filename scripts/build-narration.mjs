// 読み上げ音声の一括生成。物語の文章を、Muse の読み上げと同じ声（Lily、C1設定）で
// 場面ごとに MP3 化し、public/audio/<物語ID>/<場面ID>.mp3 に置く。
// 使い方: npm run narration
// 文章が変わった場面だけ作り直す（本文のハッシュを manifest.json に持ち、一致したら飛ばす）。
// 声の正は TOOLS.md の C1 プリセット（avocado_v2:Lily、ja_JP、速度112）。
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const VOICE = 'avocado_v2:Lily';
const LANGUAGE = 'ja_JP';
const SPEED = '112';

// 物語ごとの語り手（既定は上の Lily C1）。声・速度・後加工が違う本はここに足す。
// ハッシュには profile の tag を混ぜ、声や加工を変えたら作り直されるようにする
// （tests/narration.test.ts にも同じ表がある。変えるときは両方を直すこと）。
// 『日曜日、井戸の底で』: G（Even Pond）を速度104で合成し、ピッチ0.95と輪郭の強調を
// かける「改3クリアA」相当（2026-10-26 ユーザー選択）。
const VOICE_PROFILES = {
  'maou-diner': {
    voice: 'avocado_v2:qvd_02415',
    speed: '104',
    tag: 'g-mod3a',
    post: 'rubberband=pitch=0.95,equalizer=f=3500:t=q:w=1:g=3,highshelf=f=8000:g=2',
  },
  'sunday-well': {
    voice: 'avocado_v2:qvd_02415',
    speed: '104',
    tag: 'g-mod3a',
    post: 'rubberband=pitch=0.95,equalizer=f=3500:t=q:w=1:g=3,highshelf=f=8000:g=2',
  },
};
const profileOf = (key) => VOICE_PROFILES[key.split('/')[0]];
const CONCURRENCY = 4;
const OUT_DIR = 'public/audio';
const MANIFEST = join(OUT_DIR, 'manifest.json');

// 物語データ（TypeScript）を取り込むために、tsc で物語まわりだけを一時コンパイルして読み込む
// （型だけの import は消えるので、絵や音のモジュールは読み込まれない）
const tmpDir = join('node_modules', '.cache-narration');
execFileSync('npx', [
  'tsc', '--ignoreConfig', 'src/stories/index.ts', 'src/vite-env.d.ts',
  '--outDir', tmpDir,
  '--module', 'commonjs',
  '--target', 'es2022',
  '--moduleResolution', 'node',
  '--ignoreDeprecations', '6.0',
  '--skipLibCheck',
], { stdio: 'inherit' });
const require = createRequire(import.meta.url);
const { STORIES } = require(join('..', tmpDir, 'stories', 'index.js'));

const hashOf = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);

// 読み上げ専用の読み替え（画面の表示は変えない）。英字の略語は、そのままだと
// 英語読みになってしまうので、カタカナに置き換えてから読み上げる。
// ※ tests/narration.test.ts 側にも同じ表があるので、直すときは両方直すこと。
const READING_OVERRIDES = [[/AI/g, 'エーアイ']];

// 場面ごとの読み上げ文の差し替え（画面の表示は変えない）。
// 生成エンジンが、本文のままだと英語で読み上げてしまう場面がある（2026-10-26、
// 全場面を文字起こしで点検して発覚）。そうした場面は、意味を変えない範囲で
// 言い回しを整えた文で読み上げる。差し替え文は、生成後に文字起こしして
// 日本語で本文どおりに読まれていることを確認済みのものだけを入れること。
// ※ tests/narration.test.ts 側にも同じ表があるので、直すときは両方直すこと。
const SPOKEN_TEXT_OVERRIDES = {
  'midnight-school/blackout1': '次の瞬間、非常灯がすべて消えた。完全な暗闇の中で、背後に人の気配があった。',
  'midnight-school/choice_voice': '声が、もう一度、私の名前を呼んだ。',
  'midnight-school/answer2': 'そして、すぐ後ろで声がした。『みつけた』',
  'midnight-school/music4': '譜面台の上には、濡れた上履きが片方だけ置いてあった。サイズは私のものとよく似ていた。',
  'missing-trophy/start5': '写真部の同級生、潤がカメラを下げて駆けつけた。式まで、あと三時間。犯人捜し、手伝うよ。まず、どこから調べよう。',
  'missing-trophy/end_truth': '授与式。ステージの優勝杯はスポットライトを受けて輝いた。事情を知るのは、私と、潤と、部長だけ。部長の直した小さな傷跡は、優勝したクラスの、新しい歴史の始まりになった。',
  'stardust-station/locate2': '四十年かけて描いた大きな弧の果てに、船は帰り道の上にいた。まるで、ずっと帰ろうとしていたみたいに。',
  'cafe-tsubame/calm1': '嵐のような一日も、夕方が近づく頃には静かになった。社長はカウンターでうとうとしている。平和だ。平和が一番だ。',
  'cafe-tsubame/recipe2': '太麺をよく炒めて、ケチャップを寝かせて、最後に隠し味。運ばれた皿を見て、美食家の目がはっきりと見開かれた。これだ。この味だ。',
};
const spokenText = (key, text) => READING_OVERRIDES.reduce((t, [re, yomi]) => t.replace(re, yomi), SPOKEN_TEXT_OVERRIDES[key] ?? text);

// 文の組み合わせで合成が崩れる場面（2026-10-26、文字起こし点検で発覚）は、
// 一文ずつ合成してつなぐ。長い一括合成だと途中で意味不明の音声に崩れるため。
// ※ tests/narration.test.ts 側にも同じ表があるので、直すときは両方直すこと。
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
]);
const splitSentences = (text) => text.match(/[^。！？]+[。！？]?/g)?.map((t) => t.trim()).filter(Boolean) ?? [text];

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const wanted = new Map();
for (const story of STORIES) {
  for (const node of Object.values(story.nodes)) {
    wanted.set(`${story.id}/${node.id}`, node.text);
  }
}

const jobs = [];
for (const [key, text] of wanted) {
  const spoken = spokenText(key, text);
  const profile = profileOf(key);
  const base = profile ? `${spoken}|${profile.tag}` : spoken;
  const chunked = CHUNKED_NARRATION.has(key);
  const hash = hashOf(chunked ? `${base}|chunked-v1` : base);
  const file = join(OUT_DIR, `${key}.mp3`);
  if (manifest[key]?.hash === hash && existsSync(file)) continue;
  jobs.push({ key, text: spoken, hash, file, profile, chunked });
}
console.log(`読み上げ: 全${wanted.size}場面、新規・更新 ${jobs.length}件`);

const speakTo = (text, out, profile) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      '/opt/hatch/bin/tts',
      ['speak', '--output', out, '--voice', profile?.voice ?? VOICE, '--language', LANGUAGE, '--speed', profile?.speed ?? SPEED, '--text-stdin'],
      { timeout: 120_000 },
      (err) => (err ? reject(err) : resolve()),
    );
    child.stdin.end(text);
  });

const applyPost = (input, output, profile) =>
  new Promise((resolve, reject) => {
    if (!profile?.post) return resolve(false);
    execFile('ffmpeg', ['-v', 'error', '-y', '-i', input, '-af', profile.post, output], { timeout: 60_000 }, (err) =>
      err ? reject(err) : resolve(true),
    );
  });

// 一文ずつ合成した MP3 を、間に 0.1 秒の間を入れてつなぐ
const concatChunks = (parts, output) =>
  new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-y'];
    for (const p of parts) args.push('-i', p);
    const pads = parts.map((_, i) => (i < parts.length - 1 ? `[${i}:a]apad=pad_dur=0.1[p${i}]` : `[${i}:a]anull[p${i}]`)).join(';');
    const ins = parts.map((_, i) => `[p${i}]`).join('');
    args.push('-filter_complex', `${pads};${ins}concat=n=${parts.length}:v=0:a=1[out]`, '-map', '[out]', '-ar', '24000', '-b:a', '64k', output);
    execFile('ffmpeg', args, { timeout: 60_000 }, (err) => (err ? reject(err) : resolve()));
  });

const speak = async (job) => {
  mkdirSync(dirname(job.file), { recursive: true });
  const rawOut = job.profile?.post || job.chunked ? `${job.file}.raw.mp3` : job.file;
  try {
    if (job.chunked) {
      const sentences = splitSentences(job.text);
      const parts = [];
      for (let i = 0; i < sentences.length; i += 1) {
        const part = `${job.file}.part${i}.mp3`;
        await speakTo(sentences[i], part, job.profile);
        parts.push(part);
      }
      await concatChunks(parts, rawOut);
      for (const p of parts) rmSync(p, { force: true });
    } else {
      await speakTo(job.text, rawOut, job.profile);
    }
    if (job.profile?.post) {
      await applyPost(rawOut, job.file, job.profile);
      rmSync(rawOut, { force: true });
    } else if (job.chunked) {
      execFileSync('mv', [rawOut, job.file]);
    }
  } catch (err) {
    throw new Error(`${job.key}: ${err.message}`, { cause: err });
  }
};

let done = 0;
const queue = [...jobs];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length > 0) {
    const job = queue.shift();
    await speak(job);
    manifest[job.key] = { hash: job.hash };
    done += 1;
    console.log(`  ${done}/${jobs.length} ${job.key}`);
  }
});
await Promise.all(workers);

// 物語から消えた場面の音声は残さない
for (const key of Object.keys(manifest)) {
  if (!wanted.has(key)) {
    rmSync(join(OUT_DIR, `${key}.mp3`), { force: true });
    delete manifest[key];
  }
}
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
const files = readdirSync(OUT_DIR, { recursive: true }).filter((f) => String(f).endsWith('.mp3'));
console.log(`完了: ${files.length} ファイル（public/audio/）`);
