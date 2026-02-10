# Contributing / コントリビューションガイド

Thank you for your interest in contributing to `vikokoro`.
`vikokoro` へのコントリビューションに興味を持っていただきありがとうございます。

## 1. Scope / 対象

- Bug reports and feature requests via Issues are welcome.
  Issue でのバグ報告・機能提案を歓迎します。
- Pull requests for fixes, docs, and UX improvements are welcome.
  修正、ドキュメント改善、UX改善の Pull Request を歓迎します。

## 2. Before Creating an Issue / Issue 作成前の確認

- Search existing Issues first.
  既存 Issue を先に検索してください。
- Use the matching template (bug / feature / question).
  該当テンプレート（bug / feature / question）を使ってください。
- Include reproduction steps and environment details when possible.
  可能な範囲で再現手順と環境情報を含めてください。

## 3. Local Development / ローカル開発

### Prerequisites / 前提

- Node.js `20.19+` or `22.12+`
- Rust stable

### Setup / セットアップ

```sh
npm ci
```

### Run (web) / 起動（Web）

```sh
npm run dev
```

### Run (Tauri) / 起動（Tauri）

```sh
npm run tauri dev
```

## 4. Branch & Commit / ブランチとコミット

- Branch example: `feat/...`, `fix/...`, `docs/...`, `chore/...`
  ブランチ例: `feat/...`, `fix/...`, `docs/...`, `chore/...`
- Commit format (recommended): `type: short summary`
  コミット形式（推奨）: `type: short summary`
- Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  主な type: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## 5. Pull Requests / Pull Request

- Keep PRs focused and small when possible.
  可能な限り PR は小さく、目的を絞ってください。
- Fill out the PR template.
  PR テンプレートを記入してください。
- Link related Issues (e.g. `Closes #123`).
  関連 Issue をリンクしてください（例: `Closes #123`）。
- Add screenshots/GIF for UI changes.
  UI 変更時はスクリーンショット/GIF を添付してください。

## 6. Review Policy / レビューポリシー

- Maintainers may request changes before merge.
  マージ前にメンテナーが修正依頼を行う場合があります。
- Responses may take time depending on availability.
  返信には状況により時間がかかる場合があります。

## 7. Labels (suggested) / ラベル運用（推奨）

- `bug`: unexpected behavior / 想定外の挙動
- `enhancement`: feature improvement / 機能改善
- `question`: support and questions / 質問・相談
- `good first issue`: beginner-friendly / 初参加向け
- `needs-info`: more information required / 追加情報が必要

## 8. Security / セキュリティ

- Please do not open public Issues for sensitive vulnerabilities.
  機密性の高い脆弱性は公開 Issue にしないでください。
- Contact maintainers directly for responsible disclosure.
  脆弱性報告はメンテナーへ直接連絡してください。
