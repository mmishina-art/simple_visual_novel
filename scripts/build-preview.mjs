// プレビュー用に、アプリを 1 つの HTML ファイルにまとめる（Claude が作業中の状態を Artifact に置くため）。
// 本番のビルド（dist/）とは別。Service Worker は登録せず、起動失敗の復旧（boot.js）も入れない。
// 保存データ（localStorage）は、プレビューの置き場所ごとに別になる（本番の記録には触れない）。
// 『午前0時の校舎』の読み上げ音声だけは、プレビューでも聞けるよう data URI で埋め込む
// （この仕組みはこのスクリプトの中だけ。本番ビルドの dist には入らない）。
// 使い方: npm run build:preview → dist-preview/preview.html
import { build } from 'vite';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const OUT = 'dist-preview';
const { version, name: appId } = JSON.parse(readFileSync('package.json', 'utf8'));

// 音声を埋め込む作品（『午前0時の校舎』）。キー（物語ID/場面ID）→ data URI の対応を、
// 仮想モジュールとしてプレビューのバンドルにだけ差し込む
const PREVIEW_NARRATION_STORY = 'midnight-school';
const narrationDataModule = () => {
  const dir = join('public', 'audio', PREVIEW_NARRATION_STORY);
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith('.mp3'))
    .map((f) => [
      `${PREVIEW_NARRATION_STORY}/${f.replace(/\.mp3$/, '')}`,
      `data:audio/mpeg;base64,${readFileSync(join(dir, f)).toString('base64')}`,
    ]);
  return `export default ${JSON.stringify(Object.fromEntries(entries))};`;
};

await build({
  configFile: false,
  base: './',
  publicDir: false,
  logLevel: 'warn',
  define: { __APP_VERSION__: JSON.stringify(version), __APP_ID__: JSON.stringify(appId) },
  plugins: [
    {
      // アプリの ID を埋め込み、起動失敗の復旧（Service Worker のキャッシュを消す boot.js）は、プレビューでは外す
      name: 'preview-html',
      transformIndexHtml: { order: 'pre', handler: (html) => html.replace('__APP_ID__', appId).replace(/<script src="boot\.js"><\/script>\s*/, '') },
    },
    {
      // プレビューだけ: 埋め込み音声がある場面は data URI で再生する。
      // 本番の src/narration.ts 自体は書き換えず、プレビューのビルド時にだけ差し替える
      name: 'preview-narration-embed',
      enforce: 'pre',
      resolveId: (id) => (id === 'virtual:preview-narration' ? '\0preview-narration' : null),
      load: (id) => (id === '\0preview-narration' ? narrationDataModule() : null),
      transform: (code, id) => {
        if (!id.endsWith('/src/narration.ts')) return null;
        const next = code
          .replace(
            "import { load, save } from './storage';",
            "import { load, save } from './storage';\nimport previewNarration from 'virtual:preview-narration';",
          )
          .replace('a.src = `audio/${key}.mp3`;', 'a.src = previewNarration[key] ?? `audio/${key}.mp3`;')
          .replace(
            'audio?.currentSrc.endsWith(`${currentKey}.mp3`)',
            '(audio?.currentSrc.endsWith(`${currentKey}.mp3`) || Boolean(previewNarration[currentKey]))',
          );
        if (next === code) throw new Error('preview-narration-embed: narration.ts の差し替えに失敗しました');
        return next;
      },
    },
    {
      // Service Worker の登録（更新ボタン）は、プレビューでは何もしない
      name: 'pwa-register-stub',
      resolveId: (id) => (id === 'virtual:pwa-register' ? '\0pwa-register-stub' : null),
      load: (id) => (id === '\0pwa-register-stub' ? 'export function registerSW() { return async () => {}; }' : null),
    },
  ],
  build: {
    outDir: OUT,
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000, // 画像・音も 1 つのファイルに入れる
  },
});

const assets = join(OUT, 'assets');
const files = existsSync(assets) ? readdirSync(assets) : [];
const read = (f) => readFileSync(join(assets, f), 'utf8');
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const dataUri = (path) => `data:${MIME[extname(path)] ?? 'application/octet-stream'};base64,${readFileSync(path).toString('base64')}`;

let html = readFileSync(join(OUT, 'index.html'), 'utf8')
  // アイコン（public/ のファイル）は、ファイルの中に埋め込む
  .replace(/href="(icons\/[^"]+)"/g, (m, p) => (existsSync(join('public', p)) ? `href="${dataUri(join('public', p))}"` : m))
  // CSS と JS を、ファイルの中に埋め込む（</script> は文字列の中でも閉じタグになるので、エスケープする）
  .replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)"[^>]*>/g, (_, f) => `<style>${read(f)}</style>`)
  .replace(/<script type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*><\/script>/g, (_, f) => `<script type="module">${read(f).replace(/<\/script/g, '<\\/script')}</script>`);

const left = files.filter((f) => html.includes(`assets/${f}`));
if (left.length) throw new Error(`埋め込めなかったファイルがある: ${left.join(', ')}`);
writeFileSync(join(OUT, 'preview.html'), html);
console.log(`${OUT}/preview.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
