const assert = require("node:assert/strict");
const test = require("node:test");
const {
  addSibling,
  deleteCursorNodeAndPromoteChildren,
  moveCursor,
  reparentNode,
  swapSibling,
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
    branchDirections: { a: "e", a1: "e", b: "e" },
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

test("swapSibling exchanges sibling branches and keeps descendant offsets", () => {
  const doc = {
    ...makeDoc(),
    cursorId: "a",
    nodePositions: {
      root: { x: 0, y: 100 },
      a: { x: 260, y: 20 },
      a1: { x: 520, y: 30 },
      b: { x: 300, y: 220 },
    },
  };

  const updated = swapSibling(doc, "down");

  assert.deepEqual(updated.nodes.root.childrenIds, ["b", "a"]);
  assert.deepEqual(updated.nodePositions.a, { x: 300, y: 220 });
  assert.deepEqual(updated.nodePositions.a1, { x: 560, y: 230 });
  assert.deepEqual(updated.nodePositions.b, { x: 260, y: 20 });
});

test("reparentNode: right indent keeps subtree", () => {
  const doc = {
    ...makeDoc(),
    cursorId: "b",
    nodePositions: {
      root: { x: 0, y: 0 },
      a: { x: 260, y: 0 },
      a1: { x: 520, y: 0 },
      b: { x: 260, y: 220 },
    },
  };
  const updated = reparentNode(doc, "right");
  assert.equal(updated.nodes.b.parentId, "a");
  assert.deepEqual(updated.nodes.root.childrenIds, ["a"]);
  assert.deepEqual(updated.nodes.a.childrenIds, ["a1", "b"]);
  assert.equal(updated.branchDirections.b, "s");
  assert.equal(updated.nodes.b.branchTone, undefined);
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
  assert.equal(updated.branchDirections.a, undefined);
  assert.equal(updated.branchDirections.a1, "e");
  assert.ok(updated.nodes.a1.branchTone);
});

test("addSibling: root cursor falls back to addChild", () => {
  const doc = makeDoc();
  const updated = addSibling(doc).updated;
  const newNodeId = updated.cursorId;
  assert.equal(updated.nodes[newNodeId].parentId, "root");
  assert.equal(updated.nodes.root.childrenIds.includes(newNodeId), true);
});

test("addSibling keeps the preferred position and moves an overlapping lower branch", () => {
  const doc = {
    ...makeDoc(),
    cursorId: "a1",
    nodePositions: {
      root: { x: 0, y: 0 },
      a: { x: 260, y: 0 },
      a1: { x: 520, y: 0 },
      b: { x: 260, y: 50 },
    },
  };
  doc.nodes.b.text = "横幅の大きいノード".repeat(10);

  const updated = addSibling(doc).updated;
  const newNodeId = updated.cursorId;

  assert.equal(updated.nodePositions[newNodeId].x, 520);
  assert.equal(updated.nodePositions[newNodeId].y < 0, true);
  assert.deepEqual(updated.nodePositions.root, doc.nodePositions.root);
  assert.deepEqual(updated.nodePositions.a, doc.nodePositions.a);
  assert.deepEqual(updated.nodePositions.a1, doc.nodePositions.a1);
});
