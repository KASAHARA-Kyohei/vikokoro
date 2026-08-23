const assert = require("node:assert/strict");
const test = require("node:test");
const { parsePersistedWorkspace } = require("../../.tmp-tests/src/persistence/workspaceParser.js");

function validWorkspace() {
  return {
    schemaVersion: 3,
    activeDocId: "doc",
    tabs: [{ docId: "doc" }],
    documents: {
      doc: {
        id: "doc",
        rootId: "root",
        cursorId: "root",
        nodes: {
          root: { id: "root", text: "topic", parentId: null, childrenIds: ["child"] },
          child: { id: "child", text: "idea", parentId: "root", childrenIds: [] },
        },
      },
    },
  };
}

test("validates the minimal persisted workspace tree", () => {
  assert.equal(parsePersistedWorkspace(validWorkspace())?.activeDocId, "doc");
});

test("rejects structurally invalid persisted workspaces", () => {
  assert.equal(parsePersistedWorkspace({}), null);
  const missingRoot = validWorkspace();
  delete missingRoot.documents.doc.nodes.root;
  assert.equal(parsePersistedWorkspace(missingRoot), null);
  const cyclic = validWorkspace();
  cyclic.documents.doc.nodes.child.childrenIds = ["root"];
  cyclic.documents.doc.nodes.root.parentId = "child";
  assert.equal(parsePersistedWorkspace(cyclic), null);

  const malformedHistory = validWorkspace();
  malformedHistory.documents.doc.undoStack = { broken: true };
  assert.equal(parsePersistedWorkspace(malformedHistory), null);

  const malformedCanvasState = validWorkspace();
  malformedCanvasState.documents.doc.viewport = [];
  assert.equal(parsePersistedWorkspace(malformedCanvasState), null);

  const malformedSelection = validWorkspace();
  malformedSelection.documents.doc.selection = { cardIds: 42 };
  assert.equal(parsePersistedWorkspace(malformedSelection), null);

  const malformedSize = validWorkspace();
  malformedSize.documents.doc.cardSizes = { root: "wide" };
  assert.equal(parsePersistedWorkspace(malformedSize), null);

  const mismatchedDocumentId = validWorkspace();
  mismatchedDocumentId.documents.doc.id = "another-doc";
  assert.equal(parsePersistedWorkspace(mismatchedDocumentId), null);
});
