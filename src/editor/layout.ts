import type { AnchorSide, CanvasPoint, DocumentState, EdgeAnchor, NodeId } from "./types";

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 34;
export const H_GAP = 80;
export const V_GAP = 16;
export const PADDING_X = 48;
export const PADDING_Y = 48;
export const CANVAS_ORIGIN_X = 2048;
export const CANVAS_ORIGIN_Y = 2048;

export type NodePosition = CanvasPoint & { depth: number };

export type LayoutResult = {
  positions: Record<NodeId, NodePosition>;
  contentWidth: number;
  contentHeight: number;
  offset: CanvasPoint;
};

function collectDepths(doc: DocumentState): Record<NodeId, number> {
  const depths: Record<NodeId, number> = {};
  const stack: Array<{ id: NodeId; depth: number }> = [{ id: doc.rootId, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (depths[current.id] !== undefined) continue;
    const node = doc.nodes[current.id];
    if (!node) continue;
    depths[current.id] = current.depth;
    for (let index = node.childrenIds.length - 1; index >= 0; index -= 1) {
      stack.push({ id: node.childrenIds[index], depth: current.depth + 1 });
    }
  }
  return depths;
}

export function computeTreePositions(
  doc: Pick<DocumentState, "rootId" | "nodes">,
  rootId: NodeId = doc.rootId,
): Record<NodeId, CanvasPoint> {
  const positions: Record<NodeId, CanvasPoint> = {};
  let nextY = 0;

  const visit = (nodeId: NodeId, depth: number): number => {
    const node = doc.nodes[nodeId];
    if (!node) return nextY;
    const children = node.childrenIds.filter((id) => Boolean(doc.nodes[id]));
    if (children.length === 0) {
      const y = nextY;
      nextY += NODE_HEIGHT + V_GAP;
      positions[nodeId] = { x: depth * (NODE_WIDTH + H_GAP), y };
      return y;
    }
    const childYs = children.map((childId) => visit(childId, depth + 1));
    const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    positions[nodeId] = { x: depth * (NODE_WIDTH + H_GAP), y };
    return y;
  };

  visit(rootId, 0);
  return positions;
}

export function isFiniteCanvasPoint(value: unknown): value is CanvasPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as CanvasPoint;
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function sanitizeNodePositions(
  doc: Pick<DocumentState, "rootId" | "nodes">,
  input: Record<NodeId, CanvasPoint> | undefined,
): Record<NodeId, CanvasPoint> {
  const fallback = computeTreePositions(doc);
  const result: Record<NodeId, CanvasPoint> = {};
  for (const nodeId of Object.keys(doc.nodes)) {
    const point = input?.[nodeId];
    const resolved = isFiniteCanvasPoint(point) ? point : fallback[nodeId] ?? { x: 0, y: 0 };
    result[nodeId] = { x: resolved.x, y: resolved.y };
  }
  return result;
}

export function computeLayout(doc: DocumentState): LayoutResult {
  const depths = collectDepths(doc);
  const source = sanitizeNodePositions(doc, doc.nodePositions);
  const ids = Object.keys(doc.nodes).filter((id) => source[id]);
  if (ids.length === 0) {
    return {
      positions: {},
      contentWidth: PADDING_X * 2,
      contentHeight: PADDING_Y * 2,
      offset: { x: PADDING_X, y: PADDING_Y },
    };
  }

  const minX = Math.min(...ids.map((id) => source[id].x));
  const minY = Math.min(...ids.map((id) => source[id].y));
  const maxX = Math.max(...ids.map((id) => source[id].x + NODE_WIDTH));
  const maxY = Math.max(...ids.map((id) => source[id].y + NODE_HEIGHT));
  const offset = {
    x: Math.max(CANVAS_ORIGIN_X, PADDING_X - minX),
    y: Math.max(CANVAS_ORIGIN_Y, PADDING_Y - minY),
  };
  const positions: Record<NodeId, NodePosition> = {};
  for (const id of ids) {
    positions[id] = {
      x: source[id].x + offset.x,
      y: source[id].y + offset.y,
      depth: depths[id] ?? 0,
    };
  }

  return {
    positions,
    contentWidth: Math.max(
      PADDING_X * 2 + NODE_WIDTH,
      maxX + offset.x + CANVAS_ORIGIN_X,
    ),
    contentHeight: Math.max(
      PADDING_Y * 2 + NODE_HEIGHT,
      maxY + offset.y + CANVAS_ORIGIN_Y,
    ),
    offset,
  };
}

export function getEdgeEndpoints(
  from: CanvasPoint,
  to: CanvasPoint,
  anchor?: EdgeAnchor,
): {
  from: CanvasPoint;
  to: CanvasPoint;
  fromSide: AnchorSide;
  toSide: AnchorSide;
} {
  const fromCenter = { x: from.x + NODE_WIDTH / 2, y: from.y + NODE_HEIGHT / 2 };
  const toCenter = { x: to.x + NODE_WIDTH / 2, y: to.y + NODE_HEIGHT / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const horizontalBias = NODE_WIDTH * 0.35;
  const verticalBias = NODE_HEIGHT * 2.5;
  const shouldUseVertical =
    Math.abs(dx) < horizontalBias && Math.abs(dy) > verticalBias;

  if (!shouldUseVertical) {
    const fromSide = dx >= 0 ? "right" : "left";
    const toSide = dx >= 0 ? "left" : "right";
    return {
      from: getAnchorPoint(from, anchor?.from ?? fromSide),
      to: getAnchorPoint(to, anchor?.to ?? toSide),
      fromSide: anchor?.from ?? fromSide,
      toSide: anchor?.to ?? toSide,
    };
  }
  const fromSide = dy >= 0 ? "bottom" : "top";
  const toSide = dy >= 0 ? "top" : "bottom";
  return {
    from: getAnchorPoint(from, anchor?.from ?? fromSide),
    to: getAnchorPoint(to, anchor?.to ?? toSide),
    fromSide: anchor?.from ?? fromSide,
    toSide: anchor?.to ?? toSide,
  };
}

export function getAnchorPoint(node: CanvasPoint, side: AnchorSide): CanvasPoint {
  switch (side) {
    case "top":
      return { x: node.x + NODE_WIDTH / 2, y: node.y };
    case "right":
      return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
    case "bottom":
      return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT };
    case "left":
      return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
  }
}

function anchorVector(side: AnchorSide): CanvasPoint {
  switch (side) {
    case "top":
      return { x: 0, y: -1 };
    case "right":
      return { x: 1, y: 0 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
  }
}

function getCurveControlDistance(
  from: CanvasPoint,
  to: CanvasPoint,
  fromSide: AnchorSide,
  toSide: AnchorSide,
): number {
  const horizontal =
    (fromSide === "left" || fromSide === "right") &&
    (toSide === "left" || toSide === "right");
  const vertical =
    (fromSide === "top" || fromSide === "bottom") &&
    (toSide === "top" || toSide === "bottom");
  const span = horizontal
    ? Math.abs(to.x - from.x)
    : vertical
      ? Math.abs(to.y - from.y)
      : Math.hypot(to.x - from.x, to.y - from.y);
  const maxDistance = horizontal || vertical ? 120 : 96;
  return Math.min(maxDistance, Math.max(32, span * 0.24));
}

export function svgPathForEdge(
  from: CanvasPoint,
  to: CanvasPoint,
  fromSide: AnchorSide = "right",
  toSide: AnchorSide = "left",
): string {
  const fromVector = anchorVector(fromSide);
  const toVector = anchorVector(toSide);
  const distance = getCurveControlDistance(from, to, fromSide, toSide);
  const c1 = {
    x: from.x + fromVector.x * distance,
    y: from.y + fromVector.y * distance,
  };
  const c2 = {
    x: to.x + toVector.x * distance,
    y: to.y + toVector.y * distance,
  };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}
