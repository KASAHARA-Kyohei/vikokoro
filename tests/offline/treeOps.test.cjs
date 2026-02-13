const assert = require("node:assert/strict");
const test = require("node:test");
const {
  addSibling,
  deleteCursorNodeAndPromoteChildren,
  moveCursor,
  reparentNode,
} = require("../../.tmp-tests/src/editor/domain/treeOps.js");

function makeDoc() {
  return {
    id: "doc-1",
    rootId: "root",
    cursorId: "root",
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["a", "b"] },
      a: { id: "a", text: "a", parentId: "root", childrenIds: ["a1"] },
      a1: { id: "a1", text: "a1", parentId: "a", childrenIds: [] },
      b: { id: "b", text: "b", parentId: "root", childrenIds: [] },
    },
    undoStack: [],
    redoStack: [],
  };
}

test("moveCursor: parent/child/nextSibling/prevSibling", () => {
  const fromRoot = makeDoc();
  assert.equal(moveCursor(fromRoot, "child").cursorId, "a");

  const fromA = { ...makeDoc(), cursorId: "a" };
  assert.equal(moveCursor(fromA, "parent").cursorId, "root");
  assert.equal(moveCursor(fromA, "nextSibling").cursorId, "b");

  const fromB = { ...makeDoc(), cursorId: "b" };
  assert.equal(moveCursor(fromB, "prevSibling").cursorId, "a");
});

test("reparentNode: right indent keeps subtree", () => {
  const doc = { ...makeDoc(), cursorId: "b" };
  const updated = reparentNode(doc, "right");
  assert.equal(updated.nodes.b.parentId, "a");
  assert.deepEqual(updated.nodes.root.childrenIds, ["a"]);
  assert.deepEqual(updated.nodes.a.childrenIds, ["a1", "b"]);
});

test("reparentNode: left outdent no-op at root child", () => {
  const doc = { ...makeDoc(), cursorId: "a" };
  const updated = reparentNode(doc, "left");
  assert.equal(updated, doc);
});

test("deleteCursorNodeAndPromoteChildren: delete promotes child and moves cursor", () => {
  const doc = { ...makeDoc(), cursorId: "a" };
  const updated = deleteCursorNodeAndPromoteChildren(doc);
  assert.equal(updated.nodes.a, undefined);
  assert.deepEqual(updated.nodes.root.childrenIds, ["a1", "b"]);
  assert.equal(updated.nodes.a1.parentId, "root");
  assert.equal(updated.cursorId, "a1");
});

test("addSibling: root cursor falls back to addChild", () => {
  const doc = makeDoc();
  const updated = addSibling(doc).updated;
  const newNodeId = updated.cursorId;
  assert.equal(updated.nodes[newNodeId].parentId, "root");
  assert.equal(updated.nodes.root.childrenIds.includes(newNodeId), true);
});
