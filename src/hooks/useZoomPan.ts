import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../utils/number";
import type { Viewport } from "../editor/types";
import {
  computeFitViewport,
  hasSavedViewport,
  type ViewportBounds,
} from "../editor/domain/viewport";

type ViewState = { zoom: number };

type Params = {
  activeDocId: string;
  mode: "normal" | "insert";
  disabled: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  initialViewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
};

export function useZoomPan({
  activeDocId,
  mode,
  disabled,
  viewportRef,
  initialViewport,
  onViewportChange,
}: Params) {
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [viewByDocId, setViewByDocId] = useState<Record<string, ViewState>>({});

  const panStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const pendingZoomAnchorRef = useRef<{
    docId: string;
    worldX: number;
    worldY: number;
    mouseX: number;
    mouseY: number;
    zoom: number;
  } | null>(null);
  const scrollPersistTimerRef = useRef<number | null>(null);
  const restoringViewportRef = useRef(false);
  const zoom = (viewByDocId[activeDocId] ?? { zoom: 1 }).zoom;

  const clearScrollPersistTimer = useCallback(() => {
    if (scrollPersistTimerRef.current === null) return;
    window.clearTimeout(scrollPersistTimerRef.current);
    scrollPersistTimerRef.current = null;
  }, []);

  const persistCurrentViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    onViewportChange({
      x: viewport.scrollLeft,
      y: viewport.scrollTop,
      zoom,
      initialized: true,
    });
  }, [onViewportChange, viewportRef, zoom]);

  const onViewportScroll = useCallback(() => {
    if (restoringViewportRef.current) return;
    clearScrollPersistTimer();
    scrollPersistTimerRef.current = window.setTimeout(() => {
      scrollPersistTimerRef.current = null;
      persistCurrentViewport();
    }, 180);
  }, [clearScrollPersistTimer, persistCurrentViewport]);

  useEffect(() => {
    clearScrollPersistTimer();
    setViewByDocId((current) => {
      if (current[activeDocId]) return current;
      return { ...current, [activeDocId]: { zoom: initialViewport.zoom } };
    });
    window.requestAnimationFrame(() => {
      if (!hasSavedViewport(initialViewport)) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      restoringViewportRef.current = true;
      viewport.scrollLeft = initialViewport.x;
      viewport.scrollTop = initialViewport.y;
      window.requestAnimationFrame(() => {
        restoringViewportRef.current = false;
      });
    });
  // Restore only when switching documents; continuous viewport updates must not reset scroll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocId, clearScrollPersistTimer]);

  useEffect(() => clearScrollPersistTimer, [clearScrollPersistTimer]);

  useLayoutEffect(() => {
    const pending = pendingZoomAnchorRef.current;
    if (!pending) return;
    if (pending.docId !== activeDocId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollLeft = pending.worldX * pending.zoom - pending.mouseX;
    viewport.scrollTop = pending.worldY * pending.zoom - pending.mouseY;
    pendingZoomAnchorRef.current = null;
  }, [activeDocId, viewportRef, zoom]);

  useEffect(() => {
    if (!spaceDown && isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
  }, [isPanning, spaceDown]);

  useEffect(() => {
    if (!disabled) return;
    setSpaceDown(false);
    setIsPanning(false);
    panStartRef.current = null;
  }, [disabled]);

  useEffect(() => {
    if (mode !== "normal") {
      setSpaceDown(false);
      setIsPanning(false);
      panStartRef.current = null;
    }
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;
      if (mode !== "normal") return;
      if (event.code !== "Space") return;
      event.preventDefault();
      setSpaceDown(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpaceDown(false);
      }
    };

    const handleWindowBlur = () => {
      setSpaceDown(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [disabled, mode]);

  const viewportClassName = useMemo(() => {
    return (
      "editorViewport" +
      (spaceDown ? " editorViewportPannable" : "") +
      (isPanning ? " editorViewportPanning" : "")
    );
  }, [isPanning, spaceDown]);

  const panGestureActive = spaceDown || isPanning;

  const onViewportMouseDown = (event: React.MouseEvent) => {
    viewportRef.current?.focus();

    if (disabled) return;
    if (mode !== "normal") return;
    if (!spaceDown && event.button !== 1) return;
    if (event.button !== 0 && event.button !== 1) return;

    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    setIsPanning(true);
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const start = panStartRef.current;
      const currentViewport = viewportRef.current;
      if (!start || !currentViewport) return;
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      currentViewport.scrollLeft = start.scrollLeft - dx;
      currentViewport.scrollTop = start.scrollTop - dy;
    };

    const handleMouseUp = () => {
      const currentViewport = viewportRef.current;
      if (currentViewport) {
        persistCurrentViewport();
      }
      setIsPanning(false);
      panStartRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);
  };

  const onViewportWheel = (event: React.WheelEvent) => {
    if (disabled) return;
    if (!event.ctrlKey) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (viewport.scrollLeft + mouseX) / zoom;
    const worldY = (viewport.scrollTop + mouseY) / zoom;
    const factor = Math.exp(-event.deltaY * 0.002);
    const nextZoom = clamp(zoom * factor, 0.5, 2);

    pendingZoomAnchorRef.current = {
      docId: activeDocId,
      worldX,
      worldY,
      mouseX,
      mouseY,
      zoom: nextZoom,
    };
    onViewportChange({
      x: Math.max(0, worldX * nextZoom - mouseX),
      y: Math.max(0, worldY * nextZoom - mouseY),
      zoom: nextZoom,
      initialized: true,
    });

    setViewByDocId((current) => ({
      ...current,
      [activeDocId]: { zoom: nextZoom },
    }));
  };

  const setZoom = useCallback((nextZoom: number) => {
    const viewport = viewportRef.current;
    const clamped = clamp(nextZoom, 0.5, 2);
    setViewByDocId((current) => ({ ...current, [activeDocId]: { zoom: clamped } }));
    onViewportChange({
      x: viewport?.scrollLeft ?? initialViewport.x,
      y: viewport?.scrollTop ?? initialViewport.y,
      zoom: clamped,
      initialized: true,
    });
  }, [activeDocId, initialViewport.x, initialViewport.y, onViewportChange, viewportRef]);

  const applyViewport = useCallback((nextViewport: Viewport) => {
    setViewByDocId((current) => ({
      ...current,
      [activeDocId]: { zoom: nextViewport.zoom },
    }));
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = nextViewport.x;
      viewport.scrollTop = nextViewport.y;
    }
    onViewportChange(nextViewport);
  }, [activeDocId, onViewportChange, viewportRef]);

  const fitToWorldBounds = useCallback((bounds: ViewportBounds) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    applyViewport(computeFitViewport(
      bounds,
      { width: viewport.clientWidth, height: viewport.clientHeight },
      zoom,
    ));
  }, [applyViewport, viewportRef, zoom]);

  const centerOnWorldBounds = useCallback((bounds: ViewportBounds) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    applyViewport({
      x: Math.max(0, (bounds.x + bounds.width / 2) * zoom - viewport.clientWidth / 2),
      y: Math.max(0, (bounds.y + bounds.height / 2) * zoom - viewport.clientHeight / 2),
      zoom,
      initialized: true,
    });
  }, [applyViewport, viewportRef, zoom]);

  return {
    zoom,
    spaceDown,
    isPanning,
    panGestureActive,
    viewportClassName,
    onViewportMouseDown,
    onViewportWheel,
    onViewportScroll,
    zoomIn: () => setZoom(zoom * 1.15),
    zoomOut: () => setZoom(zoom / 1.15),
    resetZoom: () => setZoom(1),
    fitToWorldBounds,
    centerOnWorldBounds,
  };
}
