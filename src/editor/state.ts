import type {
  DocId,
  Document,
  DocumentState,
  Mode,
  AnchorSide,
  CanvasPoint,
  NodeColor,
  NodeId,
  Workspace,
} from "./types";
import { createInitialDocument } from "./domain/documentFactory";
import { sanitizeEdgeAnchors } from "./domain/edgeAnchors";
import { cloneDocumentState, documentStateEquals } from "./domain/snapshot";
import {
  autoLayoutBranch,
  collectSubtreeNodeIds,
  moveNodePositions,
} from "./domain/freeLayout";
import {
  addChild,
  addSibling,
  deleteCursorNodeAndPromoteChildren,
  moveCursor,
  reparentNode,
  swapSibling,
} from "./domain/treeOps";
import {
  buildVisibleTreeProjection,
  collectBranchNodeIds,
  getAncestorIds,
  isDescendantOrSelf,
  sanitizeCollapsedNodeIds,
} from "./domain/visibleTree";
import { sanitizeNodePositions } from "./layout";

export type EditorAppState = {
  workspace: Workspace;
  mode: Mode;
  insertOrigin: { docId: DocId; snapshot: DocumentState } | null;
  noteEditOrigin: { docId: DocId; snapshot: DocumentState } | null;
  hydrated: boolean;
  saveRevision: number;
  closeConfirmDocId: DocId | null;
  focusRootId: NodeId | null;
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
  | { type: "selectNodeReveal"; nodeId: NodeId }
  | {
      type: "moveCursor";
      direction: "parent" | "child" | "nextSibling" | "prevSibling";
    }
  | { type: "swapSibling"; direction: "up" | "down" }
  | { type: "reparentNode"; direction: "left" | "right" }
  | { type: "enterInsert" }
  | { type: "addChildAndInsert" }
  | { type: "addChildAtPosition"; point: CanvasPoint }
  | { type: "addSiblingAndInsert" }
  | { type: "setCursorText"; text: string }
  | { type: "beginNoteEdit" }
  | { type: "setCursorNote"; note: string }
  | { type: "commitNoteEdit" }
  | { type: "setCursorColor"; color: NodeColor | null }
  | { type: "toggleNodeCollapsed"; nodeId?: NodeId }
  | { type: "collapseNode"; nodeId?: NodeId }
  | { type: "expandNode"; nodeId?: NodeId }
  | { type: "collapseAllVisible" }
  | { type: "expandAllVisible" }
  | { type: "enterFocus" }
  | { type: "setFocusRoot"; nodeId: NodeId }
  | { type: "exitFocus" }
  | { type: "focusParent" }
  | { type: "moveNodes"; nodeIds: NodeId[]; dx: number; dy: number }
  | { type: "autoLayout"; scope: "branch" | "all" }
  | {
      type: "setEdgeAnchor";
      edgeKey: string;
      endpoint: "from" | "to";
      side: AnchorSide | null;
    }
  | { type: "resetEdgeAnchors"; edgeKey: string }
  | { type: "commitInsertAndContinue" }
  | { type: "commitInsert" }
  | { type: "applyDocumentState"; docId: DocId; nextState: DocumentState }
  | { type: "undo" }
  | { type: "redo" };

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
    noteEditOrigin: null,
    hydrated: false,
    saveRevision: 0,
    closeConfirmDocId: null,
    focusRootId: null,
  };
}

function normalizeNote(note: string): string | undefined {
  return note.trim() === "" ? undefined : note;
}

function bumpSaveRevision(state: EditorAppState): EditorAppState {
  return { ...state, saveRevision: state.saveRevision + 1 };
}

function edgeAnchorRecordsEqual(
  a: DocumentState["edgeAnchors"] | undefined,
  b: DocumentState["edgeAnchors"] | undefined,
): boolean {
  const aKeys = Object.keys(a ?? {}).sort();
  const bKeys = Object.keys(b ?? {}).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i];
    if (key !== bKeys[i]) return false;
    if (a?.[key]?.from !== b?.[key]?.from) return false;
    if (a?.[key]?.to !== b?.[key]?.to) return false;
  }
  return true;
}

function sanitizeWorkspace(workspace: Workspace): Workspace {
  const documents: Record<DocId, Document> = {};
  for (const [docId, doc] of Object.entries(workspace.documents)) {
    const nodes = doc.nodes ?? {};
    const rootId = doc.rootId;
    documents[docId] = sanitizeDocumentViewState({
      ...doc,
      nodes,
      nodePositions: sanitizeNodePositions(
        { rootId, nodes },
        doc.nodePositions,
      ),
      edgeAnchors: sanitizeEdgeAnchors({ nodes }, doc.edgeAnchors),
      undoStack: (doc.undoStack ?? []).map((snapshot) => ({
        ...snapshot,
        nodePositions: sanitizeNodePositions(snapshot, snapshot.nodePositions),
        edgeAnchors: sanitizeEdgeAnchors(snapshot, snapshot.edgeAnchors),
      })),
      redoStack: (doc.redoStack ?? []).map((snapshot) => ({
        ...snapshot,
        nodePositions: sanitizeNodePositions(snapshot, snapshot.nodePositions),
        edgeAnchors: sanitizeEdgeAnchors(snapshot, snapshot.edgeAnchors),
      })),
      collapsedNodeIds: sanitizeCollapsedNodeIds(doc, doc.collapsedNodeIds),
    });
  }
  const tabs = workspace.tabs.filter(
    (tab) => Boolean(tab.docId) && Boolean(documents[tab.docId]),
  );
  if (tabs.length === 0) {
    const created = createInitialDocument("");
    return {
      tabs: [{ docId: created.docId }],
      activeDocId: created.docId,
      documents: { [created.docId]: created.doc },
    };
  }

  const activeDocId = documents[workspace.activeDocId]
    ? workspace.activeDocId
    : tabs[0].docId;

  return {
    ...workspace,
    documents,
    tabs,
    activeDocId,
  };
}

function sanitizeDocumentViewState(doc: Document): Document {
  const nodePositions = sanitizeNodePositions(doc, doc.nodePositions);
  const edgeAnchors = sanitizeEdgeAnchors(doc, doc.edgeAnchors);
  const cursorAncestors = new Set(getAncestorIds(doc, doc.cursorId));
  const collapsedNodeIds = sanitizeCollapsedNodeIds(
    doc,
    doc.collapsedNodeIds,
  ).filter((id) => !cursorAncestors.has(id));
  if (
    collapsedNodeIds.length === doc.collapsedNodeIds.length &&
    collapsedNodeIds.every((id, index) => id === doc.collapsedNodeIds[index])
  ) {
    const positionIds = Object.keys(nodePositions);
    const currentPositionIds = Object.keys(doc.nodePositions ?? {});
    const edgeAnchorIds = Object.keys(edgeAnchors);
    const currentEdgeAnchorIds = Object.keys(doc.edgeAnchors ?? {});
    const positionsEqual =
      positionIds.length === currentPositionIds.length &&
      positionIds.every((id) => {
        const current = doc.nodePositions?.[id];
        const next = nodePositions[id];
        return current?.x === next.x && current?.y === next.y;
      });
    const edgeAnchorsEqual =
      edgeAnchorIds.length === currentEdgeAnchorIds.length &&
      edgeAnchorIds.every((id) => {
        const current = doc.edgeAnchors?.[id];
        const next = edgeAnchors[id];
        return current?.from === next.from && current?.to === next.to;
      });
    if (positionsEqual && edgeAnchorsEqual) return doc;
  }
  return { ...doc, collapsedNodeIds, nodePositions, edgeAnchors };
}

function normalizeFocusRoot(state: EditorAppState): EditorAppState {
  if (!state.focusRootId) return state;
  const doc = state.workspace.documents[state.workspace.activeDocId];
  if (
    doc?.nodes[state.focusRootId] &&
    isDescendantOrSelf(doc, doc.cursorId, state.focusRootId)
  ) {
    return state;
  }
  return { ...state, focusRootId: null };
}

function updateDocById(
  state: EditorAppState,
  docId: DocId,
  updater: (doc: Document) => Document,
): EditorAppState {
  const current = state.workspace.documents[docId];
  if (!current) return state;
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

function updateActiveDoc(state: EditorAppState, updater: (doc: Document) => Document): EditorAppState {
  return updateDocById(state, state.workspace.activeDocId, updater);
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
        noteEditOrigin: null,
        closeConfirmDocId: null,
        focusRootId: null,
        workspace: sanitizeWorkspace(action.workspace),
      };
    }
    case "setActiveDoc": {
      if (state.mode === "insert") return state;
      if (!state.workspace.documents[action.docId]) return state;
      if (action.docId === state.workspace.activeDocId) return state;
      return bumpSaveRevision({
        ...state,
        focusRootId: null,
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
        focusRootId: null,
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
        focusRootId: null,
        workspace: { ...state.workspace, activeDocId: prev.docId },
      });
    }
    case "createDoc": {
      if (state.mode === "insert") return state;
      const created = createInitialDocument("");
      return bumpSaveRevision({
        ...state,
        focusRootId: null,
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
        focusRootId: null,
        workspace: {
          tabs: nextTabs,
          activeDocId: nextActiveTab.docId,
          documents: restDocuments,
        },
      });
    }
    case "applyDocumentState": {
      if (state.mode === "insert") return state;

      const next = updateDocById(state, action.docId, (doc) => {
        const rootNode = action.nextState.nodes[action.nextState.rootId];
        if (!rootNode || rootNode.parentId !== null) return doc;

        const cursorId = action.nextState.nodes[action.nextState.cursorId]
          ? action.nextState.cursorId
          : action.nextState.rootId;
        if (!action.nextState.nodes[cursorId]) return doc;

        const normalizedNext: DocumentState = cloneDocumentState({
          rootId: action.nextState.rootId,
          cursorId,
          nodes: action.nextState.nodes,
          nodePositions: sanitizeNodePositions(action.nextState, action.nextState.nodePositions),
          edgeAnchors: sanitizeEdgeAnchors(action.nextState, {
            ...doc.edgeAnchors,
            ...(action.nextState.edgeAnchors ?? {}),
          }),
        });
        const currentSnapshot = cloneDocumentState(doc);
        if (documentStateEquals(currentSnapshot, normalizedNext)) return doc;

        return sanitizeDocumentViewState({
          ...doc,
          ...normalizedNext,
          collapsedNodeIds: sanitizeCollapsedNodeIds(
            normalizedNext,
            doc.collapsedNodeIds,
          ),
          undoStack: [...doc.undoStack, currentSnapshot],
          redoStack: [],
        });
      });

      if (next === state) return state;
      return bumpSaveRevision(normalizeFocusRoot(next));
    }
    case "deleteNode": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        if (doc.cursorId === doc.rootId) return doc;
        const snapshot = cloneDocumentState(doc);
        const updated = deleteCursorNodeAndPromoteChildren(doc);
        if (updated === doc) return doc;
        return sanitizeDocumentViewState({
          ...updated,
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        });
      });
      if (next === state) return state;
      return bumpSaveRevision(normalizeFocusRoot(next));
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
    case "selectNodeReveal": {
      if (state.mode === "insert") return state;
      const doc = state.workspace.documents[state.workspace.activeDocId];
      if (!doc.nodes[action.nodeId]) return state;

      const ancestors = new Set(getAncestorIds(doc, action.nodeId));
      const collapsedNodeIds = doc.collapsedNodeIds.filter((id) => !ancestors.has(id));
      const focusRootId =
        state.focusRootId &&
        isDescendantOrSelf(doc, action.nodeId, state.focusRootId)
          ? state.focusRootId
          : null;
      const next = updateActiveDoc(
        { ...state, focusRootId },
        (current) => ({
          ...current,
          cursorId: action.nodeId,
          collapsedNodeIds,
        }),
      );
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "moveCursor": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const projection = buildVisibleTreeProjection(doc, state.focusRootId);
        const visibleDoc: Document = { ...doc, ...projection.state };
        const moved = moveCursor(visibleDoc, action.direction);
        if (moved.cursorId === doc.cursorId) return doc;
        return { ...doc, cursorId: moved.cursorId };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "toggleNodeCollapsed":
    case "collapseNode":
    case "expandNode": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const nodeId = action.nodeId ?? doc.cursorId;
        const node = doc.nodes[nodeId];
        if (!node || node.childrenIds.length === 0) return doc;
        const collapsed = new Set(doc.collapsedNodeIds);
        const isCollapsed = collapsed.has(nodeId);
        const shouldCollapse =
          action.type === "collapseNode" ||
          (action.type === "toggleNodeCollapsed" && !isCollapsed);
        if (shouldCollapse) {
          collapsed.add(nodeId);
        } else {
          collapsed.delete(nodeId);
        }
        const cursorId =
          shouldCollapse &&
          doc.cursorId !== nodeId &&
          isDescendantOrSelf(doc, doc.cursorId, nodeId)
            ? nodeId
            : doc.cursorId;
        return { ...doc, cursorId, collapsedNodeIds: [...collapsed] };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "collapseAllVisible": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const rootId = state.focusRootId ?? doc.rootId;
        const collapsed = new Set(doc.collapsedNodeIds);
        for (const nodeId of collectBranchNodeIds(doc, rootId)) {
          collapsed.add(nodeId);
        }
        return { ...doc, cursorId: rootId, collapsedNodeIds: [...collapsed] };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "expandAllVisible": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const rootId = state.focusRootId ?? doc.rootId;
        const branchIds = new Set(collectBranchNodeIds(doc, rootId));
        const collapsedNodeIds = doc.collapsedNodeIds.filter((id) => !branchIds.has(id));
        if (collapsedNodeIds.length === doc.collapsedNodeIds.length) return doc;
        return { ...doc, collapsedNodeIds };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "enterFocus": {
      if (state.mode === "insert") return state;
      const doc = state.workspace.documents[state.workspace.activeDocId];
      if (!doc.nodes[doc.cursorId] || state.focusRootId === doc.cursorId) return state;
      if (!doc.collapsedNodeIds.includes(doc.cursorId)) {
        return { ...state, focusRootId: doc.cursorId };
      }
      const next = updateActiveDoc(
        { ...state, focusRootId: doc.cursorId },
        (current) => ({
          ...current,
          collapsedNodeIds: current.collapsedNodeIds.filter(
            (nodeId) => nodeId !== current.cursorId,
          ),
        }),
      );
      return next === state ? state : bumpSaveRevision(next);
    }
    case "setFocusRoot": {
      if (state.mode === "insert") return state;
      const doc = state.workspace.documents[state.workspace.activeDocId];
      if (!doc.nodes[action.nodeId]) return state;
      const next = updateActiveDoc(
        { ...state, focusRootId: action.nodeId },
        (current) => ({
          ...current,
          cursorId: action.nodeId,
          collapsedNodeIds: current.collapsedNodeIds.filter(
            (nodeId) => nodeId !== action.nodeId,
          ),
        }),
      );
      return bumpSaveRevision(next);
    }
    case "exitFocus": {
      if (!state.focusRootId) return state;
      return { ...state, focusRootId: null };
    }
    case "focusParent": {
      if (state.mode === "insert" || !state.focusRootId) return state;
      const doc = state.workspace.documents[state.workspace.activeDocId];
      const parentId = doc.nodes[state.focusRootId]?.parentId;
      if (!parentId) {
        return bumpSaveRevision({
          ...state,
          focusRootId: null,
          workspace: {
            ...state.workspace,
            documents: {
              ...state.workspace.documents,
              [doc.id]: { ...doc, cursorId: doc.rootId },
            },
          },
        });
      }
      const next = updateActiveDoc(
        { ...state, focusRootId: parentId },
        (current) => ({
          ...current,
          cursorId: parentId,
          collapsedNodeIds: current.collapsedNodeIds.filter(
            (nodeId) => nodeId !== parentId,
          ),
        }),
      );
      return bumpSaveRevision(next);
    }
    case "swapSibling": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => swapSibling(doc, action.direction));
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "reparentNode": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) =>
        sanitizeDocumentViewState(reparentNode(doc, action.direction)),
      );
      if (next === state) return state;
      return bumpSaveRevision(normalizeFocusRoot(next));
    }
    case "enterInsert": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const doc = state.workspace.documents[docId];
      const snapshot = cloneDocumentState(doc);
      return {
        ...state,
        mode: "insert",
        insertOrigin: { docId, snapshot },
        noteEditOrigin: null,
      };
    }
    case "addChildAndInsert": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const before = cloneDocumentState(state.workspace.documents[docId]);
      const nextState = updateActiveDoc(state, (doc) =>
        sanitizeDocumentViewState(addChild(doc).updated),
      );
      return bumpSaveRevision({
        ...nextState,
        mode: "insert",
        insertOrigin: { docId, snapshot: before },
        noteEditOrigin: null,
      });
    }
    case "addChildAtPosition": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const before = cloneDocumentState(state.workspace.documents[docId]);
      const nextState = updateActiveDoc(state, (doc) => {
        const result = addChild(doc);
        return sanitizeDocumentViewState({
          ...result.updated,
          nodePositions: {
            ...result.updated.nodePositions,
            [result.newNodeId]: { ...action.point },
          },
        });
      });
      return bumpSaveRevision({
        ...nextState,
        mode: "insert",
        insertOrigin: { docId, snapshot: before },
        noteEditOrigin: null,
      });
    }
    case "addSiblingAndInsert": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const before = cloneDocumentState(state.workspace.documents[docId]);
      const nextState = updateActiveDoc(state, (doc) => addSibling(doc).updated);
      return bumpSaveRevision({
        ...normalizeFocusRoot(nextState),
        mode: "insert",
        insertOrigin: { docId, snapshot: before },
        noteEditOrigin: null,
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
    case "beginNoteEdit": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      const doc = state.workspace.documents[docId];
      return {
        ...state,
        noteEditOrigin: { docId, snapshot: cloneDocumentState(doc) },
      };
    }
    case "setCursorNote": {
      if (state.mode === "insert") return state;
      return updateActiveDoc(state, (doc) => {
        const cursor = doc.nodes[doc.cursorId];
        if (!cursor) return doc;
        const nextNote = normalizeNote(action.note);
        if (cursor.note === nextNote) return doc;
        return {
          ...doc,
          nodes: {
            ...doc.nodes,
            [cursor.id]: { ...cursor, note: nextNote },
          },
        };
      });
    }
    case "commitNoteEdit": {
      if (state.mode === "insert") return state;
      const origin = state.noteEditOrigin;
      const docId = state.workspace.activeDocId;
      const currentDoc = state.workspace.documents[docId];
      if (!origin || origin.docId !== docId) {
        return { ...state, noteEditOrigin: null };
      }
      if (documentStateEquals(origin.snapshot, currentDoc)) {
        return { ...state, noteEditOrigin: null };
      }

      const next = updateActiveDoc({ ...state, noteEditOrigin: null }, (doc) => ({
        ...doc,
        undoStack: [...doc.undoStack, origin.snapshot],
        redoStack: [],
      }));
      return bumpSaveRevision(next);
    }
    case "setCursorColor": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const cursor = doc.nodes[doc.cursorId];
        if (!cursor) return doc;
        const nextColor = action.color ?? undefined;
        if (cursor.color === nextColor) return doc;
        const snapshot = cloneDocumentState(doc);
        return {
          ...doc,
          nodes: {
            ...doc.nodes,
            [cursor.id]: {
              ...cursor,
              color: nextColor,
            },
          },
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        };
      });
      if (next === state) return state;
      return bumpSaveRevision(next);
    }
    case "moveNodes": {
      if (state.mode === "insert") return state;
      if (!Number.isFinite(action.dx) || !Number.isFinite(action.dy)) return state;
      if (action.dx === 0 && action.dy === 0) return state;
      const next = updateActiveDoc(state, (doc) => {
        const nodeIds = [...new Set(action.nodeIds)].filter((id) => Boolean(doc.nodes[id]));
        if (nodeIds.length === 0) return doc;
        const snapshot = cloneDocumentState(doc);
        return {
          ...doc,
          nodePositions: moveNodePositions(
            sanitizeNodePositions(doc, doc.nodePositions),
            nodeIds,
            action.dx,
            action.dy,
          ),
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        };
      });
      return next === state ? state : bumpSaveRevision(next);
    }
    case "autoLayout": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const rootId = action.scope === "all" ? doc.rootId : doc.cursorId;
        if (!doc.nodes[rootId]) return doc;
        const nodePositions = autoLayoutBranch(doc, rootId);
        const branchIds = collectSubtreeNodeIds(doc, rootId);
        const changed = branchIds.some((id) => {
          const before = doc.nodePositions[id];
          const after = nodePositions[id];
          return before?.x !== after?.x || before?.y !== after?.y;
        });
        if (!changed) return doc;
        const snapshot = cloneDocumentState(doc);
        return {
          ...doc,
          nodePositions,
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        };
      });
      return next === state ? state : bumpSaveRevision(next);
    }
    case "setEdgeAnchor": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const currentAnchors = sanitizeEdgeAnchors(doc, doc.edgeAnchors);
        const current = currentAnchors[action.edgeKey] ?? { from: null, to: null };
        const updated = {
          ...current,
          [action.endpoint]: action.side,
        };
        const candidate = { ...currentAnchors };
        if (updated.from === null && updated.to === null) {
          delete candidate[action.edgeKey];
        } else {
          candidate[action.edgeKey] = updated;
        }
        const edgeAnchors = sanitizeEdgeAnchors(doc, candidate);
        if (edgeAnchorRecordsEqual(currentAnchors, edgeAnchors)) return doc;
        const snapshot = cloneDocumentState(doc);
        return {
          ...doc,
          edgeAnchors,
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        };
      });
      return next === state ? state : bumpSaveRevision(next);
    }
    case "resetEdgeAnchors": {
      if (state.mode === "insert") return state;
      const next = updateActiveDoc(state, (doc) => {
        const currentAnchors = sanitizeEdgeAnchors(doc, doc.edgeAnchors);
        if (!currentAnchors[action.edgeKey]) return doc;
        const { [action.edgeKey]: _, ...edgeAnchors } = currentAnchors;
        const snapshot = cloneDocumentState(doc);
        return {
          ...doc,
          edgeAnchors,
          undoStack: [...doc.undoStack, snapshot],
          redoStack: [],
        };
      });
      return next === state ? state : bumpSaveRevision(next);
    }
    case "commitInsert": {
      if (state.mode !== "insert") return state;
      const origin = state.insertOrigin;
      const docId = state.workspace.activeDocId;
      const currentDoc = state.workspace.documents[docId];
      if (!origin || origin.docId !== docId) {
        return { ...state, mode: "normal", insertOrigin: null, noteEditOrigin: null };
      }

      if (documentStateEquals(origin.snapshot, currentDoc)) {
        return { ...state, mode: "normal", insertOrigin: null, noteEditOrigin: null };
      }

      const next = updateActiveDoc(
        { ...state, mode: "normal", insertOrigin: null, noteEditOrigin: null },
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
          noteEditOrigin: null,
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
        noteEditOrigin: null,
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
        return sanitizeDocumentViewState({
          ...doc,
          ...cloneDocumentState(prev),
          undoStack: nextUndo,
          redoStack: [...doc.redoStack, currentSnapshot],
        });
      });
      return bumpSaveRevision(normalizeFocusRoot(next));
    }
    case "redo": {
      if (state.mode === "insert") return state;
      const docId = state.workspace.activeDocId;
      if (state.workspace.documents[docId].redoStack.length === 0) return state;
      const next = updateActiveDoc(state, (doc) => {
        const redoSnapshot = doc.redoStack[doc.redoStack.length - 1];
        if (!redoSnapshot) return doc;
        const nextRedo = doc.redoStack.slice(0, -1);
        const currentSnapshot = cloneDocumentState(doc);
        return sanitizeDocumentViewState({
          ...doc,
          ...cloneDocumentState(redoSnapshot),
          redoStack: nextRedo,
          undoStack: [...doc.undoStack, currentSnapshot],
        });
      });
      return bumpSaveRevision(normalizeFocusRoot(next));
    }
    default:
      return state;
  }
}
