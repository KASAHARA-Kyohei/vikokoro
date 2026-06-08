import type { CanvasPoint } from "../types";

type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function computeCenteredScrollFromRects(
  currentScroll: CanvasPoint,
  targetRect: Rect,
  viewportRect: Rect,
): CanvasPoint {
  return {
    x: Math.max(
      0,
      currentScroll.x +
        targetRect.left +
        targetRect.width / 2 -
        (viewportRect.left + viewportRect.width / 2),
    ),
    y: Math.max(
      0,
      currentScroll.y +
        targetRect.top +
        targetRect.height / 2 -
        (viewportRect.top + viewportRect.height / 2),
    ),
  };
}
