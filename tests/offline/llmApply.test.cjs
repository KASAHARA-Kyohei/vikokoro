const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildDocumentStateFromGeneratedTree,
  documentToImproveDocumentState,
  applyImproveOperationsToDocument,
} = require("../../.tmp-tests/src/features/llm/apply.js");

function makeDoc() {
  return {
    id: "doc-1",
    rootId: "root",
    cursorId: "a",
    nodes: {
      root: {
        id: "root",
        text: "root",
        parentId: null,
        childrenIds: ["a", "b"],
      },
      a: {
        id: "a",
        text: "A",
        parentId: "root",
        childrenIds: [],
      },
      b: {
        id: "b",
        text: "B",
        parentId: "root",
        childrenIds: [],
      },
    },
    undoStack: [],
    redoStack: [],
  };
}

test("buildDocumentStateFromGeneratedTree: builds node links", () => {
  const state = buildDocumentStateFromGeneratedTree({
    tempId: "n1",
    text: "topic",
    color: null,
    children: [
      { tempId: "n2", text: "child-1", color: "green", children: [] },
      { tempId: "n3", text: "child-2", color: null, children: [] },
    ],
  });

  assert.equal(Boolean(state.nodes[state.rootId]), true);
  const root = state.nodes[state.rootId];
  assert.equal(root.parentId, null);
  assert.equal(root.childrenIds.length, 2);
  const child = state.nodes[root.childrenIds[0]];
  assert.equal(child.parentId, root.id);
});

test("applyImproveOperationsToDocument: add/update/move/delete", () => {
  const improveDoc = documentToImproveDocumentState(makeDoc());
  const applied = applyImproveOperationsToDocument(improveDoc, [
    {
      op: "add",
      parentId: "a",
      index: 0,
      node: { tempId: "n100", text: "A-1", color: "yellow" },
    },
    {
      op: "updateText",
      nodeId: "a",
      text: "A updated",
    },
    {
      op: "move",
      nodeId: "b",
      newParentId: "a",
      index: 1,
    },
    {
      op: "delete",
      nodeId: "n100",
      strategy: "promoteChildren",
    },
  ]);

  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const root = applied.value.nodes[applied.value.rootId];
  const aId = root.childrenIds[0];
  assert.equal(aId !== undefined, true);
  const a = applied.value.nodes[aId];
  assert.equal(a.text, "A updated");
  assert.equal(a.childrenIds.length, 1);
});

test("applyImproveOperationsToDocument: rejects invalid move", () => {
  const improveDoc = documentToImproveDocumentState(makeDoc());
  const applied = applyImproveOperationsToDocument(improveDoc, [
    {
      op: "move",
      nodeId: "a",
      newParentId: "a",
      index: 0,
    },
  ]);
  assert.equal(applied.ok, false);
  if (applied.ok) return;
  assert.equal(applied.errors.some((e) => e.includes("under itself")), true);
});
