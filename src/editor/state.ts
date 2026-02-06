import type { DocId, Document, DocumentState, Mode, Node, NodeId, Workspace } from "./types";

export type EditorAppState = {
  workspace: Workspace;
  mode: Mode;
  insertOrigin: { docId: DocId; snapshot: DocumentState } | null;
  hydrated: boolean;
  saveRevision: number;
  closeConfirmDocId: DocId | null;
};

export type EditorAction =
  | { type: "finishHydration"; workspace: Workspace | null }
  | { type: "setActiveDoc"; docId: DocId }
  | { type: "switchDocNext" }
  | { type: "switchDocPrev" }
  | { type: "createDoc" }
  | { type: "requestCloseActiveDoc" }
  | { type: "cancelCloseConfirm" }
  | { type: "closeActiveDoc" }
  | { type: "deleteNode" }
  | { type: "selectNode"; nodeId: NodeId }
  | {
      type: "moveCursor";
      direction: "parent" | "child" | "nextSibling" | "prevSibling";
    }
  | { type: "swapSibling"; direction: "up" | "down" }
  | { type: "enterInsert" }
  | { type: "addChildAndInsert" }
  | { type: "addSiblingAndInsert" }
  | { type: "setCursorText"; text: string }
  | { type: "commitInsertAndContinue" }
  | { type: "commitInsert" }
  | { type: "undo" }
  | { type: "redo" };

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

function cloneDocumentState(doc: DocumentState): DocumentState {
  const nodes: Record<NodeId, Node> = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    nodes[id] = {
      id: node.id,
      text: node.text,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
    };
  }
  return {
    rootId: doc.rootId,
    cursorId: doc.cursorId,
    nodes,
  };
}

function documentStateEquals(a: DocumentState, b: DocumentState): boolean {
  if (a.rootId !== b.rootId) return false;
  if (a.cursorId !== b.cursorId) return false;
  const aKeys = Object.keys(a.nodes);
  const bKeys = Object.keys(b.nodes);
  if (aKeys.length !== bKeys.length) return false;
  for (const id of aKeys) {
    const an = a.nodes[id];
    const bn = b.nodes[id];
    if (!bn) return false;
    if (an.id !== bn.id) return false;
    if (an.text !== bn.text) return false;
    if (an.parentId !== bn.parentId) return false;
    if (an.childrenIds.length !== bn.childrenIds.length) return false;
    for (let i = 0; i < an.childrenIds.length; i += 1) {
      if (an.childrenIds[i] !== bn.childrenIds[i]) return false;
    }
  }
  return true;
}

function createInitialDocument(title: string): { docId: DocId; doc: Document } {
  const rootId = generateId();
  const rootNode: Node = {
    id: rootId,
    text: title,
    parentId: null,
    childrenIds: [],
  };

  const docId = generateId();

  const doc: Document = {
    id: docId,
    rootId,
    cursorId: rootId,
    nodes: { [rootId]: rootNode },
    undoStack: [],
    redoStack: [],
  };

  return {
    docId,
    doc,
  };
}

export function createInitialAppState(): EditorAppState {
  const doc1 = createInitialDocument("");
  const workspace: Workspace = {
    tabs: [{ docId: doc1.docId }],
    activeDocId: doc1.docId,
    documents: {
      [doc1.docId]: doc1.doc,
    },
  };

  return {
    workspace,
    mode: "normal",
    insertOrigin: null,
    hydrated: false,
    saveRevision: 0,
    closeConfirmDocId: null,
  };
}

function bumpSaveRevision(state: EditorAppState): EditorAppState {
  return { ...state, saveRevision: state.saveRevision + 1 };
}

function sanitizeWorkspace(workspace: Workspace): Workspace {
  const tabs = workspace.tabs.filter(
    (tab) => Boolean(tab.docId) && Boolean(workspace.documents[tab.docId]),
  );
  if (tabs.length === 0) {
    const created = createInitialDocument("");
    return {
      tabs: [{ docId: created.docId }],
      activeDocId: created.docId,
      documents: { [created.docId]: created.doc },
    };
  }

  const activeDocId = workspace.documents[workspace.activeDocId]
    ? workspace.activeDocId
    : tabs[0].docId;

  return {
    ...workspace,
    tabs,
    activeDocId,
  };
}

function updateActiveDoc(state: EditorAppState, updater: (doc: Document) => Document): EditorAppState {
  const docId = state.workspace.activeDocId;
  const current = state.workspace.documents[docId];
  const updated = updater(current);
  if (updated === current) {
    return state;
  }
  return {
    ...state,
    workspace: {
      ...state.workspace,
      documents: {
        ...state.workspace.documents,
        [docId]: updated,
      },
    },
  };
}

function moveCursor(doc: Document, direction: "parent" | "child" | "nextSibling" | "prevSibling"): Document {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return doc;

  if (direction === "parent") {
    if (!cursor.parentId) return doc;
    return { ...doc, cursorId: cursor.parentId };
  }

  if (direction === "child") {
    const childId = cursor.childrenIds[0];
    if (!childId) return doc;
    return { ...doc, cursorId: childId };
  }

  const parentId = cursor.parentId;
  if (!parentId) return doc;
  const parent = doc.nodes[parentId];
  if (!parent) return doc;
  const index = parent.childrenIds.indexOf(cursor.id);
  if (index === -1) return doc;

  if (direction === "nextSibling") {
    const nextId = parent.childrenIds[index + 1];
    if (!nextId) return doc;
    return { ...doc, cursorId: nextId };
  }

  const prevId = parent.childrenIds[index - 1];
  if (!prevId) return doc;
  return { ...doc, cursorId: prevId };
}

function swapSibling(doc: Document, direction: "up" | "down"): Document {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor?.parentId) return doc;
  const parent = doc.nodes[cursor.parentId];
  if (!parent) return doc;
  const index = parent.childrenIds.indexOf(cursor.id);
  if (index === -1) return doc;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= parent.childrenIds.length) return doc;

  const nextChildren = [...parent.childrenIds];
  const tmp = nextChildren[index];
  nextChildren[index] = nextChildren[swapWith];
  nextChildren[swapWith] = tmp;

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [parent.id]: { ...parent, childrenIds: nextChildren },
    },
  };
}

function addChild(doc: Document): { updated: Document; newNodeId: NodeId } {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return { updated: doc, newNodeId: doc.cursorId };

  const newId = generateId();
  const newNode: Node = { id: newId, text: "", parentId: cursor.id, childrenIds: [] };
  const nextCursorChildren = [...cursor.childrenIds, newId];

  return {
    updated: {
      ...doc,
      cursorId: newId,
      nodes: {
        ...doc.nodes,
        [newId]: newNode,
        [cursor.id]: { ...cursor, childrenIds: nextCursorChildren },
      },
    },
    newNodeId: newId,
  };
}

function addSibling(doc: Document): { updated: Document; newNodeId: NodeId } {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return { updated: doc, newNodeId: doc.cursorId };

  if (!cursor.parentId) {
    return addChild(doc);
  }

  const parent = doc.nodes[cursor.parentId];
  if (!parent) return { updated: doc, newNodeId: doc.cursorId };
  const index = parent.childrenIds.indexOf(cursor.id);
  if (index === -1) return { updated: doc, newNodeId: doc.cursorId };

  const newId = generateId();
  const newNode: Node = { id: newId, text: "", parentId: parent.id, childrenIds: [] };
  const nextChildren = [...parent.childrenIds];
  nextChildren.splice(index + 1, 0, newId);

  return {
    updated: {
      ...doc,
      cursorId: newId,
      nodes: {
        ...doc.nodes,
        [newId]: newNode,
        [parent.id]: { ...parent, childrenIds: nextChildren },
      },
    },
    newNodeId: newId,
  };
}

function deleteCursorNodeAndPromoteChildren(doc: Document): Document {
  if (doc.cursorId === doc.rootId) return doc;
  const deleting = doc.nodes[doc.cursorId];
  if (!deleting?.parentId) return doc;
  const parent = doc.nodes[deleting.parentId];
  if (!parent) return doc;
  const index = parent.childrenIds.indexOf(deleting.id);
  if (index === -1) return doc;

  const promotedIds = deleting.childrenIds;
  const nextParentChildren = [
    ...parent.childrenIds.slice(0, index),
    ...promotedIds,
    ...parent.childrenIds.slice(index + 1),
  ];

  const nextNodes: Record<NodeId, Node> = { ...doc.nodes };
  delete nextNodes[deleting.id];
  nextNodes[parent.id] = { ...parent, childrenIds: nextParentChildren };

  for (const childId of promotedIds) {
    const child = nextNodes[childId];
    if (!child) continue;
    nextNodes[childId] = { ...child, parentId: parent.id };
  }

  let nextCursorId: NodeId = parent.id;
  if (promotedIds.length > 0) {
    nextCursorId = promotedIds[0];
  } else {
    const siblingAtIndex = nextParentChildren[index];
    if (siblingAtIndex) {
      nextCursorId = siblingAtIndex;
    } else {
      const prevSibling = nextParentChildren[index - 1];
      if (prevSibling) nextCursorId = prevSibling;
    }
  }

  return {
    ...doc,
    cursorId: nextCursorId,
    nodes: nextNodes,
  };
}

export function editorReducer(state: EditorAppState, action: EditorAction): EditorAppState {
  switch (action.type) {
    case "finishHydration": {
      if (state.hydrated) return state;
      if (!action.workspace) {
        return { ...state, hydrated: true };
      }
      return {
        ...state,
        hydrated: true,
        mode: "normal",
        insertOrigin: null,
        closeConfirmDocId: null,
        workspace: sanitizeWorkspace(action.workspace),
      };
    }
    case "setActiveDoc": {
      if (state.mode === "insert") return state;
      if (!state.workspace.documents[action.docId]) return state;
      if (action.docId === state.workspace.activeDocId) return state;
      return bumpSaveRevision({
        ...state,
        workspace: {
          ...state.workspace,
          activeDocId: action.docId,
        },
      });
    }
    case "switchDocNext": {
      if (state.mode === "insert") return state;
      const index = state.workspace.tabs.findIndex(
        (tab) => tab.docId === state.workspace.activeDocId,
      );
      if (index === -1) return state;
      const next = state.workspace.tabs[(index + 1) % state.workspace.tabs.length];
      if (next.docId === state.workspace.activeDocId) return state;
      return bumpSaveRevision({
        ...state,
        workspace: { ...state.workspace, activeDocId: next.docId },
      });
    }
    case "switchDocPrev": {
      if (state.mode === "insert") return state;
      const index = state.workspace.tabs.findIndex(
        (tab) => tab.docId === state.workspace.activeDocId,
      );
      if (index === -1) return state;
      const nextIndex = (index - 1 + state.workspace.tabs.length) % state.workspace.tabs.length;
      const prev = state.workspace.tabs[nextIndex];
      if (prev.docId === state.workspace.activeDocId) return state;
      return bumpSaveRevision({
        ...state,
        workspace: { ...state.workspace, activeDocId: prev.docId },
      });
    }
    case "createDoc": {
      if (state.mode === "insert") return state;
      const created = createInitialDocument("");
      return bumpSaveRevision({
        ...state,
        workspace: {
          tabs: [...state.workspace.tabs, { docId: created.docId }],
          activeDocId: created.docId,
          documents: {
            ...state.workspace.documents,
            [created.docId]: created.doc,
          },
        },
      });
    }
    case "requestCloseActiveDoc": {
      if (state.mode === "insert") return state;
      if (state.workspace.tabs.length <= 1) return state;
      if (state.closeConfirmDocId) return state;
      return { ...state, closeConfirmDocId: state.workspace.activeDocId };
    }
    case "cancelCloseConfirm": {
      if (!state.closeConfirmDocId) return state;
      return { ...state, closeConfirmDocId: null };
    }
    case "closeActiveDoc": {
      if (state.mode === "insert") return state;
      if (state.workspace.tabs.length <= 1) return state;

      const activeIndex = state.workspace.tabs.findIndex(
        (tab) => tab.docId === state.workspace.activeDocId,
      );
      if (activeIndex === -1) return state;

      const closingDocId = state.workspace.activeDocId;
      const nextTabs = state.workspace.tabs.filter((tab) => tab.docId !== closingDocId);
      const nextActiveTab = nextTabs[Math.min(activeIndex, nextTabs.length - 1)];
      const { [closingDocId]: _, ...restDocuments } = state.workspace.documents;

      return bumpSaveRevision({
        ...state,
        closeConfirmDocId: null,
        workspace: {
          tabs: nextTabs,
          activeDocId: nextActiveTab.docId,
          documents: restDocuments,
        },
      });
    }
    case "deleteNode": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        if (doc.cursorId === doc.rootId) return doc;
        const snapshot = cloneDocumentState(doc);
        const updated = deleteCursorNodeAndPromoteChildren(doc);
        if (updated === doc) return doc;
        return {
          ...updated,
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "selectNode": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        if (!doc.nodes[action.nodeId]) return doc;
        if (doc.cursorId === action.nodeId) return doc;
        return { ...doc, cursorId: action.nodeId };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "moveCursor": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => moveCursor(doc, action.direction));
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "swapSibling": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => swapSibling(doc, action.direction));
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "enterInsert": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const doc = state.workspace.documents[docId];
      const snapshot = cloneDocumentState(doc);
      return { ...state, mode: "insert", insertOrigin: { docId, snapshot } };
    }
    case "addChildAndInsert": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const before = cloneDocumentState(state.workspace.documents[docId]);
      const nextState = updateActiveDoc(state, (doc) => addChild(doc).updated);
      return bumpSaveRevision({
        ...nextState,
        mode: "insert",
        insertOrigin: { docId, snapshot: before },
      });
    }
    case "addSiblingAndInsert": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const before = cloneDocumentState(state.workspace.documents[docId]);
      const nextState = updateActiveDoc(state, (doc) => addSibling(doc).updated);
      return bumpSaveRevision({
        ...nextState,
        mode: "insert",
        insertOrigin: { docId, snapshot: before },
      });
    }
    case "setCursorText": {
      if (state.mode !== "insert") return state;
      return updateActiveDoc(state, (doc) => {
        const cursor = doc.nodes[doc.cursorId];
        if (!cursor) return doc;
        return {
          ...doc,
          nodes: {
            ...doc.nodes,
            [cursor.id]: { ...cursor, text: action.text },
          },
        };
      });
    }
    case "commitInsert": {
      if (state.mode !== "insert") return state;
      const origin = state.insertOrigin;
      const docId = state.workspace.activeDocId;
      const currentDoc = state.workspace.documents[docId];
      if (!origin || origin.docId !== docId) {
        return { ...state, mode: "normal", insertOrigin: null };
      }

      if (documentStateEquals(origin.snapshot, currentDoc)) {
        return { ...state, mode: "normal", insertOrigin: null };
      }

      const next = updateActiveDoc(
        { ...state, mode: "normal", insertOrigin: null },
        (doc) => ({
          ...doc,
          undoStack: [...doc.undoStack, origin.snapshot],
          redoStack: [],
        }),
      );

      return bumpSaveRevision(next);
    }
    case "commitInsertAndContinue": {
      if (state.mode !== "insert") return state;
      const docId = state.workspace.activeDocId;
      const currentDoc = state.workspace.documents[docId];

      const origin = state.insertOrigin;
      if (!origin || origin.docId !== docId) {
        return {
          ...state,
          insertOrigin: { docId, snapshot: cloneDocumentState(currentDoc) },
        };
      }

      if (documentStateEquals(origin.snapshot, currentDoc)) {
        return { ...state, mode: "normal", insertOrigin: null };
      }

      const next = updateActiveDoc(state, (doc) => ({
        ...doc,
        undoStack: [...doc.undoStack, origin.snapshot],
        redoStack: [],
      }));

      const nextDoc = next.workspace.documents[docId];
      return bumpSaveRevision({
        ...next,
        mode: "insert",
        insertOrigin: { docId, snapshot: cloneDocumentState(nextDoc) },
      });
    }
    case "undo": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      if (state.workspace.documents[docId].undoStack.length === 0) return state;
      const next = updateActiveDoc(state, (doc) => {
        const prev = doc.undoStack[doc.undoStack.length - 1];
        if (!prev) return doc;
        const nextUndo = doc.undoStack.slice(0, -1);
        const currentSnapshot = cloneDocumentState(doc);
        return {
          ...doc,
          ...cloneDocumentState(prev),
          undoStack: nextUndo,
          redoStack: [...doc.redoStack, currentSnapshot],
        };
      });
      return bumpSaveRevision(next);
    }
    case "redo": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      if (state.workspace.documents[docId].redoStack.length === 0) return state;
      const next = updateActiveDoc(state, (doc) => {
        const next = doc.redoStack[doc.redoStack.length - 1];
        if (!next) return doc;
        const nextRedo = doc.redoStack.slice(0, -1);
        const currentSnapshot = cloneDocumentState(doc);
        return {
          ...doc,
          ...cloneDocumentState(next),
          redoStack: nextRedo,
          undoStack: [...doc.undoStack, currentSnapshot],
        };
      });
      return bumpSaveRevision(next);
    }
    default:
      return state;
  }
}
