import type { AnchorSide, CanvasPoint, DocumentState, EdgeAnchor, Node, NodeId } from "./types";

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 34;
export const NODE_MAX_WIDTH = 320;
export const H_GAP = 80;
export const V_GAP = 16;
export const PADDING_X = 48;
export const PADDING_Y = 48;
export const CANVAS_ORIGIN_X = 2048;
export const CANVAS_ORIGIN_Y = 2048;
const NODE_PADDING_X = 40;
const NODE_PADDING_Y = 14;
const NODE_LINE_HEIGHT = 20;

export type NodePosition = CanvasPoint & { depth: number };
export type NodeSize = { width: number; height: number };

export type LayoutResult = {
  positions: Record<NodeId, NodePosition>;
  sizes: Record<NodeId, NodeSize>;
  contentWidth: number;
  contentHeight: number;
  offset: CanvasPoint;
};

const DEFAULT_NODE_SIZE: NodeSize = { width: NODE_WIDTH, height: NODE_HEIGHT };

function estimateCharacterWidth(character: string): number {
  if (character === "\t") return 28;
  if (character === " ") return 4;
  if (/[\u0000-\u007f]/.test(character)) {
    return /[MWmw@#%&]/.test(character) ? 10 : 7;
  }
  return 14;
}

function estimateTextWidth(text: string): number {
  return Array.from(text).reduce(
    (width, character) => width + estimateCharacterWidth(character),
    0,
  );
}

function countWrappedLine(line: string, contentWidth: number): number {
  if (line.length === 0) return 1;
  let lines = 1;
  let currentWidth = 0;
  const tokens = line.match(/\s+|[^\s]+/gu) ?? [];
  for (const token of tokens) {
    const tokenWidth = estimateTextWidth(token);
    const isWhitespace = /^\s+$/u.test(token);
    if (isWhitespace && currentWidth === 0) continue;
    if (currentWidth + tokenWidth <= contentWidth) {
      currentWidth += tokenWidth;
      continue;
    }
    if (tokenWidth <= contentWidth) {
      lines += 1;
      currentWidth = isWhitespace ? 0 : tokenWidth;
      continue;
    }
    if (currentWidth > 0) {
      lines += 1;
      currentWidth = 0;
    }
    for (const character of Array.from(token)) {
      const characterWidth = estimateCharacterWidth(character);
      if (currentWidth > 0 && currentWidth + characterWidth > contentWidth) {
        lines += 1;
        currentWidth = characterWidth;
      } else {
        currentWidth += characterWidth;
      }
    }
  }
  return lines;
}

function countWrappedLines(text: string, contentWidth: number): number {
  return text
    .split("\n")
    .reduce((total, line) => total + countWrappedLine(line, contentWidth), 0);
}

export function getNodeSize(node: Pick<Node, "text">): NodeSize {
  const lines = node.text.split("\n");
  const longestLineWidth = Math.max(0, ...lines.map(estimateTextWidth));
  const width = Math.min(
    NODE_MAX_WIDTH,
    Math.max(NODE_WIDTH, Math.ceil(longestLineWidth + NODE_PADDING_X)),
  );
  const lineCount = countWrappedLines(node.text, width - NODE_PADDING_X);
  const height = Math.max(NODE_HEIGHT, lineCount * NODE_LINE_HEIGHT + NODE_PADDING_Y);
  return { width, height };
}

export function getNodeSizes(
  nodes: Record<NodeId, Pick<Node, "text">>,
): Record<NodeId, NodeSize> {
  return Object.fromEntries(
    Object.entries(nodes).map(([nodeId, node]) => [nodeId, getNodeSize(node)]),
  );
}

function collectDepths(
  doc: Pick<DocumentState, "rootId" | "nodes">,
  rootId: NodeId = doc.rootId,
): Record<NodeId, number> {
  const depths: Record<NodeId, number> = {};
  const stack: Array<{ id: NodeId; depth: number }> = [{ id: rootId, depth: 0 }];
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
  const sizes = getNodeSizes(doc.nodes);
  const depths = collectDepths(doc, rootId);
  const maxWidthByDepth: Record<number, number> = {};
  for (const [nodeId, depth] of Object.entries(depths)) {
    maxWidthByDepth[depth] = Math.max(
      maxWidthByDepth[depth] ?? NODE_WIDTH,
      sizes[nodeId]?.width ?? NODE_WIDTH,
    );
  }
  const xByDepth: Record<number, number> = { 0: 0 };
  const maxDepth = Math.max(0, ...Object.values(depths));
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    xByDepth[depth] =
      xByDepth[depth - 1] + (maxWidthByDepth[depth - 1] ?? NODE_WIDTH) + H_GAP;
  }
  type SubtreeLayout = {
    centerY: number;
    maxY: number;
    nodeIds: NodeId[];
  };

  const visit = (nodeId: NodeId, depth: number, startY: number): SubtreeLayout => {
    const node = doc.nodes[nodeId];
    if (!node) return { centerY: startY, maxY: startY, nodeIds: [] };
    const size = sizes[nodeId] ?? DEFAULT_NODE_SIZE;
    const children = node.childrenIds.filter((id) => Boolean(doc.nodes[id]));
    if (children.length === 0) {
      positions[nodeId] = { x: xByDepth[depth] ?? 0, y: startY };
      return {
        centerY: startY + size.height / 2,
        maxY: startY + size.height,
        nodeIds: [nodeId],
      };
    }

    const childLayouts: SubtreeLayout[] = [];
    let childStartY = startY;
    for (const childId of children) {
      const childLayout = visit(childId, depth + 1, childStartY);
      childLayouts.push(childLayout);
      childStartY = childLayout.maxY + V_GAP;
    }

    let centerY =
      (childLayouts[0].centerY + childLayouts[childLayouts.length - 1].centerY) / 2;
    const nodeY = centerY - size.height / 2;
    const nodeIds = [nodeId, ...childLayouts.flatMap((layout) => layout.nodeIds)];
    positions[nodeId] = { x: xByDepth[depth] ?? 0, y: nodeY };

    const minY = Math.min(nodeY, startY);
    let maxY = Math.max(
      nodeY + size.height,
      ...childLayouts.map((layout) => layout.maxY),
    );
    if (minY < startY) {
      const delta = startY - minY;
      for (const id of nodeIds) {
        positions[id].y += delta;
      }
      centerY += delta;
      maxY += delta;
    }

    return { centerY, maxY, nodeIds };
  };

  visit(rootId, 0, 0);
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
  const sizes = getNodeSizes(doc.nodes);
  const source = sanitizeNodePositions(doc, doc.nodePositions);
  const ids = Object.keys(doc.nodes).filter((id) => source[id]);
  if (ids.length === 0) {
    return {
      positions: {},
      sizes: {},
      contentWidth: PADDING_X * 2,
      contentHeight: PADDING_Y * 2,
      offset: { x: PADDING_X, y: PADDING_Y },
    };
  }

  const minX = Math.min(...ids.map((id) => source[id].x));
  const minY = Math.min(...ids.map((id) => source[id].y));
  const maxX = Math.max(
    ...ids.map((id) => source[id].x + (sizes[id]?.width ?? NODE_WIDTH)),
  );
  const maxY = Math.max(
    ...ids.map((id) => source[id].y + (sizes[id]?.height ?? NODE_HEIGHT)),
  );
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
    sizes,
    contentWidth: Math.max(
      PADDING_X * 2 + Math.max(...ids.map((id) => sizes[id]?.width ?? NODE_WIDTH)),
      maxX + offset.x + CANVAS_ORIGIN_X,
    ),
    contentHeight: Math.max(
      PADDING_Y * 2 + Math.max(...ids.map((id) => sizes[id]?.height ?? NODE_HEIGHT)),
      maxY + offset.y + CANVAS_ORIGIN_Y,
    ),
    offset,
  };
}

export function getEdgeEndpoints(
  from: CanvasPoint,
  to: CanvasPoint,
  anchor?: EdgeAnchor,
  fromSize: NodeSize = DEFAULT_NODE_SIZE,
  toSize: NodeSize = DEFAULT_NODE_SIZE,
): {
  from: CanvasPoint;
  to: CanvasPoint;
  fromSide: AnchorSide;
  toSide: AnchorSide;
} {
  const fromCenter = {
    x: from.x + fromSize.width / 2,
    y: from.y + fromSize.height / 2,
  };
  const toCenter = { x: to.x + toSize.width / 2, y: to.y + toSize.height / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const horizontalBias = Math.max(fromSize.width, toSize.width) * 0.35;
  const verticalBias = Math.max(fromSize.height, toSize.height) * 2.5;
  const shouldUseVertical =
    Math.abs(dx) < horizontalBias && Math.abs(dy) > verticalBias;

  if (!shouldUseVertical) {
    const fromSide = dx >= 0 ? "right" : "left";
    const toSide = dx >= 0 ? "left" : "right";
    return {
      from: getAnchorPoint(from, anchor?.from ?? fromSide, fromSize),
      to: getAnchorPoint(to, anchor?.to ?? toSide, toSize),
      fromSide: anchor?.from ?? fromSide,
      toSide: anchor?.to ?? toSide,
    };
  }
  const fromSide = dy >= 0 ? "bottom" : "top";
  const toSide = dy >= 0 ? "top" : "bottom";
  return {
    from: getAnchorPoint(from, anchor?.from ?? fromSide, fromSize),
    to: getAnchorPoint(to, anchor?.to ?? toSide, toSize),
    fromSide: anchor?.from ?? fromSide,
    toSide: anchor?.to ?? toSide,
  };
}

export function getAnchorPoint(
  node: CanvasPoint,
  side: AnchorSide,
  size: NodeSize = DEFAULT_NODE_SIZE,
): CanvasPoint {
  switch (side) {
    case "top":
      return { x: node.x + size.width / 2, y: node.y };
    case "right":
      return { x: node.x + size.width, y: node.y + size.height / 2 };
    case "bottom":
      return { x: node.x + size.width / 2, y: node.y + size.height };
    case "left":
      return { x: node.x, y: node.y + size.height / 2 };
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
