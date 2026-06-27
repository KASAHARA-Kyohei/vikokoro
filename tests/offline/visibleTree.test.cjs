const assert = require("node:assert/strict");
const test = require("node:test");
const { computeLayout } = require("../../.tmp-tests/src/editor/layout.js");
const {
  buildVisibleTreeProjection,
  countDescendants,
  sanitizeCollapsedNodeIds,
} = require("../../.tmp-tests/src/editor/domain/visibleTree.js");

function makeDoc() {
  return {
    id: "doc-1",
    rootId: "root",
    cursorId: "a",
    collapsedNodeIds: ["a"],
    nodePositions: {},
    edgeAnchors: {
      "root->a": { from: "right", to: "left" },
      "a->a1": { from: "bottom", to: "top" },
    },
    customLinks: {
      "a1<->b": { id: "a1<->b", fromId: "a1", toId: "b" },
      "a2<->b": { id: "a2<->b", fromId: "a2", toId: "b" },
    },
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["a", "b"] },
      a: { id: "a", text: "a", parentId: "root", childrenIds: ["a1", "a2"] },
      a1: { id: "a1", text: "a1", parentId: "a", childrenIds: ["a11"] },
      a11: { id: "a11", text: "a11", parentId: "a1", childrenIds: [] },
      a2: { id: "a2", text: "a2", parentId: "a", childrenIds: [] },
      b: { id: "b", text: "b", parentId: "root", childrenIds: [] },
    },
    undoStack: [],
    redoStack: [],
  };
}

test("collapsed branch hides descendants and reports their count", () => {
  const projection = buildVisibleTreeProjection(makeDoc(), null);
  assert.deepEqual(Object.keys(projection.state.nodes).sort(), ["a", "b", "root"]);
  assert.deepEqual(projection.state.nodes.a.childrenIds, []);
  assert.equal(projection.hiddenDescendantCounts.a, 3);
  assert.equal(countDescendants(makeDoc(), "a"), 3);
  assert.deepEqual(projection.state.edgeAnchors, {
    "root->a": { from: "right", to: "left" },
  });
  assert.deepEqual(projection.state.customLinks, {});
});

test("focused branch becomes layout root at depth zero", () => {
  const doc = { ...makeDoc(), collapsedNodeIds: [] };
  const projection = buildVisibleTreeProjection(doc, "a");
  const layout = computeLayout(projection.state);

  assert.equal(projection.state.rootId, "a");
  assert.equal(projection.state.nodes.a.parentId, null);
  assert.equal(layout.positions.a.depth, 0);
  assert.equal(layout.positions.a1.depth, 1);
  assert.equal(projection.state.nodes.b, undefined);
  assert.deepEqual(projection.state.edgeAnchors["a->a1"], {
    from: "bottom",
    to: "top",
  });
  assert.deepEqual(projection.state.customLinks, {});
});

test("custom links are visible only when both endpoints are visible", () => {
  const doc = { ...makeDoc(), collapsedNodeIds: [] };
  const projection = buildVisibleTreeProjection(doc, null);

  assert.deepEqual(projection.state.customLinks, {
    "a1<->b": { id: "a1<->b", fromId: "a1", toId: "b" },
    "a2<->b": { id: "a2<->b", fromId: "a2", toId: "b" },
  });
});

test("sanitizeCollapsedNodeIds removes leaves, missing IDs, and duplicates", () => {
  const doc = makeDoc();
  assert.deepEqual(
    sanitizeCollapsedNodeIds(doc, ["a", "a", "b", "missing"]),
    ["a"],
  );
});
