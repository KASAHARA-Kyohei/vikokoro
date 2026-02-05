# 引き継ぎメモ（M0→M2完了時点）

このリポジトリ（`vikokoro`）は **Tauri v2 + React + TS** の右方向ツリーエディタです。

## いま実装できていること

### M0（`docs/milestones/M0.md`）
- DOMノード表示 + SVG線
- Normal/Insert
  - `i` で Insert
  - `Esc` で確定して Normal
  - Insert中は編集優先（ショートカット無効）
- Normal操作
  - `Tab` 子追加 → 即Insert
  - `Enter` 兄弟追加 → 即Insert
  - `hjkl` + `j/k` 移動
  - `J/K` 兄弟swap
  - `u` Undo / `Ctrl+r` Redo
  - `Ctrl+Tab` / `Ctrl+Shift+Tab` でタブ切替
- Undo/Redo は snapshot（Document単位）
  - 積むタイミングは **確定時（commit）**

### M1（`docs/milestones/M1.md`）
- Workspaceを **JSONで永続化**（Tauri app data dir の `workspace.json`）
  - 起動時 `load_workspace` → state初期化
  - state変更後 `save_workspace`（自動保存）
- タブ操作
  - `Ctrl+T` 新規ドキュメント
  - `Ctrl+W` タブ閉じ（最後の1つは不可）
  - タブ名は root ノード text（空なら `Untitled`）
- Undo/Redo は **ドキュメント単位で独立**（他タブに影響しない）

### M2（`docs/milestones/M2.md`）
- 永続化の堅牢性改善
  - 保存呼び出しの直列化（古い状態で上書きされない）
  - `workspace.json` は pretty print + 改行で保存
  - JSONが壊れている場合は退避して起動継続

## 追加で入れた改善（仕様外だが便利）
- Insert中 `Enter` で編集確定→Normal（IME composing中は確定しない）
- タブ閉じは確認モーダル（`y`で閉じる / `n` or `Esc`でキャンセル）
- ノード削除: Normalで `dd`
  - ルートは削除不可
  - 削除時、子は繰り上げ（親直下に挿入）
  - Undoは案A（`dd` 実行時に snapshot を積む）

## 起動・確認方法

### ブラウザで確認（永続化なし）
- `npm run dev`

### Tauriで確認（永続化あり）
- `npm run tauri dev`

※ Node が `22.11.0` の場合、Viteがバージョン警告を出すことがあります（ビルド自体は通る想定）。

## 永続化の実装ポイント

### Rust（Tauriコマンド）
- `src-tauri/src/lib.rs`
  - `load_workspace(app) -> Option<Workspace>`
  - `save_workspace(app, workspace) -> ()`
  - 保存先は `BaseDirectory::AppData` に `workspace.json`
  - パース失敗時は `workspace.json.broken-<timestamp>` に退避

### フロント
- `src/App.tsx`
  - 起動時 `invoke("load_workspace")` → `finishHydration`
  - `saveRevision` を見て `invoke("save_workspace")`（250ms debounce + 直列化）
- `src/editor/state.ts`
  - `hydrated: boolean`
  - `saveRevision: number`（変更のたびにインクリメント）

## 主要ファイル
- UI: `src/App.tsx`, `src/editor/EditorView.tsx`, `src/editor/TabBar.tsx`
- 状態/操作: `src/editor/state.ts`
- 型: `src/editor/types.ts`
- レイアウト: `src/editor/layout.ts`
- 永続化（Rust）: `src-tauri/src/lib.rs`

## 既知の仕様/制限
- ブラウザ起動（`npm run dev`）では `invoke` が失敗するため、永続化は no-op（catchで握りつぶし）
- 自動保存は「復元の完全性優先」で、カーソル移動/タブ切替などでも `saveRevision` を進めています（頻度はdebounceで抑制）

## 明日以降の進め方（提案）
- 次のマイルストーン仕様（`docs/milestones/M2.md` 等）があれば、それを唯一の仕様として着手
- 永続化の調整が必要なら
  - 保存頻度の見直し（例: カーソル移動では保存しない、など）
  - `workspace.json` の整形保存（pretty print）
  - 破損時の復旧戦略（load失敗→初期化など）

## 次回の最初にやること（チェックリスト）
- `npm run tauri dev` で起動
- `Ctrl+T` で2枚以上にする
- 適当に編集/移動してからアプリ終了→再起動
  - タブ構成が復元される
  - ノード内容が復元される
  - 選択位置（cursor）が復元される
- タブ閉じ確認
  - `Ctrl+W` → モーダル → `y` で閉じる / `n` or `Esc` でキャンセル
  - タブが1枚のとき `Ctrl+W` は無反応

## 保存頻度についてのメモ（現状と選択肢）

現状は「復元の完全性（特に選択位置）優先」で、M1に列挙されたトリガーに加えて以下でも保存しています。

- カーソル移動（`hjkl/jk`、ノードクリック）
- タブ切替（`Ctrl+Tab`/クリック）

理由: `M1.md` の受入条件に「選択位置が復元される」があるため、移動後に保存しないと再起動で位置が戻りません。

もし「保存は最小限がいい（ファイルI/O減らしたい）」なら、次のどれにするかを決めると良いです。

- 案1（現状維持 / 安全）: いまのまま（保存は250ms debounceでまとめる）
- 案2（中間）: 「カーソル移動」は workspace全体ではなく、cursorだけ別ファイルに保存
  - 例: `workspace.json` + `cursor.json`
- 案3（仕様に厳密）: M1に書いてあるトリガー以外では保存しない
  - 注意: この場合、移動だけして終了→再起動したときに選択位置が復元されなくなる可能性がある

## 次マイルストーン（M2）のための質問メモ

次を決めると仕様に落とし込みやすいです（ここは推測せず要件化が必要）。

- ノード削除（`dd`）は正式仕様（M2で明文化）
- タブを閉じたときの「閉じたタブ復元」は不要
- テキスト編集を複数行にするか（M0はinput overlay前提で単一行）
- レイアウト改善の範囲（自動整列の精度、折り返し、ズーム、ミニマップ等）
