const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildJumpSession,
  resolveJumpKey,
} = require("../../.tmp-tests/src/features/jump/model.js");

function makeDoc(nodeCount = 30) {
  const nodes = {
    root: { id: "root", text: "root", parentId: null, childrenIds: [] },
  };

  for (let i = 0; i < nodeCount; i += 1) {
    const id = `n${i}`;
    nodes[id] = { id, text: id, parentId: "root", childrenIds: [] };
    nodes.root.childrenIds.push(id);
  }

  return {
    id: "doc-1",
    rootId: "root",
    cursorId: "root",
    nodes,
    undoStack: [],
    redoStack: [],
  };
}

test("buildJumpSession: creates hint map for all positioned nodes", () => {
  const session = buildJumpSession(makeDoc(5));
  assert.equal(Object.keys(session.hintToNode).length, 6);
  assert.equal(Object.keys(session.nodeToHint).length, 6);
});

test("resolveJumpKey: escape and control-modified keys", () => {
  const session = buildJumpSession(makeDoc(2));

  const cancel = resolveJumpKey({
    session,
    prefix: "",
    key: "Escape",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  });
  assert.equal(cancel.type, "cancel");

  const keep = resolveJumpKey({
    session,
    prefix: "",
    key: "f",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
  });
  assert.equal(keep.type, "keep");
});

test("resolveJumpKey: two-stroke prefix then select", () => {
  const session = buildJumpSession(makeDoc(30));
  const twoCharHint = Object.keys(session.hintToNode).find((hint) => hint.length === 2);
  assert.ok(twoCharHint);

  const first = resolveJumpKey({
    session,
    prefix: "",
    key: twoCharHint[0],
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  });
  assert.equal(first.type, "setPrefix");
  assert.equal(first.prefix, twoCharHint[0]);

  const second = resolveJumpKey({
    session,
    prefix: first.prefix,
    key: twoCharHint[1],
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  });
  assert.equal(second.type, "select");
  assert.equal(second.nodeId, session.hintToNode[twoCharHint]);
});
