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
    ...overrides,
  };
}

test("the next Enter commits when the IME sends only compositionend", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1000,
  });

  result = transition(result.state, enterKeyDown({ timeStamp: 1200 }));
  assert.equal(result.decision, "commit");
});

test("releasing the IME confirmation key allows a quick next Enter", () => {
  let result = transition(createEditorEnterState(), { type: "compositionStart" });
  result = transition(result.state, { type: "compositionEnd", timeStamp: 1000 });
  result = transition(result.state, { type: "enterKeyUp" });
  result = transition(result.state, enterKeyDown({ timeStamp: 1020 }));
  assert.equal(result.decision, "commit");
});

test("IME confirmation Enter stays with the IME and the next Enter commits", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, enterKeyDown({
    nativeIsComposing: true,
  }));
  assert.equal(result.decision, "passToIme");

  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1001,
  });
  result = transition(result.state, { type: "enterKeyUp" });

  result = transition(result.state, enterKeyDown({ timeStamp: 1020 }));
  assert.equal(result.decision, "commit");
});

test("compositionend before its keydown does not let the same Enter commit", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, {
    type: "compositionEnd",
    timeStamp: 1000,
  });
  result = transition(result.state, enterKeyDown({
    timeStamp: 1000 + IME_ENTER_GRACE_MS,
  }));
  assert.equal(result.decision, "ignoreEnter");

  result = transition(result.state, { type: "enterKeyUp" });
  result = transition(result.state, enterKeyDown({ timeStamp: 1200 }));
  assert.equal(result.decision, "commit");
});

test("a delayed confirmation keydown cannot reopen an ended composition", () => {
  let result = transition(createEditorEnterState(), { type: "compositionStart" });
  result = transition(result.state, { type: "compositionEnd", timeStamp: 1000 });
  result = transition(result.state, enterKeyDown({
    timeStamp: 1001,
    nativeIsComposing: true,
  }));
  assert.equal(result.decision, "ignoreEnter");

  result = transition(result.state, { type: "enterKeyUp" });
  result = transition(result.state, enterKeyDown({ timeStamp: 1200 }));
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

test("Shift+Enter after composition inserts a line break and the next Enter commits", () => {
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
  result = transition(result.state, enterKeyDown({ timeStamp: 1400 }));
  assert.equal(result.decision, "commit");
});

test("reset clears IME use for the edit session", () => {
  let result = transition(createEditorEnterState(), {
    type: "compositionStart",
  });
  result = transition(result.state, { type: "reset" });
  assert.deepEqual(result.state, createEditorEnterState());
});
