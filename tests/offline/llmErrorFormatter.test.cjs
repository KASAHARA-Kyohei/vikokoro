const assert = require("node:assert/strict");
const test = require("node:test");
const {
  formatLlmDocumentIntegrityError,
  formatLlmResponseValidationError,
  formatLlmRuntimeError,
} = require("../../.tmp-tests/src/features/llm/errorFormatter.js");

function makeDoc() {
  return {
    id: "doc-1",
    rootId: "root",
    cursorId: "a",
    nodes: {
      root: {
        id: "root",
        text: "Root",
        parentId: null,
        childrenIds: ["a"],
      },
      a: {
        id: "a",
        text: "Parent",
        parentId: "root",
        childrenIds: ["missing-node"],
      },
    },
    undoStack: [],
    redoStack: [],
  };
}

test("formatLlmDocumentIntegrityError: humanizes raw schema errors", () => {
  const message = formatLlmDocumentIntegrityError(makeDoc(), [
    'input.document.cursorId "missing-cursor" does not exist in nodes',
    'input.document.nodes.a.childrenIds[0] references missing node "missing-node"',
  ]);

  assert.equal(message.includes("現在のマインドマップに整合性の問題"), true);
  assert.equal(message.includes("選択中ノードが見つかりません"), true);
  assert.equal(message.includes("「Parent」"), true);
  assert.equal(message.includes("子ノード参照が壊れています"), true);
});

test("formatLlmDocumentIntegrityError: can format English messages", () => {
  const message = formatLlmDocumentIntegrityError(
    makeDoc(),
    ['input.document.nodes.a.childrenIds[0] references missing node "missing-node"'],
    "en",
  );

  assert.equal(message.includes("AI cannot run"), true);
  assert.equal(message.includes('"Parent"'), true);
  assert.equal(message.includes("broken"), true);
});

test("formatLlmResponseValidationError: humanizes improve response shape errors", () => {
  const message = formatLlmResponseValidationError(
    "improve",
    [
      "input.operations[0].nodeId must be a string (got undefined)",
      "input.operations[1].index must be an integer (got undefined)",
      "input.operations[1].node must be an object",
    ],
    "ja",
  );

  assert.equal(message.includes("改善案を正しい形式で返せなかった"), true);
  assert.equal(message.includes("対象ノード(nodeId)"), true);
  assert.equal(message.includes("位置(index)"), true);
  assert.equal(message.includes("追加ノード(node)"), true);
});

test("formatLlmRuntimeError: humanizes truncated JSON errors", () => {
  const message = formatLlmRuntimeError(
    "Gemini response was cut off before the JSON finished. Retry the request or narrow the improve goal.",
    "ja",
  );

  assert.equal(message.includes("途中で切れた"), true);
  assert.equal(message.includes("改善方針を少し絞って"), true);
});

test("formatLlmRuntimeError: humanizes invalid JSON errors", () => {
  const message = formatLlmRuntimeError(
    "Gemini returned invalid JSON: EOF while parsing a string. Raw: {",
    "ja",
  );

  assert.equal(message.includes("壊れた JSON"), true);
});
