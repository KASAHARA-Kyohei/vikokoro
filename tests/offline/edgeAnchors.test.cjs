const assert = require("node:assert/strict");
const test = require("node:test");
const {
  makeEdgeKey,
  sanitizeEdgeAnchors,
} = require("../../.tmp-tests/src/editor/domain/edgeAnchors.js");

function makeDoc() {
  return {
    nodes: {
      root: { id: "root", text: "root", parentId: null, childrenIds: ["a"] },
      a: { id: "a", text: "a", parentId: "root", childrenIds: [] },
      b: { id: "b", text: "b", parentId: null, childrenIds: [] },
    },
  };
}

test("makeEdgeKey uses parent-to-child format", () => {
  assert.equal(makeEdgeKey("root", "a"), "root->a");
});

test("sanitizeEdgeAnchors keeps only valid existing parent-child edges", () => {
  const sanitized = sanitizeEdgeAnchors(makeDoc(), {
    "root->a": { from: "top", to: "left" },
    "root->b": { from: "right", to: "left" },
    "a->root": { from: "right", to: "left" },
    "ghost->a": { from: "right", to: "left" },
  });

  assert.deepEqual(sanitized, {
    "root->a": { from: "top", to: "left" },
  });
});

test("sanitizeEdgeAnchors treats invalid sides as auto and drops all-auto entries", () => {
  const sanitized = sanitizeEdgeAnchors(makeDoc(), {
    "root->a": { from: "diagonal", to: null },
  });

  assert.deepEqual(sanitized, {});
});
