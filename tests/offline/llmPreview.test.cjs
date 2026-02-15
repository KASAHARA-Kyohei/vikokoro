const assert = require("node:assert/strict");
const test = require("node:test");
const { buildImprovePreview } = require("../../.tmp-tests/src/features/llm/preview.js");

function makeDocument() {
  return {
    rootId: "root",
    cursorId: "a",
    nodes: {
      root: {
        id: "root",
        text: "Root",
        parentId: null,
        childrenIds: ["a", "b"],
        color: null,
      },
      a: {
        id: "a",
        text: "A",
        parentId: "root",
        childrenIds: [],
        color: null,
      },
      b: {
        id: "b",
        text: "B",
        parentId: "root",
        childrenIds: [],
        color: null,
      },
    },
  };
}

test("buildImprovePreview: includes refs and parent-group labels", () => {
  const preview = buildImprovePreview(
    "summary",
    [],
    [
      {
        op: "add",
        parentId: "a",
        index: 0,
        node: { tempId: "n1", text: "A-1", color: null },
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
        op: "setColor",
        nodeId: "b",
        color: "green",
      },
      {
        op: "delete",
        nodeId: "n1",
        strategy: "promoteChildren",
      },
    ],
    makeDocument(),
  );

  assert.deepEqual(preview.operationCounts, {
    add: 1,
    updateText: 1,
    setColor: 1,
    move: 1,
    delete: 1,
  });
  assert.equal(preview.changes.length, 5);
  assert.equal(preview.hiddenChangeCount, 0);

  assert.equal(preview.changes[0].groupLabel, "親: 「A」");
  assert.equal(preview.changes[0].nodeRef, "n1");
  assert.equal(preview.changes[0].parentRef, "a");

  assert.equal(preview.changes[1].groupLabel, "親: 「Root」");
  assert.equal(preview.changes[1].nodeRef, "a");
  assert.equal(preview.changes[1].parentRef, "root");

  assert.equal(preview.changes[2].groupLabel, "親: 「A updated」");
  assert.equal(preview.changes[2].nodeRef, "b");
  assert.equal(preview.changes[2].parentRef, "a");

  assert.equal(preview.changes[3].groupLabel, "親: 「A updated」");
  assert.equal(preview.changes[3].nodeRef, "b");
  assert.equal(preview.changes[3].parentRef, "a");

  assert.equal(preview.changes[4].groupLabel, "親: 「A updated」");
  assert.equal(preview.changes[4].nodeRef, "n1");
  assert.equal(preview.changes[4].parentRef, "a");
});

test("buildImprovePreview: clips long change list and reports hidden count", () => {
  const operations = Array.from({ length: 13 }, (_, index) => ({
    op: "setColor",
    nodeId: "a",
    color: index % 2 === 0 ? "green" : "blue",
  }));

  const preview = buildImprovePreview("summary", [], operations, makeDocument());
  assert.equal(preview.changes.length, 12);
  assert.equal(preview.hiddenChangeCount, 1);
  assert.equal(preview.changes.every((c) => c.nodeRef === "a"), true);
});
