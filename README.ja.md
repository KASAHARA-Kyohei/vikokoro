# vikokoro

English: [README.md](README.md)

vikokoroは、思いついたことを素早く書き、Vim風操作で移動・整理できるローカルファーストのマインドマップです。Tauri v2、React、TypeScriptで動作します。

## 主な機能

- 任意ノードで `a` を押し、`q/w/e/a/d/z/x/c` から選ぶ8方向の枝作成
- 有機的な曲線と、第一階層から子孫へ継承する8色の枝カラー
- 広いキャンバス上へのカード自由配置、パン、0.5〜2倍ズーム
- 空白ダブルクリックまたは `⌘Enter` でカードを作成し、即時編集
- Enterで確定、Shift+Enterで改行、Escapeでキャンセル、日本語IME対応
- Shift/Commandクリック、矩形選択、複数ノードの一括移動・削除
- `⌘D`で複製
- 親子線、折りたたみ、フォーカス、Vim風ナビゲーション
- 枝ルート／全体ルートを固定し、兄弟を扇状に配置する明示的な自動整列
- `⌘Z` / `⌘⇧Z`を含むUndo/Redo
- AppDataの `workspace.json` へノード、選択、ビューポートを自動保存
- `ThoughtOrganizer`境界と、元データを変更しないモック整理案

## マップ操作

| 操作 | キー／ジェスチャー |
| --- | --- |
| 8方向へ子を作成 | `a` → `q/w/e/a/d/z/x/c`（Escで中止） |
| ノード作成 | 空白ダブルクリック / `⌘Enter` |
| 複製 | `⌘D` |
| 複数選択 | ShiftまたはCommandクリック / 空白ドラッグ |
| パン | Space+左ドラッグ / 中ボタンドラッグ / スクロール |
| ズーム | ピンチ、Ctrl+ホイール、上部の−/＋ |
| Undo／Redo | `⌘Z` / `⌘⇧Z`（従来の `u` / `Ctrl+r` も利用可） |

Tabは直近の子方向、選択ノード自身の進行方向、東方向の順で方向を継承します。Enterは現在と同じ方向へ兄弟を追加します。ノードを単独ドラッグすると、親子の角度から最寄りの45度へ枝方向を更新します。親子を一緒に動かした場合、子の枝方向は維持されます。

## 保存とAI方針

Tauri起動時はAppDataの `workspace.json` へデバウンス付きで原子的に保存します。schema version 3では枝方向と第一階層の枝色も保存します。version 2以前は既存座標から方向を推定し、座標と保存済みビューポートを維持して移行します。ブラウザ起動ではTauri APIがないため永続化は無効です。

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
