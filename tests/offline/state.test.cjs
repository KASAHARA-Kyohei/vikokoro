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

function withTree(state) {
  const docId = state.workspace.activeDocId;
  return {
    ...state,
    workspace: {
      ...state.workspace,
      documents: {
        ...state.workspace.documents,
        [docId]: {
          id: docId,
          rootId: "root",
          cursorId: "a",
          collapsedNodeIds: [],
          nodePositions: {
            root: { x: 0, y: 25 },
            a: { x: 260, y: 0 },
            a1: { x: 520, y: 0 },
            b: { x: 260, y: 50 },
          },
          edgeAnchors: {},
          customLinks: {},
          stickyNotes: {},
          nodes: {
            root: { id: "root", text: "root", parentId: null, childrenIds: ["a", "b"] },
            a: { id: "a", text: "a", parentId: "root", childrenIds: ["a1"] },
            a1: { id: "a1", text: "a1", parentId: "a", childrenIds: [] },
            b: { id: "b", text: "b", parentId: "root", childrenIds: [] },
          },
          undoStack: [],
          redoStack: [],
        },
      },
    },
  };
}

test("collapse state is saved but does not create an undo entry", () => {
  let state = withTree(makeReadyState());
  state = editorReducer(state, { type: "collapseNode" });
  const doc = state.workspace.documents[state.workspace.activeDocId];

  assert.deepEqual(doc.collapsedNodeIds, ["a"]);
  assert.equal(doc.undoStack.length, 0);
  assert.equal(state.saveRevision, 1);
});

test("collapsing an ancestor moves cursor to the collapsed node", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].cursorId = "a1";
  state = editorReducer(state, { type: "collapseNode", nodeId: "a" });

  assert.equal(state.workspace.documents[docId].cursorId, "a");
});

test("search reveal expands ancestors and exits unrelated focus", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].collapsedNodeIds = ["a"];
  state = { ...state, focusRootId: "b" };

  state = editorReducer(state, { type: "selectNodeReveal", nodeId: "a1" });

  assert.equal(state.focusRootId, null);
  assert.equal(state.workspace.documents[docId].cursorId, "a1");
  assert.deepEqual(state.workspace.documents[docId].collapsedNodeIds, []);
});

test("legacy hydration defaults and sanitizes collapsed node IDs", () => {
  const initial = createInitialAppState();
  const legacy = withTree(makeReadyState()).workspace;
  const docId = legacy.activeDocId;
  delete legacy.documents[docId].collapsedNodeIds;
  delete legacy.documents[docId].edgeAnchors;
  delete legacy.documents[docId].customLinks;
  delete legacy.documents[docId].stickyNotes;

  const state = editorReducer(initial, {
    type: "finishHydration",
    workspace: legacy,
  });

  assert.deepEqual(state.workspace.documents[docId].collapsedNodeIds, []);
  assert.deepEqual(state.workspace.documents[docId].edgeAnchors, {});
  assert.deepEqual(state.workspace.documents[docId].customLinks, {});
  assert.deepEqual(state.workspace.documents[docId].stickyNotes, {});
});

test("adding a sibling outside the focused branch exits focus", () => {
  let state = { ...withTree(makeReadyState()), focusRootId: "a" };
  state = editorReducer(state, { type: "addSiblingAndInsert" });

  assert.equal(state.focusRootId, null);
});

test("outdenting the cursor outside the focused branch exits focus", () => {
  let state = { ...withTree(makeReadyState()), focusRootId: "a" };
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].cursorId = "a1";

  state = editorReducer(state, { type: "reparentNode", direction: "left" });

  assert.equal(state.focusRootId, null);
  assert.equal(state.workspace.documents[docId].nodes.a1.parentId, "root");
});

test("moving multiple nodes is one undo step and undo restores positions", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, {
    type: "moveNodes",
    nodeIds: ["a", "a1"],
    dx: -12,
    dy: 24,
  });

  let doc = state.workspace.documents[docId];
  assert.deepEqual(doc.nodePositions.a, { x: 248, y: 24 });
  assert.deepEqual(doc.nodePositions.a1, { x: 508, y: 24 });
  assert.equal(doc.undoStack.length, 1);

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.nodePositions.a, { x: 260, y: 0 });
  assert.deepEqual(doc.nodePositions.a1, { x: 520, y: 0 });
});

test("branch auto-layout keeps branch root position", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].nodePositions.a1 = { x: -300, y: 900 };

  state = editorReducer(state, { type: "autoLayout", scope: "branch" });

  const doc = state.workspace.documents[docId];
  assert.deepEqual(doc.nodePositions.a, { x: 260, y: 0 });
  assert.deepEqual(doc.nodePositions.a1, { x: 520, y: 0 });
  assert.equal(doc.undoStack.length, 1);
});

test("insert text growth pushes down a colliding lower branch", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, { type: "enterInsert" });
  state = editorReducer(state, {
    type: "setCursorText",
    text: "line 1\nline 2\nline 3",
  });

  let doc = state.workspace.documents[docId];
  assert.equal(state.mode, "insert");
  assert.deepEqual(doc.nodePositions.a, { x: 260, y: 0 });
  assert.deepEqual(doc.nodePositions.b, { x: 260, y: 86 });
  assert.equal(doc.undoStack.length, 0);

  state = editorReducer(state, { type: "commitInsert" });
  doc = state.workspace.documents[docId];
  assert.equal(state.mode, "normal");
  assert.equal(doc.undoStack.length, 1);
});

test("blank-canvas child creation stores the requested position", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, {
    type: "addChildAtPosition",
    point: { x: -140, y: 330 },
  });

  const doc = state.workspace.documents[docId];
  assert.equal(state.mode, "insert");
  assert.deepEqual(doc.nodePositions[doc.cursorId], { x: -140, y: 330 });
  assert.equal(doc.nodes[doc.cursorId].parentId, "a");
});

test("legacy hydration fills node positions and drops unknown positions", () => {
  const initial = createInitialAppState();
  const workspace = withTree(makeReadyState()).workspace;
  const docId = workspace.activeDocId;
  workspace.documents[docId].nodePositions = {
    root: { x: -10, y: 20 },
    ghost: { x: 1, y: 2 },
  };

  const state = editorReducer(initial, {
    type: "finishHydration",
    workspace,
  });
  const positions = state.workspace.documents[docId].nodePositions;

  assert.deepEqual(positions.root, { x: -10, y: 20 });
  assert.equal(Boolean(positions.a), true);
  assert.equal(Boolean(positions.ghost), false);
});

test("manual connector anchors are undoable and redoable", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, {
    type: "setEdgeAnchor",
    edgeKey: "root->a",
    endpoint: "from",
    side: "bottom",
  });
  state = editorReducer(state, {
    type: "setEdgeAnchor",
    edgeKey: "root->a",
    endpoint: "to",
    side: "top",
  });

  let doc = state.workspace.documents[docId];
  assert.deepEqual(doc.edgeAnchors["root->a"], { from: "bottom", to: "top" });
  assert.equal(doc.undoStack.length, 2);

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.edgeAnchors["root->a"], { from: "bottom", to: null });

  state = editorReducer(state, { type: "redo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.edgeAnchors["root->a"], { from: "bottom", to: "top" });
});

test("resetting connector anchors creates one undo step", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].edgeAnchors = {
    "root->a": { from: "right", to: "left" },
  };

  state = editorReducer(state, { type: "resetEdgeAnchors", edgeKey: "root->a" });

  let doc = state.workspace.documents[docId];
  assert.deepEqual(doc.edgeAnchors, {});
  assert.equal(doc.undoStack.length, 1);

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.edgeAnchors["root->a"], { from: "right", to: "left" });
});

test("node deletion removes invalid connector anchors", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].edgeAnchors = {
    "root->a": { from: "right", to: "left" },
    "a->a1": { from: "bottom", to: "top" },
  };
  state.workspace.documents[docId].cursorId = "a";

  state = editorReducer(state, { type: "deleteNode" });

  const doc = state.workspace.documents[docId];
  assert.deepEqual(doc.edgeAnchors, {});
});

test("custom links are undoable and redoable", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, { type: "addCustomLink", fromId: "a1", toId: "b" });

  let doc = state.workspace.documents[docId];
  assert.deepEqual(doc.customLinks["a1<->b"], {
    id: "a1<->b",
    fromId: "a1",
    toId: "b",
  });
  assert.equal(doc.undoStack.length, 1);

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.customLinks, {});

  state = editorReducer(state, { type: "redo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.customLinks["a1<->b"], {
    id: "a1<->b",
    fromId: "a1",
    toId: "b",
  });
});

test("custom links reject self, parent-child, and duplicate pairs", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, { type: "addCustomLink", fromId: "a", toId: "a" });
  state = editorReducer(state, { type: "addCustomLink", fromId: "root", toId: "a" });
  state = editorReducer(state, { type: "addCustomLink", fromId: "b", toId: "a1" });
  state = editorReducer(state, { type: "addCustomLink", fromId: "a1", toId: "b" });

  const doc = state.workspace.documents[docId];
  assert.deepEqual(Object.keys(doc.customLinks), ["a1<->b"]);
  assert.equal(doc.undoStack.length, 1);
});

test("node deletion removes invalid custom links", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].customLinks = {
    "a1<->b": { id: "a1<->b", fromId: "a1", toId: "b" },
  };
  state.workspace.documents[docId].cursorId = "a1";

  state = editorReducer(state, { type: "deleteNode" });

  const doc = state.workspace.documents[docId];
  assert.deepEqual(doc.customLinks, {});
});

test("sticky notes are undoable and redoable", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;

  state = editorReducer(state, {
    type: "addStickyNote",
    note: { id: "note-1", text: "memo", position: { x: -20, y: 40 } },
  });

  let doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes["note-1"], {
    id: "note-1",
    text: "memo",
    position: { x: -20, y: 40 },
  });
  assert.equal(doc.undoStack.length, 1);

  state = editorReducer(state, { type: "moveStickyNote", noteId: "note-1", dx: 30, dy: -10 });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes["note-1"].position, { x: 10, y: 30 });
  assert.equal(doc.undoStack.length, 2);

  state = editorReducer(state, { type: "deleteStickyNote", noteId: "note-1" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes, {});
  assert.equal(doc.undoStack.length, 3);

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes["note-1"].position, { x: 10, y: 30 });

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes["note-1"].position, { x: -20, y: 40 });

  state = editorReducer(state, { type: "redo" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes["note-1"].position, { x: 10, y: 30 });
});

test("sticky text edit commits as one undo step and removes blank notes", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].stickyNotes = {
    "note-1": { id: "note-1", text: "memo", position: { x: 10, y: 20 } },
  };

  state = editorReducer(state, { type: "beginStickyEdit" });
  state = editorReducer(state, { type: "setStickyNoteText", noteId: "note-1", text: "memo 1" });
  state = editorReducer(state, { type: "setStickyNoteText", noteId: "note-1", text: "memo 2" });
  assert.equal(state.workspace.documents[docId].undoStack.length, 0);

  state = editorReducer(state, { type: "commitStickyEdit", noteId: "note-1" });
  let doc = state.workspace.documents[docId];
  assert.equal(doc.stickyNotes["note-1"].text, "memo 2");
  assert.equal(doc.undoStack.length, 1);

  state = editorReducer(state, { type: "beginStickyEdit" });
  state = editorReducer(state, { type: "setStickyNoteText", noteId: "note-1", text: "   " });
  state = editorReducer(state, { type: "commitStickyEdit", noteId: "note-1" });
  doc = state.workspace.documents[docId];
  assert.deepEqual(doc.stickyNotes, {});
  assert.equal(doc.undoStack.length, 2);

  state = editorReducer(state, { type: "undo" });
  doc = state.workspace.documents[docId];
  assert.equal(doc.stickyNotes["note-1"].text, "memo 2");
});

test("sticky text edit without changes does not add undo entry", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].stickyNotes = {
    "note-1": { id: "note-1", text: "memo", position: { x: 10, y: 20 } },
  };

  state = editorReducer(state, { type: "beginStickyEdit" });
  state = editorReducer(state, { type: "commitStickyEdit", noteId: "note-1" });

  const doc = state.workspace.documents[docId];
  assert.equal(doc.undoStack.length, 0);
  assert.equal(state.stickyEditOrigin, null);
});

test("reparent removes connector anchors for edges that no longer exist", () => {
  let state = withTree(makeReadyState());
  const docId = state.workspace.activeDocId;
  state.workspace.documents[docId].edgeAnchors = {
    "a->a1": { from: "right", to: "left" },
  };
  state.workspace.documents[docId].cursorId = "a1";

  state = editorReducer(state, { type: "reparentNode", direction: "left" });

  const doc = state.workspace.documents[docId];
  assert.equal(doc.nodes.a1.parentId, "root");
  assert.deepEqual(doc.edgeAnchors, {});
});
