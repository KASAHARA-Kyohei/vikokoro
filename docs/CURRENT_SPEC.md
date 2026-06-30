# CURRENT SPEC（現行仕様）

このファイルは、今の `vikokoro` の実装仕様を次回開発時に素早く参照するための要約です。  
詳細経緯は `docs/milestones/*.md` と `docs/HANDOFF.md` を参照してください。

## 1. プロダクト概要

- Tauri v2 + React + TypeScript のキーボード中心マインドマップ/ツリーエディタ
- 親子階層を維持した自由配置マインドマップ
- 自動整列時は右方向ツリー構造（左: 親 / 右: 子）
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
- `Alt+h/j/k/l`: 選択ノードを8px移動（`Shift` 併用で32px）
- `=`: カーソル以下の枝を、枝ルート位置を維持して自動整列
- `+`: マップ全体を、ルート位置を維持して自動整列
- 親子線クリック: 接続線を選択し、親側/子側ノードの上下左右ハンドルで接続辺を手動指定
  - 選択線の `Auto` ボタン、または Command Palette で自動判定へ戻す
- 補助線:
  - `r` + ヒントキーで、選択ノードからヒント先ノードへ補助線を追加
  - Command Palette の `Add related link` で、選択ノードから検索した別ノードへ補助線を追加
  - 補助線クリックで選択し、`Delete` / `Backspace` / `dd` または Command Palette で削除
- 付箋:
  - Command Palette の `Add sticky note` で付箋配置モードに入る
  - 配置モード中の空白ダブルクリックで、クリック位置に付箋を作成して編集開始
  - 付箋クリックで選択し、ダブルクリックで編集
  - 付箋選択中の `Delete` / `Backspace` / `dd` で削除
  - 配置モードや付箋編集中の `Esc` は配置解除 / 編集確定
- `f` + ヒントキー: 任意ノードへジャンプ
- `F`: カーソル位置を仮ルートとしてサブツリーへフォーカス
  - `Esc`: 全体表示へ戻る
  - フォーカス中の `h`: 一階層上へフォーカスを移動
- `za` / `zc` / `zo`: 枝の開閉切替 / 折りたたみ / 展開
- `zM` / `zR`: 表示中の枝をすべて折りたたみ / 展開
- `dd`: ノード削除（rootは削除不可、子は繰り上げ）
- `c`: ノード色メニューを開く
  - `1-5`: 色適用（`5` は完了向けグレー）
  - `0`: 色解除
  - `Esc`: メニューを閉じる
- `m`: ノード詳細メモを開く
  - 複数行メモを編集
  - `Esc`: 閉じて確定
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
- `Enter` で確定して Normal へ
  - IME composing 中に押した場合は、composition end 後に同じ Enter で確定する

## 4. UI/UX 機能

- Theme: `Dark / Light / Ivory / Tokyo Night`
- Zoom: `Ctrl + Wheel`（マウス位置中心）
- Pan: `Space + Drag`
- Free layout:
  - 通常ドラッグでノード単体を移動
  - `Shift + Drag` で折りたたみ中を含む枝全体を移動
  - `Shift + Click` と空白ドラッグで複数選択、一括移動
  - 空白ダブルクリックでクリック位置に選択ノードの子を追加
  - 近隣ノードの辺・中心に整列ガイドを表示し、軽く吸着
  - 配置範囲に応じてキャンバスを自動拡張
- Save status 表示: `Saving... / Saved / Local`
- Node color: `Blue / Green / Yellow / Pink / Gray`
- Node memo: ノードごとの複数行メモ、メモあり時は `M` バッジ表示
- Search: 部分一致、Path表示、結果ハイライト、`Enter/Shift+Enter` で巡回
- Focus navigation: 保存座標を維持したままサブツリーだけを表示し、パンくずを表示
- Branch folding: 開閉ボタンと折りたたみ時の非表示子孫数を表示
- Manual connector anchors: 親子線ごとに親側/子側の接続辺を `top/right/bottom/left` から指定可能
- Related links: 親子構造を変えず、任意の非親子ノード同士を点線の補助線で関連付け可能
  - 折りたたみ/フォーカス中は、両端ノードが表示されている補助線だけ表示する
- Sticky notes: マインドマップ構造とは別レイヤーの固定サイズ黄色カード
  - 作成、編集、ドラッグ移動、削除が可能
  - 折りたたみ/フォーカス中も常に表示する
  - 検索、Jump、自動整列、親子線、補助線の対象外
- Command Palette: 主要操作を実行可能
  - `Add related link`
  - `Delete selected related link`
  - `Add sticky note`
  - `Move node left`
  - `Move node right`
  - `New tab`, `Close tab`, `Search`, `Help`, `Cycle theme`
- LLM settings: Gemini の API key / model 設定、接続テスト
  - モデル候補: `gemini-3-flash-preview`, `gemini-2.0-flash-lite`, `gemini-2.0-flash`, `gemini-1.5-flash`
  - API key は keyring 優先、利用不可環境では AppData の設定ファイルへフォールバック保存
- LLM assist: `Generate`（現在タブを再生成） / `Improve`（差分提案）
  - `Generate`: 実行成功時に現在タブを置き換えてモーダルを閉じる
  - `Improve`: 適用前に差分プレビュー（件数/要約/警告/親ノード単位の変更リスト）を表示し、`Apply` 押下で反映

## 5. データと永続化

- Tauri 起動時は `workspace.json` を AppData 配下に保存/復元
- 折りたたみ状態はドキュメントごとに保存し、フォーカス状態は保存しない
- ノード座標はドキュメントとUndo/Redoスナップショットへ保存する
- 手動接続アンカーはドキュメントとUndo/Redoスナップショットへ保存する
- 補助線はドキュメントとUndo/Redoスナップショットへ保存する
- 付箋はドキュメントとUndo/Redoスナップショットへ保存する
- 旧workspaceや不足座標は右向きツリー配置で補完し、無効なノードIDを除去する
- LLM 設定は `llm_settings.json`（AppData）に保存
- ブラウザ起動（`npm run dev`）では永続化なし（`Local` 表示）
- 保存は debounce + 直列化で競合を抑止
- JSON破損時は退避して起動継続

## 6. 現在の挙動ルール（重要）

- Undo/Redo は Document 単位で独立
- root ノードは削除不可
- ノード削除時は子を親直下へ繰り上げ
- ノード色の変更/解除は Undo/Redo 対象
- ノード詳細メモは Undo/Redo 対象
- ノード詳細メモの Undo/Redo は「メモモーダルを開いて閉じるまで」で1単位
- ドラッグ、複数ノード移動、キー移動、自動整列は各操作を1回のUndo単位とする
- 手動接続アンカーの変更とAutoリセットはUndo/Redo対象
- 補助線の追加/削除はUndo/Redo対象
- 補助線は自己リンク、親子線と同じ組み合わせ、同一ペア重複を作らない
- 付箋の作成/移動/削除はUndo/Redo対象
- 付箋本文のUndo/Redoは「編集開始から確定まで」で1単位
- Search はノード本文のみ対象で、詳細メモ本文は検索対象外
- `H/L` 階層移動は「できない場合は no-op」
  - `L`: 先頭兄弟は不可
  - `H`: 親が root の場合は不可
- LLM `Improve` は `Apply` するまでドキュメントに反映しない
- 折りたたみ操作は Undo/Redo 対象外
- Searchで非表示ノードを選択すると祖先を自動展開し、必要ならフォーカスを解除する
- Jumpヒントは現在表示されているノードだけを対象にする
- 親変更・兄弟順変更では座標を維持し、削除時は対象座標も除去する
- ノード削除・親変更・AI適用後は、存在しない親子線の手動接続アンカーを除去する
- ノード削除・AI適用後は、存在しないノードを指す補助線を除去する
- AI Generateは生成木を自動整列し補助線をクリアする。AI Improveは既存座標を維持して追加ノードだけを配置し、残存ノード間の補助線を維持する
- AI Generate/Improve は既存付箋を維持する
- LLM接続テスト/実行は Gemini API クォータを消費する

## 7. 次回開発時の運用ルール（推奨）

- 新機能着手前に、まずこの `docs/CURRENT_SPEC.md` を仕様基準として読む
- 仕様変更時は、実装と同じPRでこのファイルを更新する
- 大きな変更時のみ `docs/milestones/*.md` も同期する

## 8. LLM連携の下書き

- マインドマップ生成/改善の入出力スキーマ案は `docs/LLM_SCHEMA.md` を参照
