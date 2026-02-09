# CURRENT SPEC（現行仕様）

このファイルは、今の `vikokoro` の実装仕様を次回開発時に素早く参照するための要約です。  
詳細経緯は `docs/milestones/*.md` と `docs/HANDOFF.md` を参照してください。

## 1. プロダクト概要

- Tauri v2 + React + TypeScript のキーボード中心マインドマップ/ツリーエディタ
- 右方向ツリー構造（左: 親 / 右: 子）
- モードは `Normal` / `Insert`

## 2. 主要操作（Normal）

- `Tab`: 子ノード追加して即 Insert
- `Enter`: 兄弟ノード追加して即 Insert
- `h/j/k/l`: 親 / 次兄弟 / 前兄弟 / 先頭子へ移動
- `J/K`: 兄弟の並び替え（下/上）
- `H/L`: ノードの階層移動（左/右 = outdent/indent）
  - `L`: 直前兄弟の子へ移動（移動先の子配列末尾に追加）
  - `H`: 親の次位置へ移動（親の親配下へ）
  - いずれもノードはサブツリーごと移動
- `dd`: ノード削除（rootは削除不可、子は繰り上げ）
- `u` / `Ctrl+r`: Undo / Redo
- `Ctrl+T` / `Ctrl+W`: タブ作成 / タブ閉じ（確認あり）
- `Ctrl+Tab` / `Ctrl+Shift+Tab`: タブ切替
- `Ctrl+F`: Search モーダル
- `Ctrl+P`: Command Palette
- `?`: Help モーダル

## 3. Insert モード

- `i` で Insert 開始
- `Esc` で確定して Normal へ
- Insert 中は編集優先（多くのショートカットは無効）
- `Enter` で確定（IME composing 中は確定しない）

## 4. UI/UX 機能

- Theme: `Dark / Light / Ivory / Tokyo Night`
- Zoom: `Ctrl + Wheel`（マウス位置中心）
- Pan: `Space + Drag`
- Save status 表示: `Saving... / Saved / Local`
- Search: 部分一致、Path表示、結果ハイライト、`Enter/Shift+Enter` で巡回
- Command Palette: 主要操作を実行可能
  - `Move node left`
  - `Move node right`
  - `New tab`, `Close tab`, `Search`, `Help`, `Cycle theme`

## 5. データと永続化

- Tauri 起動時は `workspace.json` を AppData 配下に保存/復元
- ブラウザ起動（`npm run dev`）では永続化なし（`Local` 表示）
- 保存は debounce + 直列化で競合を抑止
- JSON破損時は退避して起動継続

## 6. 現在の挙動ルール（重要）

- Undo/Redo は Document 単位で独立
- root ノードは削除不可
- ノード削除時は子を親直下へ繰り上げ
- `H/L` 階層移動は「できない場合は no-op」
  - `L`: 先頭兄弟は不可
  - `H`: 親が root の場合は不可

## 7. 次回開発時の運用ルール（推奨）

- 新機能着手前に、まずこの `docs/CURRENT_SPEC.md` を仕様基準として読む
- 仕様変更時は、実装と同じPRでこのファイルを更新する
- 大きな変更時のみ `docs/milestones/*.md` も同期する
