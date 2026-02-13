# AGENTS ルール

## 基本方針
- 日本語で簡潔かつ丁寧に回答する
- 不明確な点があれば推測せず、必ず質問する

## Git運用ルール
- `git add` / `git commit` を実行する前に、実行予定コマンドを必ず提示し、承認を得る
- `git add` は一括ではなく、実装順かつ論理単位で分ける
- 1コミット1目的を守る
- コミットメッセージは和英併記にする
- コミット後は `git status --short` と直近コミットログ（例: `git log --oneline -3`）を報告する

## テスト実行ルール
- 実装変更時は、変更範囲に応じて以下を実行する
- TypeScriptロジック変更（`src/editor/domain/**`, `src/features/**` など）: `npm run test:offline`
- フロント変更（`src/**`）: `npm run build`
- Tauri/Rust変更（`src-tauri/**`）: `cargo check`
- `git add` 前に実行結果を報告する
- 実行できない場合は、未実行理由を必ず報告する
