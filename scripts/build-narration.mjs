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
// 現在、『日曜日、井戸の底で』以外は外部生成の Gemini TTS 音声（このスクリプトでは合成しない）。
// 『日曜日、井戸の底で』だけは、このスクリプトの gemini38 エンジンで生成する。
// 『午前0時の校舎』は Gemini 2.5 Flash TTS（声 Leda、文分割合成＋
// テンポ調整で分速300字、文字起こし検証済み。2026-10-29 ユーザーが試作版を正式採用）。
// 『月夜の図書室』は Gemini 3.1 Flash TTS（声 Leda、atempo ×1.20、
// 全32場面を文字起こし検証済み。2026-10-29 取り込み）。
// 残り6冊は Gemini 3.8 系（2026-10-29 取り込み。全場面を文字起こし検証済み、
// テンポは実測 atempo で分速300字、音量は -17 LUFS に正規化）。
// 冊ごとにモデルを固定し、混在させない：
//   3.8 Flash（Leda）＝『星屑ステーション』『喫茶つばめの災難』、
//   3.8 Flash（Charon 柔らかめ）＝『魔王のいない国の食堂』『日曜日、井戸の底で』、
//   3.8 Flash-Lite（Leda）＝『消えた優勝杯』『指先の温度』。
// 『日曜日、井戸の底で』は当初 3.8 Flash-Lite（Charon）だったが、2026-10-29 に
// ユーザー指示で『魔王のいない国の食堂』と同じ 3.8 Flash（Charon）に作り替えた。
// 男性主人公の2冊は以前 AivisSpeech「阿井田 茂 Calm」だったが、
// 2026-10-29 にユーザーの耳の判断（聞いていて心地よくない）で Gemini に差し替えた。
// 音声ファイルは public/audio/<物語ID>/ に手で置き、manifest のハッシュだけを
// 合わせるときは NARRATION_ADOPT_EXTERNAL=1 で実行する。
const CHARON_STYLE = '小説の朗読です。やわらかく穏やかな男性の声で読んでください。強さや格好よさは抑えて、親しみやすく、静かに寄り添うような語り口で読んでください';
const GEMINI38_MODEL = 'gemini-3.8-flash-tts';
const VOICE_PROFILES = {
  'midnight-school': { engine: 'external', tag: 'gemini25-leda' },
  'moon-library': { engine: 'external', tag: 'gemini31-leda-v2' },
  'missing-trophy': { engine: 'external', tag: 'gemini38l-leda-v1' },
  'stardust-station': { engine: 'external', tag: 'gemini38f-leda-v1' },
  'cafe-tsubame': { engine: 'external', tag: 'gemini38f-leda-v1' },
  yubisaki: { engine: 'external', tag: 'gemini38l-leda-v1' },
  'sunday-well': { engine: 'gemini38', voice: 'Charon', model: GEMINI38_MODEL, style: CHARON_STYLE, tag: 'gemini38f-charon-v1' },
  'maou-diner': { engine: 'external', tag: 'gemini38f-charon-v1' },
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
const READING_OVERRIDES = [
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
  'missing-trophy/end_truth': '優勝杯の授与式。ステージの上で、優勝杯はスポットライトを受けて輝いた。事情を知るのは、わたしと潤と、部長だけ。部長の直した小さな傷跡は、優勝したクラスの、新しい歴史の始まりになった。',
  'stardust-station/locate2': '四十年かけて描いた大きな弧の果てに、船は帰り道の上にいた。まるで、ずっと帰ろうとしていたみたいに。',
  'cafe-tsubame/calm1': '嵐のような一日も、夕方が近づく頃には静かになった。社長はカウンターでうとうとしている。平和だ。平和が一番だ。',
  'cafe-tsubame/recipe2': '太麺をよく炒めて、ケチャップを寝かせて、最後に隠し味。運ばれた皿を見て、美食家の目がはっきりと見開かれた。これだ。この味だ。',
  'yubisaki/night3': 'ランプの橙の中で、彼は何度も「律子、律子」と私の名を呼んだ。そのたびに私は、若かった自分と今の自分が、ひとつの身体の中で重なっていくのを感じた。激しさよりも、確かさだった。求める手つきに迷いがなく、委ねることに怖さがなかった。雨はまだ降っていた。けれどこの部屋だけは、世界のどこよりも静かで、温かかった。',
};
// 試験中：かな化した読み上げ文（scripts/kana-texts.json）があれば、それを正とする。
// かな化は scripts/kana-convert.mjs で生成し、変換結果は全文を確認してから入れること。
const KANA_TEXTS = existsSync('scripts/kana-texts.json') ? JSON.parse(readFileSync('scripts/kana-texts.json', 'utf8')) : {};
// 本文のフリガナ記法「漢字《よみ》」は表示専用。読み上げ文からは必ず取り除く
// （src/ruby.ts の stripRuby と同じ規則：対象の漢字だけを残す）。
const stripRuby = (text) => text.replace(/｜([^《]*)《[^》]*》/g, '$1').replace(/《[^》]*》/g, '');
const spokenText = (key, text) => READING_OVERRIDES.reduce((t, [re, yomi]) => t.replace(re, yomi), SPOKEN_TEXT_OVERRIDES[key] ?? stripRuby(text));

// 文の組み合わせで合成が崩れる場面（2026-10-26、文字起こし点検で発覚）は、
// 一文ずつ合成してつなぐ。長い一括合成だと途中で意味不明の音声に崩れるため。
// ※ tests/narration.test.ts 側にも同じ表があるので、直すときは両方直すこと。
// 3.8 の6冊は場面一括で生成したため、分割合成の対象は校舎（2.5 試作）と
// 図書室（3.1）の下記場面だけが残っている（ハッシュ再現のために必要）。
const CHUNKED_NARRATION = new Set([
  'midnight-school/stairs2',
  'midnight-school/answer2',
  'midnight-school/entrance1',
  'midnight-school/music1',
  'moon-library/silent2',
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
  const spoken = KANA_TEXTS[key] ?? spokenText(key, text);
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

// AivisSpeech（VOICEVOX 互換 API）で1つの文を合成する。
// text はクエリ文字列で渡すこと（ボディで渡すと 422 になる）。
const AIVIS_BASE = 'http://127.0.0.1:10101';
const aivisSynth = async (text, profile, speedScale, outWav) => {
  const queryRes = await fetch(`${AIVIS_BASE}/audio_query?${new URLSearchParams({ text, speaker: String(profile.speaker) })}`, { method: 'POST' });
  if (!queryRes.ok) throw new Error(`Aivis audio_query failed: ${queryRes.status}`);
  const query = await queryRes.json();
  query.speedScale = speedScale;
  if (profile.intonationScale !== undefined) query.intonationScale = profile.intonationScale;
  const res = await fetch(`${AIVIS_BASE}/synthesis?${new URLSearchParams({ speaker: String(profile.speaker) })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`Aivis synthesis failed: ${res.status}`);
  writeFileSync(outWav, Buffer.from(await res.arrayBuffer()));
};

const probeDuration = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

// Aivis 場面の生成。仕上がりが分速300字（298〜305字/分）に近づくよう speedScale を
// 実測比で補正して合成し直し（最大5回）、最も300に近かった結果を採用する。
// 長い場面は文単位に分けてつなぐ。
const TARGET_CPM = 300;
const speakAivis = async (job) => {
  mkdirSync(dirname(job.file), { recursive: true });
  const units = job.chunked || job.text.length > 150 ? splitSentences(job.text) : [job.text];
  let scale = job.profile.speedScale;
  let best = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wavs = [];
    for (let i = 0; i < units.length; i += 1) {
      const wav = `${job.file}.av${i}.wav`;
      await aivisSynth(units[i], job.profile, scale, wav);
      wavs.push(wav);
    }
    const tmpOut = `${job.file}.tmp.mp3`;
    if (wavs.length === 1) {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wavs[0], '-ar', '24000', '-ac', '1', '-b:a', '64k', tmpOut]);
    } else {
      await concatChunks(wavs, tmpOut);
    }
    for (const w of wavs) rmSync(w, { force: true });
    const cpm = (job.text.length / probeDuration(tmpOut)) * 60;
    if (!best || Math.abs(cpm - TARGET_CPM) < Math.abs(best.cpm - TARGET_CPM)) {
      if (best) rmSync(best.file, { force: true });
      const bestFile = `${job.file}.best.mp3`;
      execFileSync('mv', [tmpOut, bestFile]);
      best = { file: bestFile, cpm, scale };
    } else {
      rmSync(tmpOut, { force: true });
    }
    if (cpm >= 298 && cpm <= 305) break;
    scale *= TARGET_CPM / cpm;
  }
  execFileSync('mv', [best.file, job.file]);
  console.log(`    ${job.key}: ${best.cpm.toFixed(0)}字/分（speedScale ${best.scale.toFixed(3)}）`);
};

// Gemini 3.8 系 TTS（ヘルパー経由）。API キーはヘルパー側で差し込まれる。
// 3.8 系はスタイルを本文に混ぜられない（読み上げられてしまう）ため、speechMetadata で
// 渡す専用ヘルパー scripts/gemini38_tts.py を使う。
// 予算は環境変数 GEMINI38_BUDGET で変更可（既定 85 回）。上限到達や 429 では例外
// BudgetStop でその日の生成を打ち切り、manifest は場面ごとに保存するので翌日に続きから再開できる。
const GEMINI38_HELPER = '/home/hatch/workspace/simple_visual_novel/scripts/gemini38_tts.py';
const GEMINI_MIN_INTERVAL_MS = 8_000;
const GEMINI38_BUDGET = Number(process.env.GEMINI38_BUDGET ?? 85);
class BudgetStop extends Error {}
const geminiState = new Map();
const geminiSynth = async (text, profile, outWav) => {
  const model = profile.model;
  const st = geminiState.get(model) ?? { calls: 0, lastCall: 0 };
  geminiState.set(model, st);
  if (st.calls >= GEMINI38_BUDGET) throw new BudgetStop(`Gemini 呼び出し上限に到達 (${model})`);
  const txtFile = `${outWav}.txt`;
  writeFileSync(txtFile, text);
  try {
    // プレビューモデルはまれに中身のない応答を返すことがある。
    // クォータ系以外の失敗は少し待って最大3回まで再試行する
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wait = st.lastCall + GEMINI_MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      st.lastCall = Date.now();
      st.calls += 1;
      try {
        await new Promise((resolve, reject) => {
          execFile('python3', [GEMINI38_HELPER, txtFile, profile.voice, outWav, profile.model, profile.style], { timeout: 300_000 }, (err, _out, stderr) =>
            err ? reject(new Error(stderr?.toString().slice(-300) || err.message)) : resolve(),
          );
        });
        return;
      } catch (err) {
        if (/429|RESOURCE_EXHAUSTED|quota/i.test(err.message)) throw new BudgetStop(`Gemini レート制限 (${model}): ${err.message.slice(0, 120)}`);
        lastErr = err;
      }
    }
    throw lastErr;
  } finally {
    rmSync(txtFile, { force: true });
  }
};

const concatWavs = (parts, output) =>
  new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-y'];
    for (const p of parts) args.push('-i', p);
    if (parts.length === 1) {
      args.push('-ar', '24000', '-ac', '1', output);
    } else {
      const pads = parts.map((_, i) => (i < parts.length - 1 ? `[${i}:a]apad=pad_dur=0.1[p${i}]` : `[${i}:a]anull[p${i}]`)).join(';');
      const ins = parts.map((_, i) => `[p${i}]`).join('');
      args.push('-filter_complex', `${pads};${ins}concat=n=${parts.length}:v=0:a=1[out]`, '-map', '[out]', '-ar', '24000', '-ac', '1', output);
    }
    execFile('ffmpeg', args, { timeout: 60_000 }, (err) => (err ? reject(err) : resolve()));
  });

// 音量正規化（-17 LUFS。他の Gemini 冊の実測に合わせる）
const TARGET_LUFS = -17;
const loudnormMeasure = (file) =>
  new Promise((resolve) => {
    execFile('ffmpeg', ['-i', file, '-af', `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { timeout: 120_000 }, (_err, _out, stderr) => {
      const m = String(stderr).match(/\{[^{}]*"input_i"[^{}]*\}/s);
      if (!m) return resolve(null);
      try {
        return resolve(JSON.parse(m[0]));
      } catch {
        return resolve(null);
      }
    });
  });

// Gemini 3.8 系の生成。基本は場面一括（長文テストで場面長では安定を確認）。
// 文字起こし検証で崩れが見つかった場面だけ、環境変数 GEMINI38_CHUNK_KEYS=key1,key2 で
// 文分割に切り替えて作り直す（対象場面の manifest エントリと MP3 を消してから再実行すること）。
// 後処理：テンポは実測（字数÷長さ）から atempo で分速300字に寄せ、音量は loudnorm で
// -17 LUFS に正規化する（『魔王のいない国の食堂』など他の 3.8 冊と同条件）。
const GEMINI38_CHUNK_KEYS = new Set((process.env.GEMINI38_CHUNK_KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const speakGemini38 = async (job) => {
  mkdirSync(dirname(job.file), { recursive: true });
  const units = GEMINI38_CHUNK_KEYS.has(job.key) ? splitSentences(job.text) : [job.text];
  const wavs = [];
  for (let i = 0; i < units.length; i += 1) {
    const wav = `${job.file}.g${i}.wav`;
    await geminiSynth(units[i], job.profile, wav);
    wavs.push(wav);
  }
  const joined = `${job.file}.joined.wav`;
  await concatWavs(wavs, joined);
  for (const w of wavs) rmSync(w, { force: true });
  // テンポ補正（実測 → 300字/分）
  const dur = probeDuration(joined);
  const cpm = (job.text.length / dur) * 60;
  const factor = Math.min(2.0, Math.max(0.5, TARGET_CPM / cpm));
  const tempoOut = `${job.file}.tempo.wav`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', joined, '-af', `atempo=${factor.toFixed(4)}`, '-ar', '24000', '-ac', '1', tempoOut]);
  rmSync(joined, { force: true });
  // 音量正規化（2パス loudnorm。測定できない場合は1パスに落とす）
  const measured = await loudnormMeasure(tempoOut);
  const ln = measured
    ? `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
    : `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tempoOut, '-af', ln, '-ar', '24000', '-ac', '1', '-b:a', '64k', job.file]);
  rmSync(tempoOut, { force: true });
  console.log(`    ${job.key}: 実測 ${cpm.toFixed(0)}字/分 → atempo ${factor.toFixed(3)}、音量 ${TARGET_LUFS} LUFS 正規化`);
};

const speak = async (job) => {
  if (job.profile?.engine === 'gemini38') {
    await speakGemini38(job);
    return;
  }
  if (job.profile?.engine === 'external') {
    // 外部生成の音声はここでは作らない。配置済みファイルの取り込み（ハッシュ合わせ）だけを、
    // 明示フラグがあるときに行う。それ以外で対象になったら、誤って別の声で作り直さないよう止める。
    if (process.env.NARRATION_ADOPT_EXTERNAL === '1' && existsSync(job.file)) return;
    throw new Error(`${job.key}: 外部生成音声の場面です。このスクリプトでは再生成しません（配置済みファイルを取り込むときは NARRATION_ADOPT_EXTERNAL=1）`);
  }
  if (job.profile?.engine === 'aivis') {
    try {
      await speakAivis(job);
    } catch (err) {
      throw new Error(`${job.key}: ${err.message}`, { cause: err });
    }
    return;
  }
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
const exhaustedModels = new Set();
const failures = [];
const queue = [...jobs];
const hasGemini = jobs.some((j) => j.profile?.engine === 'gemini38');
const workers = Array.from({ length: hasGemini ? 1 : CONCURRENCY }, async () => {
  while (queue.length > 0) {
    const job = queue.shift();
    // 枠（RPD）が尽きたモデルは、その日の残りジョブを飛ばして翌日に回す。
    if (job.profile?.model && exhaustedModels.has(job.profile.model)) continue;
    try {
      await speak(job);
    } catch (err) {
      if (err instanceof BudgetStop) {
        if (job.profile?.model) exhaustedModels.add(job.profile.model);
        console.log(`  Gemini の上限/レート制限でこのモデルを停止: ${err.message}`);
        continue;
      }
      failures.push(job.key);
      console.log(`  失敗（次回再試行）: ${job.key}: ${String(err.message).slice(0, 140)}`);
      continue;
    }
    manifest[job.key] = { hash: job.hash };
    // 途中経過を都度保存する（上限や障害で止まっても、済んだ場面は作り直さない）
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
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
if (exhaustedModels.size > 0) console.log(`未生成が残っています（残り ${jobs.length - done - failures.length} 件、枠切れモデル: ${[...exhaustedModels].join(', ')}）。翌日に再実行すると続きから生成します。`);
if (failures.length > 0) console.log(`失敗した場面（${failures.length}件）: ${failures.join(', ')}`);
