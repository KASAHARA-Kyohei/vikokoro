const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseGenerateRequest,
  parseGenerateResponse,
  parseImproveRequest,
  parseImproveResponse,
  parseAndValidateImproveResponse,
  parseReviewRequest,
  parseReviewResponse,
  parseAndValidateReviewResponse,
  validateImproveResponseAgainstDocument,
  validateReviewResponseAgainstDocument,
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

test("parseImproveRequest: empty node text is accepted", () => {
  const document = makeDocument();
  document.nodes.a.text = "";

  const parsed = parseImproveRequest({
    version: "1",
    mode: "improve",
    goal: "test",
    document,
    constraints: {
      maxAdditions: 10,
      keepExistingText: true,
      allowReparent: true,
      allowDelete: false,
    },
  });
  assert.equal(parsed.ok, true);
});

test("parseReviewRequest: valid payload", () => {
  const parsed = parseReviewRequest({
    version: "1",
    mode: "review",
    focus: "漏れと次のアクションを確認",
    document: makeDocument(),
    constraints: {
      maxFindings: 6,
      includeStrengths: true,
      includeNextActions: true,
    },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.mode, "review");
  assert.equal(parsed.value.constraints.maxFindings, 6);
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

test("parseReviewResponse: empty arrays are accepted", () => {
  const parsed = parseReviewResponse({
    version: "1",
    mode: "review",
    summary: "ok",
    strengths: [],
    findings: [],
    nextActions: [],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.findings.length, 0);
});

test("parseReviewResponse: invalid severity is rejected", () => {
  const parsed = parseReviewResponse({
    version: "1",
    mode: "review",
    summary: "bad",
    strengths: [],
    findings: [
      {
        severity: "urgent",
        title: "bad",
        detail: "bad",
        suggestion: "bad",
        nodeRefs: [],
      },
    ],
    nextActions: [],
  });
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.errors.some((e) => e.includes("severity")), true);
});

test("validateReviewResponseAgainstDocument: unknown node ref is rejected", () => {
  const response = parseReviewResponse({
    version: "1",
    mode: "review",
    summary: "ok",
    strengths: [],
    findings: [
      {
        severity: "high",
        title: "missing",
        detail: "detail",
        suggestion: "suggestion",
        nodeRefs: ["missing-node"],
      },
    ],
    nextActions: [],
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;

  const errors = validateReviewResponseAgainstDocument(response.value, makeDocument());
  assert.equal(errors.some((e) => e.includes("unknown node")), true);
});

test("parseAndValidateReviewResponse: valid response passes", () => {
  const result = parseAndValidateReviewResponse(
    {
      version: "1",
      mode: "review",
      summary: "ok",
      strengths: ["構造が大きく崩れていない"],
      findings: [
        {
          severity: "medium",
          title: "粒度が粗い",
          detail: "a 配下が抽象的です。",
          suggestion: "具体タスクに分解してください。",
          nodeRefs: ["a"],
        },
      ],
      nextActions: ["a を 3 つの実行タスクに分解する"],
    },
    makeDocument(),
  );
  assert.equal(result.ok, true);
});
