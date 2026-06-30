import { generateId } from "../../editor/domain/id";
import { findAvailablePosition } from "../../editor/domain/freeLayout";
import {
  getNodeSizes,
  H_GAP,
  sanitizeNodePositions,
} from "../../editor/layout";
import type {
  CanvasPoint,
  Document,
  DocumentState,
  Node,
  NodeColor,
  NodeId,
} from "../../editor/types";
import {
  parseImproveRequest,
  type GeneratedTreeNode,
  type ImproveDocumentState,
  type ImproveOperation,
} from "./schema";

type MutableNode = {
  id: NodeId;
  text: string;
  parentId: NodeId | null;
  childrenIds: NodeId[];
  color?: NodeColor;
};

export type ApplyImproveResult =
  | { ok: true; value: DocumentState }
  | { ok: false; errors: string[] };

function makeUniqueId(nodes: Record<NodeId, MutableNode>): NodeId {
  for (let i = 0; i < 100; i += 1) {
    const id = generateId();
    if (!nodes[id]) return id;
  }
  return generateId() + "-llm";
}

function resolveNodeRef(
  ref: string,
  nodes: Record<NodeId, MutableNode>,
  tempIdToNodeId: Record<string, NodeId>,
): NodeId | null {
  if (nodes[ref]) return ref;
  const mapped = tempIdToNodeId[ref];
  if (mapped && nodes[mapped]) return mapped;
  return null;
}

function cloneMutableNodes(document: ImproveDocumentState): Record<NodeId, MutableNode> {
  const nodes: Record<NodeId, MutableNode> = {};
  Object.entries(document.nodes).forEach(([id, node]) => {
    nodes[id] = {
      id: node.id,
      text: node.text,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      color: node.color ?? undefined,
    };
  });
  return nodes;
}

function findIndexOrError(list: string[], id: string): number {
  return list.indexOf(id);
}

function isAncestor(
  ancestorCandidate: string,
  descendantCandidate: string,
  nodes: Record<NodeId, MutableNode>,
): boolean {
  let current = nodes[descendantCandidate];
  let guard = 0;
  const max = Object.keys(nodes).length + 1;
  while (current?.parentId) {
    if (current.parentId === ancestorCandidate) return true;
    current = nodes[current.parentId];
    guard += 1;
    if (guard > max) return true;
  }
  return false;
}

function toImproveDocumentState(state: DocumentState): ImproveDocumentState {
  const nodes: ImproveDocumentState["nodes"] = {};
  Object.entries(state.nodes).forEach(([id, node]) => {
    nodes[id] = {
      id,
      text: node.text,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      color: node.color ?? null,
    };
  });
  return {
    rootId: state.rootId,
    cursorId: state.cursorId,
    nodes,
  };
}

function validateResultState(result: DocumentState): string[] {
  const parsed = parseImproveRequest({
    version: "1",
    mode: "improve",
    goal: "validate",
    document: toImproveDocumentState(result),
    constraints: {
      maxAdditions: 0,
      keepExistingText: true,
      allowReparent: true,
      allowDelete: true,
    },
  });
  if (parsed.ok) return [];
  return parsed.errors.map((x) => x.replace(/^input\.document\./, ""));
}

function normalizeCursor(
  originalCursorId: NodeId,
  rootId: NodeId,
  nodes: Record<NodeId, MutableNode>,
): NodeId {
  if (nodes[originalCursorId]) return originalCursorId;
  if (nodes[rootId]) return rootId;
  const first = Object.keys(nodes)[0];
  return first ?? rootId;
}

export function documentToImproveDocumentState(doc: Document): ImproveDocumentState {
  const nodes: ImproveDocumentState["nodes"] = {};
  Object.entries(doc.nodes).forEach(([id, node]) => {
    nodes[id] = {
      id: node.id,
      text: node.text,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      color: node.color ?? null,
    };
  });
  return {
    rootId: doc.rootId,
    cursorId: doc.cursorId,
    nodes,
  };
}

export function buildDocumentStateFromGeneratedTree(root: GeneratedTreeNode): DocumentState {
  const nodes: Record<NodeId, Node> = {};

  const visit = (node: GeneratedTreeNode, parentId: NodeId | null): NodeId => {
    const id = generateId();
    const childrenIds = node.children.map((child) => visit(child, id));
    nodes[id] = {
      id,
      text: node.text,
      parentId,
      childrenIds,
      color: node.color ?? undefined,
    };
    return id;
  };

  const rootId = visit(root, null);
  return {
    rootId,
    cursorId: rootId,
    nodes,
    nodePositions: sanitizeNodePositions({ rootId, nodes }, undefined),
    edgeAnchors: {},
    customLinks: {},
    stickyNotes: {},
  };
}

export function applyImproveOperationsToDocument(
  document: ImproveDocumentState,
  operations: ImproveOperation[],
  existingPositions: Record<NodeId, CanvasPoint> = {},
): ApplyImproveResult {
  const errors: string[] = [];
  const nodes = cloneMutableNodes(document);
  const tempIdToNodeId: Record<string, NodeId> = {};

  operations.forEach((op, index) => {
    const opPath = `operations[${index}]`;
    if (errors.length > 0) return;

    if (op.op === "add") {
      const parentId = resolveNodeRef(op.parentId, nodes, tempIdToNodeId);
      if (!parentId) {
        errors.push(`${opPath}.parentId references unknown node "${op.parentId}"`);
        return;
      }
      if (tempIdToNodeId[op.node.tempId]) {
        errors.push(`${opPath}.node.tempId "${op.node.tempId}" is already used`);
        return;
      }
      const parent = nodes[parentId];
      if (op.index < 0 || op.index > parent.childrenIds.length) {
        errors.push(
          `${opPath}.index must be between 0 and ${parent.childrenIds.length} for parent "${parentId}"`,
        );
        return;
      }
      const newId = makeUniqueId(nodes);
      const newNode: MutableNode = {
        id: newId,
        text: op.node.text,
        parentId,
        childrenIds: [],
        color: op.node.color ?? undefined,
      };
      nodes[newId] = newNode;
      parent.childrenIds.splice(op.index, 0, newId);
      tempIdToNodeId[op.node.tempId] = newId;
      return;
    }

    if (op.op === "updateText") {
      const nodeId = resolveNodeRef(op.nodeId, nodes, tempIdToNodeId);
      if (!nodeId) {
        errors.push(`${opPath}.nodeId references unknown node "${op.nodeId}"`);
        return;
      }
      nodes[nodeId].text = op.text;
      return;
    }

    if (op.op === "setColor") {
      const nodeId = resolveNodeRef(op.nodeId, nodes, tempIdToNodeId);
      if (!nodeId) {
        errors.push(`${opPath}.nodeId references unknown node "${op.nodeId}"`);
        return;
      }
      nodes[nodeId].color = op.color ?? undefined;
      return;
    }

    if (op.op === "move") {
      const nodeId = resolveNodeRef(op.nodeId, nodes, tempIdToNodeId);
      if (!nodeId) {
        errors.push(`${opPath}.nodeId references unknown node "${op.nodeId}"`);
        return;
      }
      if (nodeId === document.rootId) {
        errors.push(`${opPath}.nodeId cannot move root node`);
        return;
      }
      const newParentId = resolveNodeRef(op.newParentId, nodes, tempIdToNodeId);
      if (!newParentId) {
        errors.push(`${opPath}.newParentId references unknown node "${op.newParentId}"`);
        return;
      }
      if (nodeId === newParentId) {
        errors.push(`${opPath} cannot move a node under itself`);
        return;
      }
      if (isAncestor(nodeId, newParentId, nodes)) {
        errors.push(`${opPath} would create a cycle`);
        return;
      }
      const moving = nodes[nodeId];
      if (!moving.parentId || !nodes[moving.parentId]) {
        errors.push(`${opPath}.nodeId has invalid parent`);
        return;
      }
      const sourceSiblings = nodes[moving.parentId].childrenIds;
      const sourceIndex = findIndexOrError(sourceSiblings, nodeId);
      if (sourceIndex === -1) {
        errors.push(`${opPath}.nodeId is not found in current parent childrenIds`);
        return;
      }
      const targetSiblings = nodes[newParentId].childrenIds;
      const targetLengthAfterRemoval =
        moving.parentId === newParentId ? targetSiblings.length - 1 : targetSiblings.length;
      if (op.index < 0 || op.index > targetLengthAfterRemoval) {
        errors.push(
          `${opPath}.index must be between 0 and ${targetLengthAfterRemoval} for new parent "${newParentId}"`,
        );
        return;
      }
      sourceSiblings.splice(sourceIndex, 1);
      targetSiblings.splice(op.index, 0, nodeId);
      moving.parentId = newParentId;
      return;
    }

    const deletingId = resolveNodeRef(op.nodeId, nodes, tempIdToNodeId);
    if (!deletingId) {
      errors.push(`${opPath}.nodeId references unknown node "${op.nodeId}"`);
      return;
    }
    if (deletingId === document.rootId) {
      errors.push(`${opPath}.nodeId cannot delete root node`);
      return;
    }
    const deleting = nodes[deletingId];
    if (!deleting.parentId || !nodes[deleting.parentId]) {
      errors.push(`${opPath}.nodeId has invalid parent`);
      return;
    }
    const parent = nodes[deleting.parentId];
    const indexInParent = parent.childrenIds.indexOf(deletingId);
    if (indexInParent === -1) {
      errors.push(`${opPath}.nodeId is not found in parent childrenIds`);
      return;
    }
    parent.childrenIds.splice(indexInParent, 1, ...deleting.childrenIds);
    deleting.childrenIds.forEach((childId) => {
      const child = nodes[childId];
      if (!child) return;
      child.parentId = parent.id;
    });
    delete nodes[deletingId];
    Object.entries(tempIdToNodeId).forEach(([tempId, actualNodeId]) => {
      if (actualNodeId === deletingId) delete tempIdToNodeId[tempId];
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  const cursorId = normalizeCursor(document.cursorId, document.rootId, nodes);
  const nextState: DocumentState = {
    rootId: document.rootId,
    cursorId,
    nodes,
    nodePositions: {},
    edgeAnchors: {},
    customLinks: {},
    stickyNotes: {},
  };
  const fallbackPositions = sanitizeNodePositions(
    { rootId: document.rootId, nodes },
    existingPositions,
  );
  const originalIds = new Set(Object.keys(document.nodes));
  const nodeSizes = getNodeSizes(nodes);
  for (const id of Object.keys(nodes)) {
    if (originalIds.has(id) && existingPositions[id]) {
      nextState.nodePositions[id] = { ...fallbackPositions[id] };
      continue;
    }
    const parentId = nodes[id].parentId;
    const parentPoint = parentId
      ? nextState.nodePositions[parentId] ?? fallbackPositions[parentId]
      : fallbackPositions[id];
    const preferred =
      parentId && parentPoint
        ? {
            x: parentPoint.x + (nodeSizes[parentId]?.width ?? 0) + H_GAP,
            y: parentPoint.y,
          }
        : fallbackPositions[id];
    nextState.nodePositions[id] = findAvailablePosition(
      preferred,
      nextState.nodePositions,
      nodeSizes,
      nodeSizes[id],
    );
  }
  const integrityErrors = validateResultState(nextState);
  if (integrityErrors.length > 0) {
    return { ok: false, errors: integrityErrors };
  }
  return { ok: true, value: nextState };
}
