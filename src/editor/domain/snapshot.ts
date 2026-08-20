import type {
  CanvasPoint,
  CustomLink,
  DocumentState,
  EdgeAnchor,
  Node,
  NodeId,
  StickyNote,
} from "../types";

export function cloneDocumentState(doc: DocumentState): DocumentState {
  const nodes: Record<NodeId, Node> = {};
  const nodePositions: Record<NodeId, CanvasPoint> = {};
  const edgeAnchors: Record<string, EdgeAnchor> = {};
  const customLinks: Record<string, CustomLink> = {};
  const stickyNotes: Record<string, StickyNote> = {};
  const cardSizes: DocumentState["cardSizes"] = {};
  const branchDirections: DocumentState["branchDirections"] = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    nodes[id] = {
      id: node.id,
      text: node.text,
      note: node.note,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      color: node.color,
      branchTone: node.branchTone,
    };
    const point = doc.nodePositions?.[id];
    if (point) {
      nodePositions[id] = { x: point.x, y: point.y };
    }
    const size = doc.cardSizes?.[id];
    if (size) cardSizes[id] = { width: size.width, height: size.height };
    const direction = doc.branchDirections?.[id];
    if (direction) branchDirections[id] = direction;
  }
  for (const [key, anchor] of Object.entries(doc.edgeAnchors ?? {})) {
    edgeAnchors[key] = { from: anchor.from, to: anchor.to };
  }
  for (const [id, link] of Object.entries(doc.customLinks ?? {})) {
    customLinks[id] = { id: link.id, fromId: link.fromId, toId: link.toId };
  }
  for (const [id, note] of Object.entries(doc.stickyNotes ?? {})) {
    stickyNotes[id] = {
      id: note.id,
      text: note.text,
      position: { x: note.position.x, y: note.position.y },
    };
  }
  return {
    rootId: doc.rootId,
    cursorId: doc.cursorId,
    nodes,
    nodePositions,
    branchDirections,
    edgeAnchors,
    customLinks,
    stickyNotes,
    cardSizes,
  };
}

export function documentStateEquals(a: DocumentState, b: DocumentState): boolean {
  if (a.rootId !== b.rootId) return false;
  if (a.cursorId !== b.cursorId) return false;
  const aStickyKeys = Object.keys(a.stickyNotes ?? {}).sort();
  const bStickyKeys = Object.keys(b.stickyNotes ?? {}).sort();
  if (aStickyKeys.length !== bStickyKeys.length) return false;
  for (let i = 0; i < aStickyKeys.length; i += 1) {
    const key = aStickyKeys[i];
    if (key !== bStickyKeys[i]) return false;
    const an = a.stickyNotes?.[key];
    const bn = b.stickyNotes?.[key];
    if (an?.id !== bn?.id || an?.text !== bn?.text) return false;
    if (an?.position.x !== bn?.position.x || an?.position.y !== bn?.position.y) {
      return false;
    }
  }
  const aCustomLinkKeys = Object.keys(a.customLinks ?? {}).sort();
  const bCustomLinkKeys = Object.keys(b.customLinks ?? {}).sort();
  if (aCustomLinkKeys.length !== bCustomLinkKeys.length) return false;
  for (let i = 0; i < aCustomLinkKeys.length; i += 1) {
    const key = aCustomLinkKeys[i];
    if (key !== bCustomLinkKeys[i]) return false;
    const al = a.customLinks?.[key];
    const bl = b.customLinks?.[key];
    if (al?.id !== bl?.id || al?.fromId !== bl?.fromId || al?.toId !== bl?.toId) {
      return false;
    }
  }
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
    if (an.branchTone !== bn.branchTone) return false;
    if (a.branchDirections?.[id] !== b.branchDirections?.[id]) return false;
    if (an.childrenIds.length !== bn.childrenIds.length) return false;
    for (let i = 0; i < an.childrenIds.length; i += 1) {
      if (an.childrenIds[i] !== bn.childrenIds[i]) return false;
    }
    const ap = a.nodePositions?.[id];
    const bp = b.nodePositions?.[id];
    if (Boolean(ap) !== Boolean(bp)) return false;
    if (ap && bp && (ap.x !== bp.x || ap.y !== bp.y)) return false;
    const as = a.cardSizes?.[id];
    const bs = b.cardSizes?.[id];
    if (Boolean(as) !== Boolean(bs)) return false;
    if (as && bs && (as.width !== bs.width || as.height !== bs.height)) return false;
  }
  return true;
}
