import type { LayoutResult } from "../layout";
import type { NodeId } from "../types";

export type SpatialDirection = "left" | "down" | "up" | "right";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Candidate = {
  id: NodeId;
  primaryDistance: number;
  perpendicularDistance: number;
  euclideanDistance: number;
  angle: number;
  beam: boolean;
};

function rectFor(layout: LayoutResult, nodeId: NodeId): Rect | null {
  const position = layout.positions[nodeId];
  const size = layout.sizes[nodeId];
  if (!position || !size) return null;
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

function center(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function overlapsOnPerpendicularAxis(
  current: Rect,
  candidate: Rect,
  direction: SpatialDirection,
): boolean {
  if (direction === "left" || direction === "right") {
    return candidate.y < current.y + current.height && candidate.y + candidate.height > current.y;
  }
  return candidate.x < current.x + current.width && candidate.x + candidate.width > current.x;
}

function compareNumber(left: number, right: number): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareCandidates(left: Candidate, right: Candidate): number {
  if (left.beam !== right.beam) return left.beam ? -1 : 1;
  if (left.beam) {
    return (
      compareNumber(left.primaryDistance, right.primaryDistance) ||
      compareNumber(left.perpendicularDistance, right.perpendicularDistance) ||
      compareNumber(left.euclideanDistance, right.euclideanDistance) ||
      left.id.localeCompare(right.id)
    );
  }
  return (
    compareNumber(left.angle, right.angle) ||
    compareNumber(left.euclideanDistance, right.euclideanDistance) ||
    left.id.localeCompare(right.id)
  );
}

/**
 * Finds the closest visible node in a screen direction.
 * The layout already represents focus/collapse filtering, while its canvas
 * coordinates may still be outside the current viewport.
 */
export function findSpatialNeighbor(
  layout: LayoutResult,
  currentId: NodeId,
  direction: SpatialDirection,
): NodeId | null {
  const currentRect = rectFor(layout, currentId);
  if (!currentRect) return null;
  const currentCenter = center(currentRect);
  const candidates: Candidate[] = [];

  for (const candidateId of Object.keys(layout.positions)) {
    if (candidateId === currentId) continue;
    const candidateRect = rectFor(layout, candidateId);
    if (!candidateRect) continue;
    const candidateCenter = center(candidateRect);
    const dx = candidateCenter.x - currentCenter.x;
    const dy = candidateCenter.y - currentCenter.y;
    const primaryDelta =
      direction === "left"
        ? -dx
        : direction === "right"
          ? dx
          : direction === "up"
            ? -dy
            : dy;
    if (primaryDelta <= 0) continue;

    const perpendicularDistance =
      direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    candidates.push({
      id: candidateId,
      primaryDistance: primaryDelta,
      perpendicularDistance,
      euclideanDistance: Math.hypot(dx, dy),
      angle: Math.atan2(perpendicularDistance, primaryDelta),
      beam: overlapsOnPerpendicularAxis(currentRect, candidateRect, direction),
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort(compareCandidates);
  return candidates[0].id;
}
