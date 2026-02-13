import type { Document, Node, NodeId } from "./types";
import type { NodePosition } from "./layout";

export function buildNodeEntries(doc: Document, positions: Record<NodeId, NodePosition>) {
  const entries: { node: Node; pos: NodePosition | undefined }[] = Object.values(doc.nodes).map((node) => ({
    node,
    pos: positions[node.id],
  }));

  return entries
    .filter((entry): entry is { node: Node; pos: NodePosition } => entry.pos !== undefined)
    .sort((a, b) => {
      if (a.pos.depth !== b.pos.depth) return a.pos.depth - b.pos.depth;
      return a.pos.y - b.pos.y;
    });
}

export function buildEdges(doc: Document): { fromId: NodeId; toId: NodeId }[] {
  const list: { fromId: NodeId; toId: NodeId }[] = [];
  for (const node of Object.values(doc.nodes)) {
    for (const childId of node.childrenIds) {
      list.push({ fromId: node.id, toId: childId });
    }
  }
  return list;
}

export function buildHighlightedEdgeKeys(
  doc: Document,
  edges: { fromId: NodeId; toId: NodeId }[],
): Set<string> {
  const set = new Set<string>();

  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return set;

  const chainEdges: string[] = [];
  let current: Node | undefined = cursor;
  while (current?.parentId) {
    chainEdges.push(`${current.parentId}-${current.id}`);
    current = doc.nodes[current.parentId];
  }
  for (const key of chainEdges) set.add(key);

  for (const edge of edges) {
    if (edge.fromId === doc.cursorId || edge.toId === doc.cursorId) {
      set.add(`${edge.fromId}-${edge.toId}`);
    }
  }

  return set;
}
