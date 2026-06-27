import type { DocId, Document, Node } from "../types";
import { generateId } from "./id";

export function createInitialDocument(title: string): { docId: DocId; doc: Document } {
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
    nodePositions: { [rootId]: { x: 0, y: 0 } },
    edgeAnchors: {},
    customLinks: {},
    collapsedNodeIds: [],
    undoStack: [],
    redoStack: [],
  };

  return {
    docId,
    doc,
  };
}
