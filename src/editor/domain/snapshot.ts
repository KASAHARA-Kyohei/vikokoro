import type { DocumentState, Node, NodeId } from "../types";

export function cloneDocumentState(doc: DocumentState): DocumentState {
  const nodes: Record<NodeId, Node> = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    nodes[id] = {
      id: node.id,
      text: node.text,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
      color: node.color,
    };
  }
  return {
    rootId: doc.rootId,
    cursorId: doc.cursorId,
    nodes,
  };
}

export function documentStateEquals(a: DocumentState, b: DocumentState): boolean {
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
    if (an.color !== bn.color) return false;
    if (an.childrenIds.length !== bn.childrenIds.length) return false;
    for (let i = 0; i < an.childrenIds.length; i += 1) {
      if (an.childrenIds[i] !== bn.childrenIds[i]) return false;
    }
  }
  return true;
}
