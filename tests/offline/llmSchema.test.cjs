const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseGenerateRequest,
  parseGenerateResponse,
  parseImproveRequest,
  parseImproveResponse,
  parseAndValidateImproveResponse,
  validateImproveResponseAgainstDocument,
} = require("../../.tmp-tests/src/features/llm/schema.js");

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
        childrenIds: ["a1"],
        color: null,
      },
      a1: {
        id: "a1",
        text: "A1",
        parentId: "a",
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

test("parseGenerateRequest: valid payload", () => {
  const parsed = parseGenerateRequest({
    version: "1",
    mode: "generate",
    topic: "業務改善",
    language: "ja",
    maxDepth: 3,
    maxChildrenPerNode: 6,
    style: "balanced",
    constraints: {
      avoidAbstractOnly: true,
      preferActionable: true,
    },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.mode, "generate");
  assert.equal(parsed.value.style, "balanced");
});

test("parseGenerateResponse: duplicate tempId is rejected", () => {
  const parsed = parseGenerateResponse({
    version: "1",
    mode: "generate",
    root: {
      tempId: "n1",
      text: "root",
      color: null,
      children: [
        {
          tempId: "n1",
          text: "child",
          color: null,
          children: [],
        },
      ],
    },
  });
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.errors.some((e) => e.includes("must be unique")), true);
});

test("parseImproveRequest: broken tree is rejected", () => {
  const parsed = parseImproveRequest({
    version: "1",
    mode: "improve",
    goal: "test",
    document: {
      rootId: "root",
      cursorId: "a",
      nodes: {
        root: {
          id: "root",
          text: "root",
          parentId: null,
          childrenIds: ["a"],
          color: null,
        },
        a: {
          id: "a",
          text: "a",
          parentId: null,
          childrenIds: [],
          color: null,
        },
      },
    },
    constraints: {
      maxAdditions: 10,
      keepExistingText: true,
      allowReparent: true,
      allowDelete: false,
    },
  });
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.errors.some((e) => e.includes("parentId")), true);
});

test("validateImproveResponseAgainstDocument: valid operations pass", () => {
  const response = parseImproveResponse({
    version: "1",
    mode: "improve",
    summary: "ok",
    warnings: [],
    operations: [
      {
        op: "add",
        parentId: "a",
        index: 1,
        node: {
          tempId: "n100",
          text: "new",
          color: "green",
        },
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
    ],
  });

  assert.equal(response.ok, true);
  if (!response.ok) return;

  const errors = validateImproveResponseAgainstDocument(response.value, makeDocument());
  assert.deepEqual(errors, []);
});

test("parseAndValidateImproveResponse: root delete is rejected", () => {
  const result = parseAndValidateImproveResponse(
    {
      version: "1",
      mode: "improve",
      summary: "bad",
      warnings: [],
      operations: [{ op: "delete", nodeId: "root", strategy: "promoteChildren" }],
    },
    makeDocument(),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors.some((e) => e.includes("cannot delete root node")), true);
});
