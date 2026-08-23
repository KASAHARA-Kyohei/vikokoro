import type { CanvasPoint, Viewport } from "../types";
import type { NodeSize } from "../layout";

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ViewportSize = { width: number; height: number };

export type ViewportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function isUsableViewportSize(viewportSize: ViewportSize): boolean {
  return viewportSize.width > 0 && viewportSize.height > 0;
}

export function hasSavedViewport(viewport: Viewport): boolean {
  if (viewport.initialized !== undefined) return viewport.initialized;
  return viewport.x !== 0 || viewport.y !== 0 || viewport.zoom !== 1;
}

export function shouldResetViewportSession(
  previousSessionKey: string | null,
  nextSessionKey: string,
): boolean {
  return previousSessionKey !== null && previousSessionKey !== nextSessionKey;
}

export function shouldFollowCursor(
  initialViewPositioned: boolean,
  previousCursorId: string | null,
  nextCursorId: string,
): boolean {
  return (
    initialViewPositioned &&
    previousCursorId !== null &&
    previousCursorId !== nextCursorId
  );
}

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

export function computeInitialScrollForRoot(
  rootPoint: CanvasPoint,
  rootSize: NodeSize,
  viewportSize: ViewportSize,
  zoom: number,
): CanvasPoint {
  return {
    x: Math.max(
      0,
      (rootPoint.x + rootSize.width / 2) * zoom - viewportSize.width / 2,
    ),
    y: Math.max(
      0,
      (rootPoint.y + rootSize.height / 2) * zoom - viewportSize.height / 2,
    ),
  };
}

export function computeFitViewport(
  bounds: ViewportBounds,
  viewportSize: ViewportSize,
  currentZoom: number,
  padding = 64,
): Viewport {
  if (!isUsableViewportSize(viewportSize) || bounds.width <= 0 || bounds.height <= 0) {
    return { x: 0, y: 0, zoom: currentZoom, initialized: true };
  }
  const availableWidth = Math.max(1, viewportSize.width - padding * 2);
  const availableHeight = Math.max(1, viewportSize.height - padding * 2);
  const zoom = Math.min(2, Math.max(0.5, Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height,
  )));
  return {
    x: Math.max(0, (bounds.x + bounds.width / 2) * zoom - viewportSize.width / 2),
    y: Math.max(0, (bounds.y + bounds.height / 2) * zoom - viewportSize.height / 2),
    zoom,
    initialized: true,
  };
}
