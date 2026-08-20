import type {
  BranchDirection,
  BranchTone,
  CanvasPoint,
  CanvasSize,
  DocumentState,
  Node,
  NodeId,
} from "../types";

export const BRANCH_DIRECTIONS: readonly BranchDirection[] = [
  "n", "ne", "e", "se", "s", "sw", "w", "nw",
];

export const BRANCH_TONES: readonly BranchTone[] = [
  "sky", "teal", "fern", "amber", "coral", "rose", "violet", "indigo",
];

export const DIRECTION_KEY_MAP: Readonly<Record<string, BranchDirection>> = {
  q: "nw",
  w: "n",
  e: "ne",
  a: "w",
  d: "e",
  z: "sw",
  x: "s",
  c: "se",
};

export function resolveDirectionPickerKey(
  key: string,
  modified = false,
): BranchDirection | "cancel" | null {
  if (key === "Escape") return "cancel";
  if (modified) return null;
  return DIRECTION_KEY_MAP[key.toLowerCase()] ?? null;
}

const DIRECTION_VECTORS: Readonly<Record<BranchDirection, CanvasPoint>> = {
  n: { x: 0, y: -1 },
  ne: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  e: { x: 1, y: 0 },
  se: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  s: { x: 0, y: 1 },
  sw: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  w: { x: -1, y: 0 },
  nw: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};

export function isBranchDirection(value: unknown): value is BranchDirection {
  return typeof value === "string" && BRANCH_DIRECTIONS.includes(value as BranchDirection);
}

export function isBranchTone(value: unknown): value is BranchTone {
  return typeof value === "string" && BRANCH_TONES.includes(value as BranchTone);
}

export function directionVector(direction: BranchDirection): CanvasPoint {
  return DIRECTION_VECTORS[direction];
}

export function directionTangent(direction: BranchDirection): CanvasPoint {
  const vector = directionVector(direction);
  let tangent = { x: -vector.y, y: vector.x };
  if (tangent.y < 0 || (Math.abs(tangent.y) < 0.001 && tangent.x < 0)) {
    tangent = { x: -tangent.x, y: -tangent.y };
  }
  return tangent;
}

function center(point: CanvasPoint, size: CanvasSize | undefined): CanvasPoint {
  return {
    x: point.x + (size?.width ?? 180) / 2,
    y: point.y + (size?.height ?? 34) / 2,
  };
}

export function inferBranchDirection(
  parentPoint: CanvasPoint,
  childPoint: CanvasPoint,
  parentSize?: CanvasSize,
  childSize?: CanvasSize,
  fallback: BranchDirection = "e",
): BranchDirection {
  const parentCenter = center(parentPoint, parentSize);
  const childCenter = center(childPoint, childSize);
  const dx = childCenter.x - parentCenter.x;
  const dy = childCenter.y - parentCenter.y;
  if (Math.hypot(dx, dy) < 4) return fallback;
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const byOctant: Record<number, BranchDirection> = {
    [-4]: "w", [-3]: "nw", [-2]: "n", [-1]: "ne", 0: "e",
    1: "se", 2: "s", 3: "sw", 4: "w",
  };
  return byOctant[octant] ?? fallback;
}

export function sanitizeBranchDirections(
  doc: Pick<DocumentState, "rootId" | "nodes" | "nodePositions" | "cardSizes">,
  input: Record<NodeId, BranchDirection> | undefined,
): Record<NodeId, BranchDirection> {
  const result: Record<NodeId, BranchDirection> = {};
  for (const [nodeId, node] of Object.entries(doc.nodes)) {
    if (nodeId === doc.rootId || !node.parentId || !doc.nodes[node.parentId]) continue;
    const saved = input?.[nodeId];
    if (isBranchDirection(saved)) {
      result[nodeId] = saved;
      continue;
    }
    const parentPoint = doc.nodePositions[node.parentId];
    const childPoint = doc.nodePositions[nodeId];
    result[nodeId] = parentPoint && childPoint
      ? inferBranchDirection(
          parentPoint,
          childPoint,
          doc.cardSizes[node.parentId],
          doc.cardSizes[nodeId],
        )
      : "e";
  }
  return result;
}

export function preferredChildDirection(
  doc: Pick<DocumentState, "rootId" | "nodes"> &
    Partial<Pick<DocumentState, "branchDirections">>,
  parentId: NodeId,
): BranchDirection {
  const parent = doc.nodes[parentId];
  if (!parent) return "e";
  for (let index = parent.childrenIds.length - 1; index >= 0; index -= 1) {
    const direction = doc.branchDirections?.[parent.childrenIds[index]];
    if (direction) return direction;
  }
  return parentId === doc.rootId ? "e" : doc.branchDirections?.[parentId] ?? "e";
}

export function nextBranchTone(doc: Pick<DocumentState, "rootId" | "nodes">): BranchTone {
  const root = doc.nodes[doc.rootId];
  const used = new Set(
    root?.childrenIds
      .map((id) => doc.nodes[id]?.branchTone)
      .filter((tone): tone is BranchTone => isBranchTone(tone)) ?? [],
  );
  return BRANCH_TONES.find((tone) => !used.has(tone))
    ?? BRANCH_TONES[(root?.childrenIds.length ?? 0) % BRANCH_TONES.length];
}

export function sanitizeBranchTones(
  doc: Pick<DocumentState, "rootId" | "nodes">,
): Record<NodeId, Node> {
  const root = doc.nodes[doc.rootId];
  if (!root) return doc.nodes;
  let changed = false;
  const nodes = { ...doc.nodes };
  const used = new Set<BranchTone>();
  for (const childId of root.childrenIds) {
    const child = nodes[childId];
    if (!child) continue;
    if (isBranchTone(child.branchTone)) {
      used.add(child.branchTone);
      continue;
    }
    const tone = BRANCH_TONES.find((candidate) => !used.has(candidate))
      ?? BRANCH_TONES[used.size % BRANCH_TONES.length];
    nodes[childId] = { ...child, branchTone: tone };
    used.add(tone);
    changed = true;
  }
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.parentId !== doc.rootId && node.branchTone !== undefined) {
      nodes[nodeId] = { ...node, branchTone: undefined };
      changed = true;
    }
  }
  return changed ? nodes : doc.nodes;
}

export function firstLevelBranchId(
  doc: Pick<DocumentState, "rootId" | "nodes">,
  nodeId: NodeId,
): NodeId | null {
  if (nodeId === doc.rootId) return null;
  let currentId = nodeId;
  const visited = new Set<NodeId>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = doc.nodes[currentId]?.parentId;
    if (!parentId) return null;
    if (parentId === doc.rootId) return currentId;
    currentId = parentId;
  }
  return null;
}

export function branchToneForNode(
  doc: Pick<DocumentState, "rootId" | "nodes">,
  nodeId: NodeId,
): BranchTone | null {
  const branchId = firstLevelBranchId(doc, nodeId);
  const tone = branchId ? doc.nodes[branchId]?.branchTone : undefined;
  return isBranchTone(tone) ? tone : null;
}
