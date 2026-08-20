# vikokoro

English: [README.md](README.md)

vikokoroは、思いついたことを素早く書き、Vim風操作で移動・整理できるローカルファーストのマインドマップです。Tauri v2、React、TypeScriptで動作します。

## 主な機能

- 広いキャンバス上へのカード自由配置、パン、0.5〜2倍ズーム
- 空白ダブルクリックまたは `⌘Enter` でカードを作成し、即時編集
- Enterで確定、Shift+Enterで改行、Escapeでキャンセル、日本語IME対応
- Shift/Commandクリック、矩形選択、複数ノードの一括移動・削除
- `⌘D`で複製
- 親子線、折りたたみ、フォーカス、Vim風ナビゲーション
- `⌘Z` / `⌘⇧Z`を含むUndo/Redo
- AppDataの `workspace.json` へノード、選択、ビューポートを自動保存
- `ThoughtOrganizer`境界と、元データを変更しないモック整理案

## マップ操作

| 操作 | キー／ジェスチャー |
| --- | --- |
| ノード作成 | 空白ダブルクリック / `⌘Enter` |
| 複製 | `⌘D` |
| 複数選択 | ShiftまたはCommandクリック / 空白ドラッグ |
| パン | Space+左ドラッグ / 中ボタンドラッグ / スクロール |
| ズーム | ピンチ、Ctrl+ホイール、上部の−/＋ |
| Undo／Redo | `⌘Z` / `⌘⇧Z`（従来の `u` / `Ctrl+r` も利用可） |

Tab/Enterによる階層追加、`hjkl`、折りたたみ、フォーカス、補助線、付箋も利用できます。

## 保存とAI方針

Tauri起動時はAppDataの `workspace.json` へデバウンス付きで原子的に保存します。旧形式は読み込み時にノードサイズ、選択、ビューポートを補完します。ブラウザ起動ではTauri APIがないため永続化は無効です。

外部AI APIへ直接接続する機能はありません。現在は選択ノードからモック整理案を作り、元データへ反映せずプレビューする境界だけを実装しています。将来はブラウザでのプロンプト往復、続いてAIエージェントによる編集提案へ拡張する想定です。

## 開発

```sh
npm ci
npm run dev
```

Tauri:

```sh
npm run tauri dev
```

検証:

```sh
npm run lint
npm run typecheck
npm run test:offline
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
