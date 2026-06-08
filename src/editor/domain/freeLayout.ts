import {
  computeTreePositions,
  NODE_HEIGHT,
  NODE_WIDTH,
  sanitizeNodePositions,
} from "../layout";
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
  ignoredId?: NodeId,
): boolean {
  return Object.entries(positions).some(([id, other]) => {
    if (id === ignoredId) return false;
    return (
      point.x < other.x + NODE_WIDTH + 16 &&
      point.x + NODE_WIDTH + 16 > other.x &&
      point.y < other.y + NODE_HEIGHT + 12 &&
      point.y + NODE_HEIGHT + 12 > other.y
    );
  });
}

export function findAvailablePosition(
  preferred: CanvasPoint,
  positions: Record<NodeId, CanvasPoint>,
): CanvasPoint {
  if (!overlapsAny(preferred, positions)) return preferred;
  const step = NODE_HEIGHT + 16;
  for (let ring = 1; ring <= 100; ring += 1) {
    const down = { x: preferred.x, y: preferred.y + step * ring };
    if (!overlapsAny(down, positions)) return down;
    const up = { x: preferred.x, y: preferred.y - step * ring };
    if (!overlapsAny(up, positions)) return up;
  }
  return preferred;
}

type SnapGuide = { axis: "x" | "y"; value: number };

export function computeSnapAdjustment(
  movingPoints: readonly CanvasPoint[],
  stationaryPoints: readonly CanvasPoint[],
  threshold: number,
): { dx: number; dy: number; guides: SnapGuide[] } {
  let bestX: { delta: number; value: number } | null = null;
  let bestY: { delta: number; value: number } | null = null;
  for (const moving of movingPoints) {
    const movingXs = [moving.x, moving.x + NODE_WIDTH / 2, moving.x + NODE_WIDTH];
    const movingYs = [moving.y, moving.y + NODE_HEIGHT / 2, moving.y + NODE_HEIGHT];
    for (const stationary of stationaryPoints) {
      const stationaryXs = [
        stationary.x,
        stationary.x + NODE_WIDTH / 2,
        stationary.x + NODE_WIDTH,
      ];
      const stationaryYs = [
        stationary.y,
        stationary.y + NODE_HEIGHT / 2,
        stationary.y + NODE_HEIGHT,
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
