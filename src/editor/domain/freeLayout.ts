import {
  computeTreePositions,
  NODE_HEIGHT,
  NODE_WIDTH,
  sanitizeNodePositions,
} from "../layout";
import type { NodeSize } from "../layout";
import type { BranchDirection, CanvasPoint, DocumentState, NodeId } from "../types";
import { directionTangent, directionVector } from "./branchDirections";

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

const COLLISION_GAP_X = 16;
const COLLISION_GAP_Y = 12;

type NodeRect = CanvasPoint & NodeSize;

function rectanglesOverlap(a: NodeRect, b: NodeRect): boolean {
  return (
    a.x < b.x + b.width + COLLISION_GAP_X &&
    a.x + a.width + COLLISION_GAP_X > b.x &&
    a.y < b.y + b.height + COLLISION_GAP_Y &&
    a.y + a.height + COLLISION_GAP_Y > b.y
  );
}

function findMovableBranchRoot(
  doc: DocumentState,
  nodeId: NodeId,
  protectedIds: ReadonlySet<NodeId>,
): NodeId | null {
  if (protectedIds.has(nodeId)) return null;
  let currentId = nodeId;
  const visited = new Set<NodeId>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = doc.nodes[currentId]?.parentId;
    if (!parentId || protectedIds.has(parentId) || !doc.nodes[parentId]) {
      return currentId;
    }
    currentId = parentId;
    if (protectedIds.has(currentId)) return null;
  }
  return null;
}

export function makeSpaceForNode(
  doc: DocumentState,
  preferred: CanvasPoint,
  sizes: Record<NodeId, NodeSize>,
  candidateSize: NodeSize,
  protectedNodeIds: readonly NodeId[],
): Record<NodeId, CanvasPoint> {
  let positions = { ...doc.nodePositions };
  const protectedIds = new Set(protectedNodeIds);
  const candidateRect = { ...preferred, ...candidateSize };
  const branchRootFor = (nodeId: NodeId) =>
    findMovableBranchRoot(doc, nodeId, protectedIds);
  const branchIdsFor = (rootId: NodeId) => collectSubtreeNodeIds(doc, rootId);
  const rectFor = (nodeId: NodeId): NodeRect | null => {
    const point = positions[nodeId];
    if (!point) return null;
    return {
      ...point,
      ...(sizes[nodeId] ?? { width: NODE_WIDTH, height: NODE_HEIGHT }),
    };
  };
  const branchTop = (rootId: NodeId) =>
    Math.min(
      ...branchIdsFor(rootId)
        .map((id) => positions[id]?.y)
        .filter((value): value is number => value !== undefined),
    );

  const pushBranchBelow = (
    rootId: NodeId,
    blockers: readonly NodeRect[],
    activeRoots: ReadonlySet<NodeId>,
  ) => {
    if (activeRoots.has(rootId)) return;
    const nextActiveRoots = new Set(activeRoots).add(rootId);
    const branchIds = branchIdsFor(rootId);
    const branchSet = new Set(branchIds);
    const currentBlockers = [...blockers];

    for (let attempt = 0; attempt < 100; attempt += 1) {
      let dy = 0;
      for (const nodeId of branchIds) {
        const rect = rectFor(nodeId);
        if (!rect) continue;
        for (const blocker of currentBlockers) {
          if (!rectanglesOverlap(rect, blocker)) continue;
          dy = Math.max(dy, blocker.y + blocker.height + COLLISION_GAP_Y - rect.y);
        }
      }
      if (dy > 0) {
        positions = moveNodePositions(positions, branchIds, 0, dy);
      }

      const collisions = Object.keys(positions)
        .filter((nodeId) => !branchSet.has(nodeId))
        .map((nodeId) => {
          const rect = rectFor(nodeId);
          if (!rect) return null;
          const overlaps = branchIds.some((branchId) => {
            const branchRect = rectFor(branchId);
            return branchRect ? rectanglesOverlap(branchRect, rect) : false;
          });
          return overlaps ? { nodeId, rect } : null;
        })
        .filter(
          (collision): collision is { nodeId: NodeId; rect: NodeRect } =>
            collision !== null,
        )
        .sort(
          (a, b) =>
            a.rect.y - b.rect.y ||
            a.rect.x - b.rect.x ||
            a.nodeId.localeCompare(b.nodeId),
        );

      if (collisions.length === 0) return;
      let addedBlocker = false;
      for (const collision of collisions) {
        const otherRoot = branchRootFor(collision.nodeId);
        if (
          !otherRoot ||
          activeRoots.has(otherRoot) ||
          branchTop(otherRoot) < branchTop(rootId)
        ) {
          currentBlockers.push(collision.rect);
          addedBlocker = true;
          continue;
        }
        const branchRects = branchIds
          .map(rectFor)
          .filter((rect): rect is NodeRect => rect !== null);
        pushBranchBelow(otherRoot, branchRects, nextActiveRoots);
      }
      if (!addedBlocker) {
        const stillOverlaps = collisions.some(({ nodeId }) => {
          const rect = rectFor(nodeId);
          return (
            rect !== null &&
            branchIds.some((branchId) => {
              const branchRect = rectFor(branchId);
              return branchRect ? rectanglesOverlap(branchRect, rect) : false;
            })
          );
        });
        if (!stillOverlaps) return;
      }
    }
  };

  const initialRoots = Object.keys(positions)
    .filter((nodeId) => {
      const rect = rectFor(nodeId);
      return rect ? rectanglesOverlap(candidateRect, rect) : false;
    })
    .map(branchRootFor)
    .filter((rootId): rootId is NodeId => rootId !== null)
    .filter((rootId, index, roots) => roots.indexOf(rootId) === index)
    .sort(
      (a, b) =>
        branchTop(a) - branchTop(b) ||
        (positions[a]?.x ?? 0) - (positions[b]?.x ?? 0) ||
        a.localeCompare(b),
    );

  for (const rootId of initialRoots) {
    pushBranchBelow(rootId, [candidateRect], new Set());
  }
  return positions;
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
      point.x < other.x + otherSize.width + COLLISION_GAP_X &&
      point.x + candidateSize.width + COLLISION_GAP_X > other.x &&
      point.y < other.y + otherSize.height + COLLISION_GAP_Y &&
      point.y + candidateSize.height + COLLISION_GAP_Y > other.y
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

export function directionalChildPosition(
  parent: CanvasPoint,
  parentSize: NodeSize,
  childSize: NodeSize,
  direction: BranchDirection,
): CanvasPoint {
  const vector = directionVector(direction);
  const parentCenter = {
    x: parent.x + parentSize.width / 2,
    y: parent.y + parentSize.height / 2,
  };
  const horizontalClearance = parentSize.width / 2 + childSize.width / 2 + 80;
  const verticalClearance = parentSize.height / 2 + childSize.height / 2 + 58;
  const distance = Math.max(
    vector.x === 0 ? 0 : horizontalClearance / Math.abs(vector.x),
    vector.y === 0 ? 0 : verticalClearance / Math.abs(vector.y),
  );
  return {
    x: parentCenter.x + vector.x * distance - childSize.width / 2,
    y: parentCenter.y + vector.y * distance - childSize.height / 2,
  };
}

export function findAvailablePositionInDirection(
  preferred: CanvasPoint,
  direction: BranchDirection,
  positions: Record<NodeId, CanvasPoint>,
  sizes: Record<NodeId, NodeSize>,
  candidateSize: NodeSize,
  ignoredId?: NodeId,
): CanvasPoint {
  if (!overlapsAny(preferred, positions, sizes, candidateSize, ignoredId)) return preferred;
  const tangent = directionTangent(direction);
  const tangentUsesWidth = Math.abs(tangent.x) >= Math.abs(tangent.y);
  const step = (tangentUsesWidth ? candidateSize.width : candidateSize.height) + 24;
  const outward = directionVector(direction);
  for (let ring = 1; ring <= 80; ring += 1) {
    for (const sign of [1, -1]) {
      const candidate = {
        x: preferred.x + tangent.x * step * ring * sign,
        y: preferred.y + tangent.y * step * ring * sign,
      };
      if (!overlapsAny(candidate, positions, sizes, candidateSize, ignoredId)) return candidate;
    }
    const candidate = {
      x: preferred.x + outward.x * 28 * ring,
      y: preferred.y + outward.y * 28 * ring,
    };
    if (!overlapsAny(candidate, positions, sizes, candidateSize, ignoredId)) return candidate;
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
