const assert = require("node:assert/strict");
const test = require("node:test");
const { createInitialAppState, editorReducer } = require("../../.tmp-tests/src/editor/state.js");

function makeReadyState() {
  const initial = createInitialAppState();
  return {
    ...initial,
    hydrated: true,
  };
}

test("note edit commits as a single undo step", () => {
  let state = makeReadyState();

  state = editorReducer(state, { type: "beginNoteEdit" });
  state = editorReducer(state, { type: "setCursorNote", note: "first" });
  state = editorReducer(state, { type: "setCursorNote", note: "first\nsecond" });

  assert.equal(state.workspace.documents[state.workspace.activeDocId].undoStack.length, 0);

  state = editorReducer(state, { type: "commitNoteEdit" });

  const doc = state.workspace.documents[state.workspace.activeDocId];
  assert.equal(doc.nodes[doc.cursorId].note, "first\nsecond");
  assert.equal(doc.undoStack.length, 1);
  assert.equal(state.noteEditOrigin, null);
});

test("note edit without changes does not add undo entry", () => {
  let state = makeReadyState();
  state = editorReducer(state, { type: "beginNoteEdit" });
  state = editorReducer(state, { type: "commitNoteEdit" });

  const doc = state.workspace.documents[state.workspace.activeDocId];
  assert.equal(doc.undoStack.length, 0);
  assert.equal(state.noteEditOrigin, null);
});

test("blank note is normalized away", () => {
  let state = makeReadyState();

  state = editorReducer(state, { type: "beginNoteEdit" });
  state = editorReducer(state, { type: "setCursorNote", note: "memo" });
  state = editorReducer(state, { type: "commitNoteEdit" });

  state = editorReducer(state, { type: "beginNoteEdit" });
  state = editorReducer(state, { type: "setCursorNote", note: "   " });
  state = editorReducer(state, { type: "commitNoteEdit" });

  const doc = state.workspace.documents[state.workspace.activeDocId];
  assert.equal(doc.nodes[doc.cursorId].note, undefined);
});
