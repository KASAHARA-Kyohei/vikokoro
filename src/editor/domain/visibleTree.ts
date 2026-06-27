import { makeEdgeKey } from "./edgeAnchors";
import type {
  CanvasPoint,
  CustomLink,
  Document,
  DocumentState,
  EdgeAnchor,
  Node,
  NodeId,
} from "../types";

export type VisibleTreeProjection = {
  state: DocumentState;
  visibleNodeIds: Set<NodeId>;
  hiddenDescendantCounts: Record<NodeId, number>;
};

export function isDescendantOrSelf(
  doc: DocumentState,
  nodeId: NodeId,
  ancestorId: NodeId,
): boolean {
  let current: Node | undefined = doc.nodes[nodeId];
  const visited = new Set<NodeId>();
  while (current && !visited.has(current.id)) {
    if (current.id === ancestorId) return true;
    visited.add(current.id);
    current = current.parentId ? doc.nodes[current.parentId] : undefined;
  }
  return false;
}

export function getAncestorIds(doc: DocumentState, nodeId: NodeId): NodeId[] {
  const ancestors: NodeId[] = [];
  let current: Node | undefined = doc.nodes[nodeId];
  const visited = new Set<NodeId>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    ancestors.push(current.parentId);
    current = doc.nodes[current.parentId];
  }
  return ancestors;
}

export function getBreadcrumbNodeIds(doc: DocumentState, nodeId: NodeId): NodeId[] {
  if (!doc.nodes[nodeId]) return [];
  return [...getAncestorIds(doc, nodeId).reverse(), nodeId];
}

export function countDescendants(doc: DocumentState, nodeId: NodeId): number {
  const root = doc.nodes[nodeId];
  if (!root) return 0;

  let count = 0;
  const visited = new Set<NodeId>([nodeId]);
  const stack = [...root.childrenIds];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const current = doc.nodes[currentId];
    if (!current) continue;
    count += 1;
    stack.push(...current.childrenIds);
  }
  return count;
}

export function sanitizeCollapsedNodeIds(
  doc: DocumentState,
  collapsedNodeIds: readonly NodeId[] | undefined,
): NodeId[] {
  const unique = new Set<NodeId>();
  for (const nodeId of collapsedNodeIds ?? []) {
    const node = doc.nodes[nodeId];
    if (node && node.childrenIds.length > 0) {
      unique.add(nodeId);
    }
  }
  return [...unique];
}

export function buildVisibleTreeProjection(
  doc: Document,
  focusRootId: NodeId | null,
): VisibleTreeProjection {
  const rootId =
    focusRootId && doc.nodes[focusRootId] ? focusRootId : doc.rootId;
  const collapsed = new Set(sanitizeCollapsedNodeIds(doc, doc.collapsedNodeIds));
  const visibleNodeIds = new Set<NodeId>();
  const nodes: Record<NodeId, Node> = {};
  const nodePositions: Record<NodeId, CanvasPoint> = {};
  const edgeAnchors: Record<string, EdgeAnchor> = {};
  const customLinks: Record<string, CustomLink> = {};
  const hiddenDescendantCounts: Record<NodeId, number> = {};

  const visit = (nodeId: NodeId, parentId: NodeId | null) => {
    const node = doc.nodes[nodeId];
    if (!node || visibleNodeIds.has(nodeId)) return;
    visibleNodeIds.add(nodeId);

    const isCollapsed = collapsed.has(nodeId) && node.childrenIds.length > 0;
    const visibleChildren = isCollapsed
      ? []
      : node.childrenIds.filter((childId) => Boolean(doc.nodes[childId]));

    nodes[nodeId] = {
      ...node,
      parentId,
      childrenIds: visibleChildren,
    };
    const point = doc.nodePositions?.[nodeId];
    if (point) nodePositions[nodeId] = point;
    for (const childId of visibleChildren) {
      const key = makeEdgeKey(nodeId, childId);
      const anchor = doc.edgeAnchors?.[key];
      if (anchor) edgeAnchors[key] = { from: anchor.from, to: anchor.to };
    }

    if (isCollapsed) {
      hiddenDescendantCounts[nodeId] = countDescendants(doc, nodeId);
      return;
    }
    for (const childId of visibleChildren) {
      visit(childId, nodeId);
    }
  };

  visit(rootId, null);
  for (const link of Object.values(doc.customLinks ?? {})) {
    if (visibleNodeIds.has(link.fromId) && visibleNodeIds.has(link.toId)) {
      customLinks[link.id] = { id: link.id, fromId: link.fromId, toId: link.toId };
    }
  }
  const cursorId = visibleNodeIds.has(doc.cursorId) ? doc.cursorId : rootId;

  return {
    state: { rootId, cursorId, nodes, nodePositions, edgeAnchors, customLinks },
    visibleNodeIds,
    hiddenDescendantCounts,
  };
}

export function collectBranchNodeIds(doc: DocumentState, rootId: NodeId): NodeId[] {
  const result: NodeId[] = [];
  const visited = new Set<NodeId>();
  const stack = [rootId];
  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = doc.nodes[nodeId];
    if (!node) continue;
    if (node.childrenIds.length > 0) result.push(nodeId);
    stack.push(...node.childrenIds);
  }
  return result;
}
