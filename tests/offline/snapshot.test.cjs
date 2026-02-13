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
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["a"], color: undefined },
      a: { id: "a", text: "A", parentId: "root", childrenIds: [], color: undefined },
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

  cloned.nodes.root.childrenIds.push("x");
  assert.deepEqual(src.nodes.root.childrenIds, ["a"]);
});

test("documentStateEquals: detect differences", () => {
  const a = makeState();
  const b = cloneDocumentState(a);
  assert.equal(documentStateEquals(a, b), true);

  const c = cloneDocumentState(a);
  c.nodes.a.text = "changed";
  assert.equal(documentStateEquals(a, c), false);

  const d = cloneDocumentState(a);
  d.nodes.root.childrenIds = ["z"];
  assert.equal(documentStateEquals(a, d), false);
});
