# AGENTS.md

AI エージェント（Claude 以外も含む）がこのリポジトリで作業するときの入口です。

**最初に読むもの（この順で）:**

1. `docs/HANDOVER.md` — 現行状態・音声制作の知識・未解決事項の引き継ぎ文書
2. `CLAUDE.md` — 開発ルール・PWA 要件・新しい本の足し方

**最重要ルールの抜粋（詳細は上の2文書）:**

- 作業は feature ブランチ → `npm run verify` → E2E → push。main へ直接 push しない。マージはオーナーの指示を受けて PR 経由で。
- 公開のたびに `package.json` の `version` を必ず上げ、報告にバージョン番号を明記する。
- 読み上げ音声は全冊 Gemini TTS（冊ごとの割り当ては HANDOVER §1・§3）。声のタグ表は `scripts/build-narration.mjs` と `tests/narration.test.ts` の両方を必ずそろえる。
- 生成した音声は必ず文字起こしで本文照合してから取り込む（ハッシュ照合だけでは不十分）。
- 保存キー名（`simple-visual-novel-story:...`）は変更しない。
- ユーザー向け文言は日本語。外部リソース禁止。解釈が割れる要望は実装前にオーナーへ確認する。
