const assert = require("node:assert/strict");
const test = require("node:test");
const { buildSearchResults } = require("../../.tmp-tests/src/features/search/model.js");

function makeDoc() {
  return {
    id: "doc-1",
    rootId: "root",
    cursorId: "root",
    nodes: {
      root: { id: "root", text: "Root", parentId: null, childrenIds: ["a", "b"] },
      a: { id: "a", text: "Alpha task", note: "supplementary", parentId: "root", childrenIds: ["a1"] },
      a1: { id: "a1", text: "alpha deep", parentId: "a", childrenIds: ["a2"] },
      a2: { id: "a2", text: "alpha deeper", parentId: "a1", childrenIds: ["a3"] },
      a3: { id: "a3", text: "alpha deepest", parentId: "a2", childrenIds: ["a4"] },
      a4: { id: "a4", text: "alpha final", parentId: "a3", childrenIds: [] },
      b: { id: "b", text: "Beta", note: "memo only target", parentId: "root", childrenIds: [] },
    },
    undoStack: [],
    redoStack: [],
  };
}

test("buildSearchResults: empty query returns empty list", () => {
  const results = buildSearchResults(makeDoc(), "   ");
  assert.deepEqual(results, []);
});

test("buildSearchResults: case-insensitive match and sorted by depth", () => {
  const results = buildSearchResults(makeDoc(), "ALPHA");
  assert.equal(results.length, 5);

  for (let i = 1; i < results.length; i += 1) {
    assert.equal(results[i - 1].depth <= results[i].depth, true);
  }

  assert.equal(results[0].nodeId, "a");
  assert.equal(results[0].title, "Alpha task");
});

test("buildSearchResults: long path uses ellipsis", () => {
  const results = buildSearchResults(makeDoc(), "final");
  assert.equal(results.length, 1);
  assert.equal(results[0].nodeId, "a4");
  assert.equal(results[0].subtitle.includes("…"), true);
});

test("buildSearchResults: supports Japanese UI labels", () => {
  const results = buildSearchResults(makeDoc(), "alpha", "ja");
  assert.equal(results.length, 5);
  assert.equal(results[0].subtitle.startsWith("パス:"), true);
});

test("buildSearchResults: note text is not searchable", () => {
  const results = buildSearchResults(makeDoc(), "memo only target");
  assert.deepEqual(results, []);
});
