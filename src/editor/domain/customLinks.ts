import type { CustomLink, DocumentState, NodeId } from "../types";

export function makeCustomLinkId(fromId: NodeId, toId: NodeId): string {
  const [a, b] = [fromId, toId].sort();
  return `${a}<->${b}`;
}

export function isParentChildPair(
  doc: Pick<DocumentState, "nodes">,
  fromId: NodeId,
  toId: NodeId,
): boolean {
  return (
    doc.nodes[fromId]?.childrenIds.includes(toId) ||
    doc.nodes[toId]?.childrenIds.includes(fromId) ||
    false
  );
}

export function canCreateCustomLink(
  doc: Pick<DocumentState, "nodes" | "customLinks">,
  fromId: NodeId,
  toId: NodeId,
): boolean {
  if (fromId === toId) return false;
  if (!doc.nodes[fromId] || !doc.nodes[toId]) return false;
  if (isParentChildPair(doc, fromId, toId)) return false;
  return !doc.customLinks[makeCustomLinkId(fromId, toId)];
}

function normalizeLink(
  doc: Pick<DocumentState, "nodes">,
  value: unknown,
): CustomLink | null {
  if (!value || typeof value !== "object") return null;
  const link = value as CustomLink;
  if (typeof link.fromId !== "string" || typeof link.toId !== "string") return null;
  if (link.fromId === link.toId) return null;
  if (!doc.nodes[link.fromId] || !doc.nodes[link.toId]) return null;
  if (isParentChildPair(doc, link.fromId, link.toId)) return null;
  const [fromId, toId] = [link.fromId, link.toId].sort();
  const id = makeCustomLinkId(fromId, toId);
  return { id, fromId, toId };
}

export function sanitizeCustomLinks(
  doc: Pick<DocumentState, "nodes">,
  input: Record<string, CustomLink> | undefined,
): Record<string, CustomLink> {
  const result: Record<string, CustomLink> = {};
  if (!input || typeof input !== "object") return result;

  for (const value of Object.values(input)) {
    const link = normalizeLink(doc, value);
    if (!link) continue;
    if (result[link.id]) continue;
    result[link.id] = link;
  }

  return result;
}
