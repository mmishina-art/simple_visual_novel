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
const spokenText = (text) => READING_OVERRIDES.reduce((t, [re, yomi]) => t.replace(re, yomi), text);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const wanted = new Map();
for (const story of STORIES) {
  for (const node of Object.values(story.nodes)) {
    wanted.set(`${story.id}/${node.id}`, node.text);
  }
}

const jobs = [];
for (const [key, text] of wanted) {
  const spoken = spokenText(text);
  const hash = hashOf(spoken);
  const file = join(OUT_DIR, `${key}.mp3`);
  if (manifest[key]?.hash === hash && existsSync(file)) continue;
  jobs.push({ key, text: spoken, hash, file });
}
console.log(`読み上げ: 全${wanted.size}場面、新規・更新 ${jobs.length}件`);

const speak = (job) =>
  new Promise((resolve, reject) => {
    mkdirSync(dirname(job.file), { recursive: true });
    const child = execFile(
      '/opt/hatch/bin/tts',
      ['speak', '--output', job.file, '--voice', VOICE, '--language', LANGUAGE, '--speed', SPEED, '--text-stdin'],
      { timeout: 120_000 },
      (err) => (err ? reject(new Error(`${job.key}: ${err.message}`)) : resolve()),
    );
    child.stdin.end(job.text);
  });

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
