import type { Workspace } from "../editor/types";

type UnknownRecord = Record<string, unknown>;
type RawNode = {
  id: string;
  text: string;
  parentId: string | null;
  childrenIds: string[];
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeRecord(value: unknown): value is RawNode {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    (typeof value.parentId === "string" || value.parentId === null) &&
    Array.isArray(value.childrenIds) &&
    value.childrenIds.every((id) => typeof id === "string")
  );
}

function hasValidTree(document: UnknownRecord): boolean {
  if (typeof document.rootId !== "string" || typeof document.cursorId !== "string") return false;
  if (!isRecord(document.nodes)) return false;
  const nodes = document.nodes;
  const root = nodes[document.rootId];
  if (!isNodeRecord(root) || root.parentId !== null) return false;
  if (!isNodeRecord(nodes[document.cursorId])) return false;

  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visited.has(nodeId)) return false;
    const node = nodes[nodeId];
    if (!isNodeRecord(node) || node.id !== nodeId) return false;
    visited.add(nodeId);
    const children = new Set<string>();
    for (const childId of node.childrenIds) {
      if (children.has(childId)) return false;
      children.add(childId);
      const child = nodes[childId];
      if (!isNodeRecord(child) || child.parentId !== nodeId || !visit(childId)) return false;
    }
    return true;
  };

  return visit(document.rootId) && visited.size === Object.keys(nodes).length;
}

function isOptionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value);
}

function isOptionalStringArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalPointMap(value: unknown, size = false): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) =>
    isRecord(entry) &&
    isFiniteNumber(entry[size ? "width" : "x"]) &&
    isFiniteNumber(entry[size ? "height" : "y"]),
  );
}

function isValidViewport(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (value.x === undefined || isFiniteNumber(value.x)) &&
    (value.y === undefined || isFiniteNumber(value.y)) &&
    (value.zoom === undefined || isFiniteNumber(value.zoom)) &&
    (value.initialized === undefined || typeof value.initialized === "boolean");
}

function isValidSelection(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (value.cardIds === undefined ||
      (Array.isArray(value.cardIds) && value.cardIds.every((id) => typeof id === "string"))) &&
    (value.lastEditedCardId === undefined || value.lastEditedCardId === null || typeof value.lastEditedCardId === "string");
}

function hasValidDocumentShape(document: UnknownRecord): boolean {
  if (!hasValidTree(document)) return false;
  if (typeof document.id !== "string") return false;
  if (!isOptionalStringArray(document.collapsedNodeIds)) return false;
  if (!isOptionalPointMap(document.nodePositions)) return false;
  if (!isOptionalRecord(document.branchDirections)) return false;
  if (!isOptionalRecord(document.edgeAnchors)) return false;
  if (!isOptionalRecord(document.customLinks)) return false;
  if (!isOptionalRecord(document.stickyNotes)) return false;
  if (!isOptionalPointMap(document.cardSizes, true)) return false;
  if (!isValidViewport(document.viewport)) return false;
  if (!isValidSelection(document.selection)) return false;

  for (const historyKey of ["undoStack", "redoStack"] as const) {
    const history = document[historyKey];
    if (history === undefined) continue;
    if (!Array.isArray(history)) return false;
    if (!history.every((snapshot) => isRecord(snapshot) && hasValidTree(snapshot))) return false;
  }
  return true;
}

/**
 * Checks only the invariants required before the reducer's legacy sanitizers run.
 * Optional canvas fields deliberately remain migratable.
 */
export function parsePersistedWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || !Array.isArray(value.tabs) || !isRecord(value.documents)) return null;
  if (typeof value.activeDocId !== "string") return null;
  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== 3
  ) return null;

  const documents = value.documents;
  const documentIds = Object.keys(documents);
  if (documentIds.length === 0 || !documents[value.activeDocId]) return null;
  if (!documentIds.every((id) =>
    isRecord(documents[id]) && documents[id].id === id && hasValidDocumentShape(documents[id]))) {
    return null;
  }

  const tabIds = new Set<string>();
  for (const tab of value.tabs) {
    if (!isRecord(tab) || typeof tab.docId !== "string" || !documents[tab.docId]) return null;
    if (tabIds.has(tab.docId)) return null;
    tabIds.add(tab.docId);
  }
  if (tabIds.size === 0 || !tabIds.has(value.activeDocId)) return null;

  return value as Workspace;
}
