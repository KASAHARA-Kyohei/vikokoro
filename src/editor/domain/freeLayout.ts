import {
  computeTreePositions,
  NODE_HEIGHT,
  NODE_WIDTH,
  sanitizeNodePositions,
} from "../layout";
import type { NodeSize } from "../layout";
import type { CanvasPoint, DocumentState, NodeId } from "../types";

export function collectSubtreeNodeIds(doc: DocumentState, rootId: NodeId): NodeId[] {
  const result: NodeId[] = [];
  const visited = new Set<NodeId>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id) || !doc.nodes[id]) continue;
    visited.add(id);
    result.push(id);
    stack.push(...doc.nodes[id].childrenIds);
  }
  return result;
}

export function moveNodePositions(
  positions: Record<NodeId, CanvasPoint>,
  nodeIds: readonly NodeId[],
  dx: number,
  dy: number,
): Record<NodeId, CanvasPoint> {
  const next = { ...positions };
  for (const id of nodeIds) {
    const point = positions[id];
    if (!point) continue;
    next[id] = { x: point.x + dx, y: point.y + dy };
  }
  return next;
}

export function autoLayoutBranch(
  doc: DocumentState,
  rootId: NodeId,
): Record<NodeId, CanvasPoint> {
  const current = sanitizeNodePositions(doc, doc.nodePositions);
  const anchor = current[rootId];
  if (!anchor || !doc.nodes[rootId]) return current;
  const branch = computeTreePositions(doc, rootId);
  const branchRoot = branch[rootId] ?? { x: 0, y: 0 };
  const next = { ...current };
  for (const [nodeId, point] of Object.entries(branch)) {
    next[nodeId] = {
      x: anchor.x + point.x - branchRoot.x,
      y: anchor.y + point.y - branchRoot.y,
    };
  }
  return next;
}

function overlapsAny(
  point: CanvasPoint,
  positions: Record<NodeId, CanvasPoint>,
  sizes: Record<NodeId, NodeSize>,
  candidateSize: NodeSize,
  ignoredId?: NodeId,
): boolean {
  return Object.entries(positions).some(([id, other]) => {
    if (id === ignoredId) return false;
    const otherSize = sizes[id] ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
    return (
      point.x < other.x + otherSize.width + 16 &&
      point.x + candidateSize.width + 16 > other.x &&
      point.y < other.y + otherSize.height + 12 &&
      point.y + candidateSize.height + 12 > other.y
    );
  });
}

export function findAvailablePosition(
  preferred: CanvasPoint,
  positions: Record<NodeId, CanvasPoint>,
  sizes: Record<NodeId, NodeSize> = {},
  candidateSize: NodeSize = { width: NODE_WIDTH, height: NODE_HEIGHT },
): CanvasPoint {
  if (!overlapsAny(preferred, positions, sizes, candidateSize)) return preferred;
  const step = candidateSize.height + VERTICAL_SEARCH_GAP;
  for (let ring = 1; ring <= 100; ring += 1) {
    const down = { x: preferred.x, y: preferred.y + step * ring };
    if (!overlapsAny(down, positions, sizes, candidateSize)) return down;
    const up = { x: preferred.x, y: preferred.y - step * ring };
    if (!overlapsAny(up, positions, sizes, candidateSize)) return up;
  }
  return preferred;
}

const VERTICAL_SEARCH_GAP = 16;

type SnapGuide = { axis: "x" | "y"; value: number };
export type PositionedNode = CanvasPoint & NodeSize;

export function computeSnapAdjustment(
  movingNodes: readonly PositionedNode[],
  stationaryNodes: readonly PositionedNode[],
  threshold: number,
): { dx: number; dy: number; guides: SnapGuide[] } {
  let bestX: { delta: number; value: number } | null = null;
  let bestY: { delta: number; value: number } | null = null;
  for (const moving of movingNodes) {
    const movingXs = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
    const movingYs = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
    for (const stationary of stationaryNodes) {
      const stationaryXs = [
        stationary.x,
        stationary.x + stationary.width / 2,
        stationary.x + stationary.width,
      ];
      const stationaryYs = [
        stationary.y,
        stationary.y + stationary.height / 2,
        stationary.y + stationary.height,
      ];
      for (const mx of movingXs) {
        for (const sx of stationaryXs) {
          const delta = sx - mx;
          if (
            Math.abs(delta) <= threshold &&
            (!bestX || Math.abs(delta) < Math.abs(bestX.delta))
          ) {
            bestX = { delta, value: sx };
          }
        }
      }
      for (const my of movingYs) {
        for (const sy of stationaryYs) {
          const delta = sy - my;
          if (
            Math.abs(delta) <= threshold &&
            (!bestY || Math.abs(delta) < Math.abs(bestY.delta))
          ) {
            bestY = { delta, value: sy };
          }
        }
      }
    }
  }
  const guides: SnapGuide[] = [];
  if (bestX) guides.push({ axis: "x", value: bestX.value });
  if (bestY) guides.push({ axis: "y", value: bestY.value });
  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides };
}
