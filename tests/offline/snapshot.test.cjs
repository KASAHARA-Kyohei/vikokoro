const assert = require("node:assert/strict");
const test = require("node:test");
const {
  cloneDocumentState,
  documentStateEquals,
} = require("../../.tmp-tests/src/editor/domain/snapshot.js");

function makeState() {
  return {
    rootId: "root",
    cursorId: "a",
    nodePositions: {
      root: { x: 0, y: 0 },
      a: { x: 260, y: 10 },
    },
    edgeAnchors: {
      "root->a": { from: "right", to: "left" },
    },
    nodes: {
      root: {
        id: "root",
        text: "root",
        note: undefined,
        parentId: null,
        childrenIds: ["a"],
        color: undefined,
      },
      a: {
        id: "a",
        text: "A",
        note: "memo",
        parentId: "root",
        childrenIds: [],
        color: undefined,
      },
    },
  };
}

test("cloneDocumentState: deep clone", () => {
  const src = makeState();
  const cloned = cloneDocumentState(src);

  assert.deepEqual(cloned, src);
  assert.notEqual(cloned, src);
  assert.notEqual(cloned.nodes, src.nodes);
  assert.notEqual(cloned.nodes.root.childrenIds, src.nodes.root.childrenIds);
  assert.notEqual(cloned.nodePositions, src.nodePositions);
  assert.notEqual(cloned.nodePositions.a, src.nodePositions.a);
  assert.notEqual(cloned.edgeAnchors, src.edgeAnchors);
  assert.notEqual(cloned.edgeAnchors["root->a"], src.edgeAnchors["root->a"]);

  cloned.nodes.root.childrenIds.push("x");
  cloned.edgeAnchors["root->a"].from = "bottom";
  assert.deepEqual(src.nodes.root.childrenIds, ["a"]);
  assert.deepEqual(src.edgeAnchors["root->a"], { from: "right", to: "left" });
});

test("documentStateEquals: detect differences", () => {
  const a = makeState();
  const b = cloneDocumentState(a);
  assert.equal(documentStateEquals(a, b), true);

  const c = cloneDocumentState(a);
  c.nodes.a.text = "changed";
  assert.equal(documentStateEquals(a, c), false);

  const noteChanged = cloneDocumentState(a);
  noteChanged.nodes.a.note = "changed memo";
  assert.equal(documentStateEquals(a, noteChanged), false);

  const d = cloneDocumentState(a);
  d.nodes.root.childrenIds = ["z"];
  assert.equal(documentStateEquals(a, d), false);

  const moved = cloneDocumentState(a);
  moved.nodePositions.a.x += 1;
  assert.equal(documentStateEquals(a, moved), false);

  const anchored = cloneDocumentState(a);
  anchored.edgeAnchors["root->a"].from = "bottom";
  assert.equal(documentStateEquals(a, anchored), false);
});
