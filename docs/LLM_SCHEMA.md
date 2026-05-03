# LLM連携スキーマ案（Mindmap生成/改善）

このドキュメントは、`vikokoro` に LLM 機能を追加する際の入出力フォーマット案です。  
現行データモデル（`src/editor/types.ts`）と永続化 JSON（`workspace.json`）に合わせています。

## 1. 現行データモデル（前提）

内部のノードは次の shape です。

```ts
type Node = {
  id: string;
  text: string;
  parentId: string | null;
  childrenIds: string[];
  color?: "blue" | "green" | "yellow" | "pink" | "gray";
};

type DocumentState = {
  rootId: string;
  cursorId: string;
  nodes: Record<string, Node>;
};
```

重要な制約:

- `rootId` のノードは `parentId = null`
- `childrenIds` の順序が表示順
- 木構造（循環なし、各ノードの親は 0 or 1）
- 削除時の既定挙動は `promoteChildren`（子を親直下へ繰り上げ）

## 2. 方針

LLM は直接 `workspace.json` 全体を書き換えないで、用途別に次を返します。

- 新規生成: Tree 形式（`GeneratedTree`）
- 既存改善: 差分操作（`ImprovePlan`）

UI 側は必ずバリデーションし、ユーザー承認後に適用します。

## 3. 新規生成スキーマ（Generate）

### 3.1 Request

```json
{
  "version": "1",
  "mode": "generate",
  "topic": "生成AIを使った業務改善",
  "language": "ja",
  "maxDepth": 3,
  "maxChildrenPerNode": 6,
  "style": "balanced",
  "constraints": {
    "avoidAbstractOnly": true,
    "preferActionable": true
  }
}
```

`style` 候補:

- `balanced`: 汎用（概念と実行をバランス）
- `idea`: 発散寄り
- `task`: 実行計画寄り

### 3.2 Response

```json
{
  "version": "1",
  "mode": "generate",
  "root": {
    "tempId": "n1",
    "text": "生成AIを使った業務改善",
    "color": null,
    "children": [
      {
        "tempId": "n2",
        "text": "対象業務の選定",
        "color": "yellow",
        "children": []
      }
    ]
  }
}
```

`GeneratedTreeNode`:

```ts
type NodeColor = "blue" | "green" | "yellow" | "pink" | "gray" | null;

type GeneratedTreeNode = {
  tempId: string; // LLM内だけで一意
  text: string;
  color: NodeColor;
  children: GeneratedTreeNode[];
};
```

実装時は `tempId` から実ID（UUID）へ変換して `DocumentState` を組み立てます。

## 4. 既存改善スキーマ（Improve）

### 4.1 Request

```json
{
  "version": "1",
  "mode": "improve",
  "goal": "漏れを補完し、実行可能な粒度にする",
  "document": {
    "rootId": "root",
    "cursorId": "a",
    "nodes": {
      "root": {
        "id": "root",
        "text": "業務改善",
        "parentId": null,
        "childrenIds": ["a"],
        "color": null
      },
      "a": {
        "id": "a",
        "text": "在庫管理",
        "parentId": "root",
        "childrenIds": [],
        "color": null
      }
    }
  },
  "constraints": {
    "maxAdditions": 12,
    "keepExistingText": true,
    "allowReparent": true,
    "allowDelete": false
  }
}
```

### 4.2 Response

```json
{
  "version": "1",
  "mode": "improve",
  "summary": "在庫管理を「需要予測・発注・棚卸」に分解し、運用ステップを追加",
  "operations": [
    {
      "op": "add",
      "parentId": "a",
      "index": 0,
      "node": { "tempId": "n100", "text": "需要予測", "color": "green" }
    },
    {
      "op": "add",
      "parentId": "a",
      "index": 1,
      "node": { "tempId": "n101", "text": "発注最適化", "color": "green" }
    },
    { "op": "updateText", "nodeId": "a", "text": "在庫管理（AI活用）" }
  ],
  "warnings": []
}
```

操作定義:

```ts
type ImproveOp =
  | {
      op: "add";
      parentId: string;
      index: number; // parent.childrenIds への挿入位置
      node: { tempId: string; text: string; color: NodeColor };
    }
  | { op: "updateText"; nodeId: string; text: string }
  | { op: "setColor"; nodeId: string; color: NodeColor }
  | { op: "move"; nodeId: string; newParentId: string; index: number }
  | { op: "delete"; nodeId: string; strategy: "promoteChildren" };
```

## 5. クライアント側バリデーション

適用前に必ず次をチェックします。

- `version` と `mode` が期待値
- 参照IDがすべて存在（`add` の `parentId` など）
- `move` / `delete` 対象が root でない
- 適用後に循環が発生しない
- `index` が 0..children.length の範囲
- `text` が文字列（空文字許容可否は要件で決定）
- 1回の提案で `operations` 件数上限を超えない

不正が1件でもあれば一括 reject し、理由を表示します。

## 6. 推奨適用フロー

1. 現在ドキュメントを LLM 用 payload に変換
2. LLM 応答を JSON パース
3. スキーマ検証
4. 操作シミュレーション（安全に適用できるかチェック）
5. 変更プレビュー表示（追加/更新/移動/削除件数）
6. ユーザー承認後に reducer action へ変換して反映

## 7. reducer へのマッピング指針

現状実装との対応:

- `add`:
  - 将来的に `insertAt(parentId, index)` 相当の domain 関数を追加推奨
- `updateText`:
  - 対象ノードの `text` を更新する action を追加
- `setColor`:
  - 既存 `setCursorColor` 相当を nodeId 指定対応に拡張
- `move`:
  - 既存 `reparentNode` はカーソル基準なので、nodeId 指定版の domain 関数を追加
- `delete`:
  - 既存 `deleteCursorNodeAndPromoteChildren` の nodeId 指定版を追加

## 8. 最小MVP

最初は次だけで開始するのが安全です。

- Generate: `GeneratedTree` のみ対応
- Improve: `add` と `updateText` のみ対応（`move/delete` は後回し）

