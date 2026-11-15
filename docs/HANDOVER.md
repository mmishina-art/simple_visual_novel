# 引き継ぎ文書（HANDOVER）

このリポジトリだけで開発を継続できるように、現行状態・音声制作の知識・作業手順・未解決事項をまとめた文書です。AI（Claude / その他の AI）・人間のどちらが引き継いでも、まずこの文書と `CLAUDE.md` を読んでください。

最終更新: 2026-11-15（v0.18.1 時点）

## 1. アプリの現行状態

- スマホ向け PWA サウンドノベル集『サウンドノベル』。タイトル画面 → 本棚（作品一覧）→ 本編、という構成の完成したアプリです（当初の単作テンプレートではありません）。
- 公開 URL: https://mmishina-art.github.io/simple_visual_novel/ ／ 紹介ページは `/home/`。
- 公開版: **v0.18.1**（`package.json` の `version`。タイトル画面最下部に表示され、オーナーはこれで更新を確認します）。
- 収録作品は全8冊（下表）。全冊に読み上げ音声（全256場面）とフリガナが付いています。
- 読み上げ音声は **全冊 Gemini TTS 化が完了**しています（2026-10-29、v0.18.0 / v0.18.1）。旧来の Lily / AivisSpeech 音声は残っていません。

| # | 作品 ID | 題名 | ジャンル | 語り手（現行） |
|---|---|---|---|---|
| 1 | midnight-school | 午前0時の校舎 | ホラー | Gemini 2.5 Flash TTS・Leda |
| 2 | moon-library | 月夜の図書室 | 恋愛 | Gemini 3.1 Flash TTS・Leda |
| 3 | missing-trophy | 消えた優勝杯 | 推理 | Gemini 3.8 Flash-Lite TTS・Leda |
| 4 | stardust-station | 星屑ステーション | SF | Gemini 3.8 Flash TTS・Leda |
| 5 | cafe-tsubame | 喫茶つばめの災難 | コメディ | Gemini 3.8 Flash TTS・Leda |
| 6 | sunday-well | 日曜日、井戸の底で | 純文学 | Gemini 3.8 Flash TTS・Charon |
| 7 | maou-diner | 魔王のいない国の食堂 | 異世界 | Gemini 3.8 Flash TTS・Charon |
| 8 | yubisaki | 指先の温度 | 官能 | Gemini 3.8 Flash-Lite TTS・Leda（隠し本。下記） |

- 『指先の温度』は `hidden: true` の隠し本です。他の全7冊のハッピーエンドを見ると本棚に実カードが現れます（未解放時は予告カード＋「ハッピーエンド達成: X / 7」）。判定は `src/logic.ts` の `hasSeenHappyEnding` / `isBonusUnlocked`。紹介ページには載せません。
- 各冊とも結末3つ（うちハッピー1つ）。ハッピーエンドを見た本は、本棚カードの表紙右上から小さな赤いしおり紐が垂れます。

## 2. 画面と操作の要点

- 読書画面のヘッダーは1段のみ（題名＋「本棚に戻る」＋「設定」）。音・読み上げ・速度などの操作は設定画面に一本化されています（本編からも開けます。戻り先は文脈対応で、本編から開いたら「本に戻る」）。
- 本文は縦書き明朝。文章は左へ蓄積し、溢れた分だけ新しいページになります。選択肢ノード到着時は文章だけが表示され、タップで「直前の一文＋選択肢」がセットで表示されます。
- 読書ステージの高さは `src/style.css` の `.stage`（`min(680px, calc(100dvh - 168px))`、min-height 420px）。背景絵は幅いっぱい・上詰めで、下端はマスクでステージ背景色へ溶かします。読み返し画面（`.backlog-text`）も同じ高さ式にそろえること。`e2e/stage-layout.spec.ts` が5サイズで固定しています。
- 保存は物語ごと。キー: `simple-visual-novel-story:<作品ID>:progress|backlog|endings`（接頭辞は `package.json` の `name`）。SCHEMA_VERSION 2。**保存キー名は変更しないこと**（CLAUDE.md の PWA 要件も参照）。
- 結末の音はパネル表示時に鳴ります（バッド＝低い鐘、ハッピー＝夜明けのオルゴール風）。**驚かせる大きな音・悲鳴風の音は不可**（オーナーの方針）。
- タイトル BGM は柔らかいジャズバラード（`src/title-song.ts`）。ビブラート／トレモロ／スウィングなし、がオーナーの音楽の好みです。

## 3. 読み上げ音声の仕組み（最重要）

### 3.1 生成パイプライン

- 生成は `scripts/build-narration.mjs`（`npm run narration`）。読み上げ文の sha1 ハッシュ＋声タグで差分生成し、`public/audio/<作品ID>/<場面ID>.mp3` に置きます（Service Worker の precache 対象外）。
- 読み上げ文の正は **`scripts/kana-texts.json`**（部分かな化した読み上げ文）。表示文は変えず、読み上げだけを整える仕組みが3層あります。**いずれも `scripts/build-narration.mjs` と `tests/narration.test.ts` の両方に同じ表があり、必ず両方を直すこと**:
  - `SPOKEN_TEXT_OVERRIDES`: 場面単位で読み上げ文そのものを組み替える（言い換え崩壊する場面用）。
  - `READING_OVERRIDES`: 読み上げだけ仮名で読みを固定する全局表（例: 軍手→ぐんて、河原→かわら）。
  - `CHUNKED_NARRATION`: 一文ずつ合成して0.1秒の間を入れて連結する場面の集合（途中から崩れる場面用。ハッシュに `|chunked-v1` を混ぜる）。
- かな化の道具: `scripts/kana-convert.mjs`（kuromoji/IPADIC、本ごとの要注意語表 `RISKY_BY_STORY`）、`scripts/kana-candidates.mjs`（候補洗い出し）。**全文かな化は不採用**（イントネーションが不自然になるため。部分かな化のみ）。カタカナの名前はカタカナのままにします。
- 「私」は全冊「わたし」に統一済み（RISKY 表）。作品ごとの要注意語は kana-convert.mjs の `RISKY_BY_STORY` が正です。

### 3.2 声の割り当て（冊ごとに固定、途中で混在させない）

正は `scripts/build-narration.mjs` の `VOICE_PROFILES`（tag は `tests/narration.test.ts` の `VOICE_PROFILE_TAGS` と一致させること）。

- 語り手は「1冊＝1人の語り手」で、主人公の性別に合わせるのが原則です。
- 現在の割り当ては §1 の表のとおり。テンポの基準は**分速300字**（実測して atempo / speedScale で補正）、3.8 系の音量は **-17 LUFS** に正規化済み。
- 生成方式は冊で2種類あります:
  - `sunday-well` のみ、スクリプト内生成（profile の `engine: 'gemini38'`）。`scripts/gemini38_tts.py` 経由で Gemini 3.8 Flash TTS（Charon）を呼びます。
  - 他の7冊は `engine: 'external'`（外部で生成した MP3 を取り込む方式）。MP3 を `public/audio/<作品ID>/` に置き、`NARRATION_ADOPT_EXTERNAL=1 npm run narration` で manifest のハッシュだけを合わせます。
- Gemini API のキー: `scripts/gemini38_tts.py` は環境変数 `GEMINI_API_KEY` があればそれを使い、なければ Muse 実行環境専用の資格情報プロキシを使います。通常の環境では **Google AI Studio の API キー（Paid tier）を `GEMINI_API_KEY` に設定**してください。Gemini TTS の日次枠はモデルごとに上限があるため、生成は呼び出し間隔8秒以上・1実行の上限（環境変数 `GEMINI38_BUDGET`、既定85回）で打ち切られ、manifest は場面ごとに保存されるので翌日に続きから再開できます。
- 3.8 系 TTS の作法: スタイル指示を本文に混ぜると読み上げられてしまいます。スタイルは `speechMetadata.style` に分離して渡すこと（`gemini38_tts.py` がそうしています）。3.1 以前は本文への前置でした。

### 3.3 生成後の検証（必須）

- **ハッシュ照合だけでは事故を見抜けません。** 生成した MP3 は必ず文字起こしして本文と照合してください（過去に「本文を英語で読み上げる」「一文が言い換えに崩れる」「途中から崩れる」事故が起きています）。
- TTS の生成は非決定的で、同じ文でも生成のたびに読みが揺らぎます。同梱 MP3 は生成・点検した時点で固定されるので、**点検は必ず生成済みファイルに対して**行ってください。
- 崩れた場面は、まず `CHUNKED_NARRATION` への追加（文単位合成）を試し、それでも崩れる場面は `SPOKEN_TEXT_OVERRIDES` で読み上げ文を組み替えます。修正は場面（セグメント）単位で作り直し、一文だけの継ぎ接ぎはしません。
- 文字起こし環境（faster-whisper）は §6 の手順で用意します。なお**ピッチアクセントの誤りは文字起こしでは検出できません**。声質・アクセントの最終判断はオーナーの耳に委ねられます（AI は文字起こしレベルの確認まで）。

## 4. フリガナ

- 青空文庫式「漢字《よみ》」記法。パースは `src/ruby.ts`、描画は `src/furigana.ts`。読み上げ文からは記法を取り除いて渡します（scripts 側の正規表現版と一致をテストで保証）。
- 全8冊 `rubyAll: true`（すべての出現に表示）で統一済みです。新規の本もこれにそろえてください。
- 生成は `scripts/ruby-annotate.mjs <作品ID> [--write]`（kuromoji＋上書き表 COMMON／BY_STORY／BY_SCENE）。読みの正は kana-texts 側と一致させること。多読語の固定読みは `tests/ruby.test.ts` が監査しています。

## 5. 開発ワークフロー（厳守）

1. 作業は **feature ブランチ**で行い、`npm run verify` → `npm run test:e2e` を通してから **push して止める**。main へ直接 push しない。
2. オーナーの確認・指示を受けてから PR を作り、CI が通ったら、指示を受けて PR 経由で main にマージする。PR は原則1目的にし、他の未マージブランチの上に積まない。
3. **公開のたびに `package.json` の `version` を必ず上げる**（オーナーはタイトル画面の v 表示で更新を確認します）。マージ時に version 行が競合したら、そのブランチの番号を正として解決する。納品報告にはバージョン番号を明記する。
4. E2E の前に、4173番ポートに古い preview サーバーが残っていないか確認する（`fuser -k 4173/tcp` で止める）。古いビルドを掴むと不可解な失敗になります。
5. 作業中プレビューの渡し方: `npm run build:preview` の出力 **`dist-preview/preview.html`** を使う（index.html は殻）。**単一ファイルプレビューには音声が含まれない**ため、音声の確認物は MP3 を別に用意する。
6. 要望の解釈が2通りに読める場合（画面・デザイン・範囲など）は、実装前に解釈を言語化してオーナーの OK を取る（CLAUDE.md の基本方針）。自明な一手コマンドは確認不要。
7. 画面を変更したら、スクリーンショット確認に**デザイン観点**まで含める（形の比率を実測、色の意味、余白、世界観との一致）。コード上正しくても描画が意図と違うことがあります。
8. 全体 UI ルール: 押せるものは必ずボタンらしく見せる／戻るボタンは各画面の右上に統一／表紙は絵の構図を変えず題字の位置と縦横だけ調整する。カバーの題字色（`coverTone`）は題字まわりの絵の明暗で決める（暗い絵に `'light'` を使うと題字が同化します）。
9. ユーザー向け文言は日本語。外部リソース（Web フォント・CDN 等）は禁止。色は `src/style.css` の `:root` 変数に集約する。

## 6. 環境セットアップ

```bash
npm ci                        # 依存関係（node_modules はリポジトリに含まれない）
npx playwright install chromium  # E2E 用（初回のみ）
npm run verify                # lint → 単体テスト → build → check:dist
```

- 音声監査用の文字起こし環境（faster-whisper）はリポジトリ外に置きます。2026-11-14 のファイル削除事故で従来環境（`~/workspace/.asr-venv` とモデルキャッシュ）は失われたため、必要になったら作り直してください:

```bash
python3 -m venv ~/workspace/.asr-venv
~/workspace/.asr-venv/bin/pip install faster-whisper
# モデルは HF_HOME=~/workspace/.hf-cache を指定して取得（初回はダウンロードが走る）
```

- AivisSpeech エンジン（旧・男性主人公2冊の声）は 2026-10-29 に廃止済みで、現行開発には不要です。

## 7. 未解決・未確認の事項

- iPhone 実機で、再生速度変更時にピッチが保持されるかは未確認です。
- 読み上げの漢字の読み間違いは、辞書（READING_OVERRIDES／RISKY 表）で潰してきましたが、原理上ゼロにはなりません。オーナーが実機で聞いて報告したら、固定表に足して確実に直す運用です。
- Dependabot の PR は CI が緑ならマージ可（オーナー指示があった場合）。放置中の古い Dependabot ブランチが残ることがあります。

## 8. 変更履歴の要点（音声まわり）

- v0.15.4: 部分かな化（kana-texts.json）を全冊に展開。
- v0.17.6: フリガナ全冊 `rubyAll` 統一、「私→わたし」統一、読書ステージ大型化。
- v0.17.7（PR #48）: 『午前0時の校舎』を Gemini 2.5 Flash TTS（Leda）に差し替え（オーナーが試作を正式採用）。
- v0.17.8（PR #49）: 『月夜の図書室』を Gemini 3.1 Flash TTS（Leda、atempo ×1.20）に差し替え。
- v0.18.0（PR #50）: 残り6冊を Gemini 3.8 系に差し替え、全8冊の Gemini 化を完了。男性主人公2冊の AivisSpeech はオーナーの耳の判断で廃止。
- v0.18.1（PR #51）: 『日曜日、井戸の底で』を 3.8 Flash-Lite（Charon）から 3.8 Flash（Charon）へ作り替え（『魔王のいない国の食堂』と同条件に統一）。

## 9. オーナーについて（開発に効く前提）

- オーナー（三品正人さん）は実機（iPhone）で確認して判断します。数値より聴感・見た目の実感を重視し、表示仕様の不統一を嫌います。
- 声質・ピッチアクセントの判断はオーナーの耳が正です。AI 側は文字起こしレベルの検証までを担います。
- 報告は「結論を先に、簡潔に」。バージョン番号の明記が必須です（§5-3）。
