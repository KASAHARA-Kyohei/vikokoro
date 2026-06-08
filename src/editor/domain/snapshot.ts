import type { CanvasPoint, DocumentState, EdgeAnchor, Node, NodeId } from "../types";

export function cloneDocumentState(doc: DocumentState): DocumentState {
  const nodes: Record<NodeId, Node> = {};
  const nodePositions: Record<NodeId, CanvasPoint> = {};
  const edgeAnchors: Record<string, EdgeAnchor> = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    nodes[id] = {
      id: node.id,
      text: node.text,
      note: node.note,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      color: node.color,
    };
    const point = doc.nodePositions?.[id];
    if (point) {
      nodePositions[id] = { x: point.x, y: point.y };
    }
  }
  for (const [key, anchor] of Object.entries(doc.edgeAnchors ?? {})) {
    edgeAnchors[key] = { from: anchor.from, to: anchor.to };
  }
  return {
    rootId: doc.rootId,
    cursorId: doc.cursorId,
    nodes,
    nodePositions,
    edgeAnchors,
  };
}

export function documentStateEquals(a: DocumentState, b: DocumentState): boolean {
  if (a.rootId !== b.rootId) return false;
  if (a.cursorId !== b.cursorId) return false;
  const aEdgeKeys = Object.keys(a.edgeAnchors ?? {}).sort();
  const bEdgeKeys = Object.keys(b.edgeAnchors ?? {}).sort();
  if (aEdgeKeys.length !== bEdgeKeys.length) return false;
  for (let i = 0; i < aEdgeKeys.length; i += 1) {
    const key = aEdgeKeys[i];
    if (key !== bEdgeKeys[i]) return false;
    const aa = a.edgeAnchors?.[key];
    const ba = b.edgeAnchors?.[key];
    if (aa?.from !== ba?.from || aa?.to !== ba?.to) return false;
  }
  const aKeys = Object.keys(a.nodes);
  const bKeys = Object.keys(b.nodes);
  if (aKeys.length !== bKeys.length) return false;
  for (const id of aKeys) {
    const an = a.nodes[id];
    const bn = b.nodes[id];
    if (!bn) return false;
    if (an.id !== bn.id) return false;
    if (an.text !== bn.text) return false;
    if (an.note !== bn.note) return false;
    if (an.parentId !== bn.parentId) return false;
    if (an.color !== bn.color) return false;
    if (an.childrenIds.length !== bn.childrenIds.length) return false;
    for (let i = 0; i < an.childrenIds.length; i += 1) {
      if (an.childrenIds[i] !== bn.childrenIds[i]) return false;
    }
    const ap = a.nodePositions?.[id];
    const bp = b.nodePositions?.[id];
    if (Boolean(ap) !== Boolean(bp)) return false;
    if (ap && bp && (ap.x !== bp.x || ap.y !== bp.y)) return false;
  }
  return true;
}
