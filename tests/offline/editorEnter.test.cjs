const assert = require("node:assert/strict");
const test = require("node:test");
const {
  IME_ENTER_GRACE_MS,
  createEditorEnterState,
  transitionEditorEnter,
} = require("../../.tmp-tests/src/editor/domain/editorEnter.js");

function transition(state, event) {
  return transitionEditorEnter(state, event);
}

function enterKeyDown(overrides = {}) {
  return {
    type: "enterKeyDown",
    timeStamp: 1000,
    shiftKey: false,
    repeat: false,
    nativeIsComposing: false,
    keyCode: 13,
    ...overrides,
  };
}

test("IME use requires one cushion Enter before commit", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1000,
  });

  result = transition(result.state, enterKeyDown({ timeStamp: 1200 }));
  assert.equal(result.decision, "ignoreEnter");
  assert.equal(result.state.phase, "awaitingCommit");

  result = transition(result.state, { type: "enterKeyUp" });
  result = transition(result.state, enterKeyDown({ timeStamp: 1400 }));
  assert.equal(result.decision, "commit");
});

test("IME confirmation Enter is the cushion and the next Enter commits", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, enterKeyDown({
    nativeIsComposing: true,
    keyCode: 229,
  }));
  assert.equal(result.decision, "passToIme");

  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1001,
  });
  assert.equal(result.state.phase, "awaitingCommit");
  result = transition(result.state, { type: "enterKeyUp" });

  result = transition(result.state, enterKeyDown({ timeStamp: 1200 }));
  assert.equal(result.decision, "commit");
});

test("compositionend before its keydown treats that Enter as the cushion", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1000,
  });
  result = transition(result.state, enterKeyDown({
    timeStamp: 1000 + IME_ENTER_GRACE_MS,
    keyCode: 13,
  }));
  assert.equal(result.decision, "ignoreEnter");
  assert.equal(result.state.phase, "awaitingCommit");

  result = transition(result.state, { type: "enterKeyUp" });
  result = transition(result.state, enterKeyDown({ timeStamp: 1200 }));
  assert.equal(result.decision, "commit");
});

test("Windows keyCode 229 does not require an extra Enter after cushion", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1000,
  });
  result = transition(result.state, enterKeyDown({
    timeStamp: 1200,
    keyCode: 229,
  }));
  assert.equal(result.decision, "ignoreEnter");

  result = transition(result.state, { type: "enterKeyUp" });
  result = transition(result.state, enterKeyDown({
    timeStamp: 1400,
    keyCode: 229,
  }));
  assert.equal(result.decision, "commit");
});

test("English-only editing commits on the first Enter", () => {
  const result = transition(
    createEditorEnterState(),
    enterKeyDown(),
  );
  assert.equal(result.decision, "commit");
});

test("repeated Enter keydown never commits", () => {
  const result = transition(
    createEditorEnterState(),
    enterKeyDown({ repeat: true }),
  );
  assert.equal(result.decision, "ignoreEnter");
});

test("Shift+Enter inserts a line break without consuming pending commit", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1000,
  });
  result = transition(result.state, enterKeyDown({
    timeStamp: 1200,
    shiftKey: true,
  }));
  assert.equal(result.decision, "lineBreak");
  assert.equal(result.state.phase, "awaitingCushion");
});

test("reset clears IME use for the edit session", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, { type: "reset" });
  assert.deepEqual(result.state, createEditorEnterState());
});
