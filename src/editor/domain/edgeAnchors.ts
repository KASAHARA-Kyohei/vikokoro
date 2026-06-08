import type { AnchorSide, DocumentState, EdgeAnchor, NodeId } from "../types";

export const ANCHOR_SIDES: AnchorSide[] = ["top", "right", "bottom", "left"];

export function makeEdgeKey(parentId: NodeId, childId: NodeId): string {
  return `${parentId}->${childId}`;
}

function isAnchorSide(value: unknown): value is AnchorSide {
  return (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  );
}

function sanitizeEndpoint(value: unknown): AnchorSide | null {
  return isAnchorSide(value) ? value : null;
}

export function sanitizeEdgeAnchors(
  doc: Pick<DocumentState, "nodes">,
  input: Record<string, EdgeAnchor> | undefined,
): Record<string, EdgeAnchor> {
  const result: Record<string, EdgeAnchor> = {};
  if (!input || typeof input !== "object") return result;

  for (const parent of Object.values(doc.nodes)) {
    for (const childId of parent.childrenIds) {
      if (!doc.nodes[childId]) continue;
      const key = makeEdgeKey(parent.id, childId);
      const anchor = input[key] as EdgeAnchor | undefined;
      if (!anchor || typeof anchor !== "object") continue;
      const from = sanitizeEndpoint(anchor.from);
      const to = sanitizeEndpoint(anchor.to);
      if (from === null && to === null) continue;
      result[key] = { from, to };
    }
  }

  return result;
}
