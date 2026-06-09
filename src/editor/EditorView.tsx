import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ANCHOR_SIDES, makeEdgeKey } from "./domain/edgeAnchors";
import {
  createEditorEnterState,
  transitionEditorEnter,
} from "./domain/editorEnter";
import type { EditorEnterEvent } from "./domain/editorEnter";
import { collectSubtreeNodeIds, computeSnapAdjustment, moveNodePositions } from "./domain/freeLayout";
import { computeCenteredScrollFromRects } from "./domain/viewport";
import type { AnchorSide, CanvasPoint, DocumentState, Mode, Node, NodeId } from "./types";
import "./EditorView.scss";
import {
  computeLayout,
  getEdgeEndpoints,
  svgPathForEdge,
} from "./layout";
import type { NodePosition, NodeSize } from "./layout";

type Props = {
  doc: DocumentState;
  sourceDoc: DocumentState;
  mode: Mode;
  disabled: boolean;
  zoom: number;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  panGestureActive: boolean;
  highlightedNodeIds: Set<NodeId> | null;
  activeHighlightedNodeId: NodeId | null;
  jumpHints: Record<NodeId, string> | null;
  jumpPrefix: string;
  collapsibleNodeIds: Set<NodeId>;
  collapsedNodeIds: Set<NodeId>;
  hiddenDescendantCounts: Record<NodeId, number>;
  selectedNodeIds: Set<NodeId>;
  selectedEdgeKey: string | null;
  onSelectNode: (nodeId: NodeId) => void;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
  onSelectEdge: (edgeKey: string) => void;
  onChangeEdgeAnchor: (
    edgeKey: string,
    endpoint: "from" | "to",
    side: AnchorSide,
  ) => void;
  onResetEdgeAnchors: (edgeKey: string) => void;
  onMoveNodes: (nodeIds: NodeId[], dx: number, dy: number) => void;
  onCreateChildAt: (point: CanvasPoint) => void;
  onToggleCollapse: (nodeId: NodeId) => void;
  onChangeText: (text: string) => void;
  onEnterCommit: () => void;
  onEsc: () => void;
};

type ExitingNode = { node: Node; pos: NodePosition; size: NodeSize };

type JumpHintState = {
  hint: string | null;
  isDimmed: boolean;
  isMatched: boolean;
};

type DragPreview = {
  nodeIds: NodeId[];
  dx: number;
  dy: number;
  guides: Array<{ axis: "x" | "y"; value: number }>;
};

type SelectionRect = { x: number; y: number; width: number; height: number };

function getJumpHintState(
  jumpHints: Record<NodeId, string> | null,
  nodeId: NodeId,
  jumpPrefix: string,
): JumpHintState {
  const hint = jumpHints?.[nodeId] ?? null;
  if (!hint) return { hint: null, isDimmed: false, isMatched: false };
  if (jumpPrefix.length === 0) return { hint, isDimmed: false, isMatched: false };

  const isMatched = hint.startsWith(jumpPrefix);
  return { hint, isDimmed: !isMatched, isMatched };
}

export function EditorView({
  doc,
  sourceDoc,
  mode,
  disabled,
  zoom,
  viewportRef,
  panGestureActive,
  highlightedNodeIds,
  activeHighlightedNodeId,
  jumpHints,
  jumpPrefix,
  collapsibleNodeIds,
  collapsedNodeIds,
  hiddenDescendantCounts,
  selectedNodeIds,
  selectedEdgeKey,
  onSelectNode,
  onSelectionChange,
  onSelectEdge,
  onChangeEdgeAnchor,
  onResetEdgeAnchors,
  onMoveNodes,
  onCreateChildAt,
  onToggleCollapse,
  onChangeText,
  onEnterCommit,
  onEsc,
}: Props) {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const previewDoc = useMemo<DocumentState>(() => {
    if (!dragPreview) return doc;
    return {
      ...doc,
      nodePositions: moveNodePositions(
        doc.nodePositions,
        dragPreview.nodeIds,
        dragPreview.dx,
        dragPreview.dy,
      ),
    };
  }, [doc, dragPreview]);
  const layout = useMemo(() => computeLayout(previewDoc), [previewDoc]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editorEnterStateRef = useRef(createEditorEnterState());
  const prevNodesRef = useRef<Record<NodeId, Node> | null>(null);
  const prevPositionsRef = useRef<Record<NodeId, NodePosition> | null>(null);
  const prevSizesRef = useRef<Record<NodeId, NodeSize> | null>(null);
  const initialViewPositionedRef = useRef(false);
  const initialCursorIdRef = useRef<NodeId | null>(null);
  const initialCenterFrameRef = useRef<number | null>(null);
  const [exitingNodes, setExitingNodes] = useState<Record<NodeId, ExitingNode>>({});
  const interactionDisabled = disabled || mode === "insert" || panGestureActive;

  const cursorPos = layout.positions[doc.cursorId];
  const cursorNode = doc.nodes[doc.cursorId];

  useLayoutEffect(() => {
    if (initialViewPositionedRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport || !layout.positions[doc.rootId]) return;
    initialCursorIdRef.current = doc.cursorId;

    const centerRoot = () => {
      const rootElement = [
        ...(canvasRef.current?.querySelectorAll<HTMLElement>("[data-node-id]") ?? []),
      ].find((element) => element.dataset.nodeId === doc.rootId);
      if (!rootElement) return;
      const viewportRect = viewport.getBoundingClientRect();
      const rootRect = rootElement.getBoundingClientRect();
      const scroll = computeCenteredScrollFromRects(
        { x: viewport.scrollLeft, y: viewport.scrollTop },
        {
          left: rootRect.left,
          top: rootRect.top,
          width: rootRect.width,
          height: rootRect.height,
        },
        {
          left: viewportRect.left,
          top: viewportRect.top,
          width: viewportRect.width,
          height: viewportRect.height,
        },
      );
      viewport.scrollLeft = scroll.x;
      viewport.scrollTop = scroll.y;
    };

    centerRoot();
    initialCenterFrameRef.current = requestAnimationFrame(() => {
      centerRoot();
      initialCenterFrameRef.current = requestAnimationFrame(() => {
        centerRoot();
        initialCenterFrameRef.current = null;
        initialViewPositionedRef.current = true;
      });
    });

    return () => {
      if (initialCenterFrameRef.current !== null) {
        cancelAnimationFrame(initialCenterFrameRef.current);
        initialCenterFrameRef.current = null;
      }
    };
  }, [doc.cursorId, doc.rootId, layout.positions, viewportRef, zoom]);

  const applyEditorEnterEvent = (event: EditorEnterEvent) => {
    const result = transitionEditorEnter(editorEnterStateRef.current, event);
    editorEnterStateRef.current = result.state;
    return result.decision;
  };

  useEffect(() => {
    if (disabled) return;
    if (mode !== "insert") return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [disabled, mode, doc.cursorId]);

  useEffect(() => {
    if (doc.cursorId === initialCursorIdRef.current) return;
    initialCursorIdRef.current = null;
    const root = canvasRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-node-id="${doc.cursorId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [doc.cursorId]);

  useEffect(() => {
    const prevNodes = prevNodesRef.current;
    const prevPositions = prevPositionsRef.current;
    const prevSizes = prevSizesRef.current;
    if (prevNodes && prevPositions && prevSizes) {
      const currentIds = new Set(Object.keys(doc.nodes));
      const removed: NodeId[] = [];
      for (const id of Object.keys(prevNodes)) {
        if (!currentIds.has(id)) removed.push(id);
      }

      if (removed.length > 0) {
        setExitingNodes((current) => {
          const next: Record<NodeId, ExitingNode> = { ...current };
          for (const id of removed) {
            const node = prevNodes[id];
            const pos = prevPositions[id];
            const size = prevSizes[id];
            if (!node || !pos || !size) continue;
            next[id] = { node, pos, size };
            window.setTimeout(() => {
              setExitingNodes((latest) => {
                if (!latest[id]) return latest;
                const { [id]: _, ...rest } = latest;
                return rest;
              });
            }, 180);
          }
          return next;
        });
      }
    }

    prevNodesRef.current = doc.nodes;
    prevPositionsRef.current = layout.positions;
    prevSizesRef.current = layout.sizes;

    setExitingNodes((current) => {
      const next: Record<NodeId, ExitingNode> = {};
      for (const [id, entry] of Object.entries(current)) {
        if (!doc.nodes[id]) next[id] = entry;
      }
      return next;
    });
  }, [doc.nodes, layout.positions, layout.sizes]);

  const nodeEntries = useMemo(() => {
    const entries: { node: Node; pos: NodePosition | undefined }[] = Object.values(doc.nodes).map(
      (node) => ({ node, pos: layout.positions[node.id] }),
    );
    return entries
      .filter((entry): entry is { node: Node; pos: NodePosition } => entry.pos !== undefined)
      .sort((a, b) => {
        if (a.pos.depth !== b.pos.depth) return a.pos.depth - b.pos.depth;
        return a.pos.y - b.pos.y;
      });
  }, [doc.nodes, layout.positions]);

  const edges = useMemo(() => {
    const list: { fromId: NodeId; toId: NodeId }[] = [];
    for (const node of Object.values(doc.nodes)) {
      for (const childId of node.childrenIds) {
        list.push({ fromId: node.id, toId: childId });
      }
    }
    return list;
  }, [doc.nodes]);

  const highlightedEdgeKeys = useMemo(() => {
    const set = new Set<string>();

    const cursor = doc.nodes[doc.cursorId];
    if (!cursor) return set;

    const chainEdges: string[] = [];
    let current: Node | undefined = cursor;
    while (current?.parentId) {
      chainEdges.push(makeEdgeKey(current.parentId, current.id));
      current = doc.nodes[current.parentId];
    }
    for (const key of chainEdges) set.add(key);

    for (const edge of edges) {
      if (edge.fromId === doc.cursorId || edge.toId === doc.cursorId) {
        set.add(makeEdgeKey(edge.fromId, edge.toId));
      }
    }

    return set;
  }, [doc.cursorId, edges]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeKey) return null;
    return edges.find((edge) => makeEdgeKey(edge.fromId, edge.toId) === selectedEdgeKey) ?? null;
  }, [edges, selectedEdgeKey]);

  const selectedEdgeToolbar = useMemo(() => {
    if (!selectedEdge || !selectedEdgeKey) return null;
    if (!doc.edgeAnchors[selectedEdgeKey]) return null;
    const from = layout.positions[selectedEdge.fromId];
    const to = layout.positions[selectedEdge.toId];
    if (!from || !to) return null;
    const endpoints = getEdgeEndpoints(
      from,
      to,
      doc.edgeAnchors[selectedEdgeKey],
      layout.sizes[selectedEdge.fromId],
      layout.sizes[selectedEdge.toId],
    );
    return {
      x: (endpoints.from.x + endpoints.to.x) / 2,
      y: (endpoints.from.y + endpoints.to.y) / 2,
    };
  }, [doc.edgeAnchors, layout.positions, layout.sizes, selectedEdge, selectedEdgeKey]);

  const clientToCanvas = (clientX: number, clientY: number): CanvasPoint | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  };

  const beginNodeInteraction = (event: React.MouseEvent, nodeId: NodeId) => {
    if (interactionDisabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const start = { x: event.clientX, y: event.clientY };
    const moveIds = event.shiftKey
      ? collectSubtreeNodeIds(sourceDoc, nodeId)
      : selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1
        ? [...selectedNodeIds]
        : [nodeId];
    let moved = false;
    let latestDx = 0;
    let latestDy = 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rawDx = (moveEvent.clientX - start.x) / zoom;
      const rawDy = (moveEvent.clientY - start.y) / zoom;
      if (!moved && Math.hypot(rawDx, rawDy) < 4 / zoom) return;
      moved = true;
      const movingSet = new Set(moveIds);
      const movingNodes = moveIds
        .map((id) => {
          const point = sourceDoc.nodePositions[id];
          const size = layout.sizes[id];
          if (!point || !size) return null;
          return {
            x: point.x + rawDx,
            y: point.y + rawDy,
            width: size.width,
            height: size.height,
          };
        })
        .filter((node): node is CanvasPoint & NodeSize => Boolean(node));
      const stationaryNodes = Object.entries(doc.nodePositions)
        .filter(([id]) => !movingSet.has(id))
        .map(([id, point]) => {
          const size = layout.sizes[id];
          if (!size) return null;
          return { ...point, ...size };
        })
        .filter((node): node is CanvasPoint & NodeSize => Boolean(node));
      const snap = computeSnapAdjustment(movingNodes, stationaryNodes, 6 / zoom);
      latestDx = rawDx + snap.dx;
      latestDy = rawDy + snap.dy;
      setDragPreview({
        nodeIds: moveIds,
        dx: latestDx,
        dy: latestDy,
        guides: snap.guides,
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setDragPreview(null);
      if (moved) {
        onSelectionChange(new Set(moveIds));
        onSelectNode(nodeId);
        onMoveNodes(moveIds, latestDx, latestDy);
        return;
      }
      if (event.shiftKey) {
        const next = new Set(selectedNodeIds);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        onSelectionChange(next);
      } else {
        onSelectionChange(new Set([nodeId]));
      }
      onSelectNode(nodeId);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);
  };

  const beginMarqueeSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || interactionDisabled || event.button !== 0) return;
    const start = clientToCanvas(event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    const baseSelection = event.shiftKey ? new Set(selectedNodeIds) : new Set<NodeId>();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const current = clientToCanvas(moveEvent.clientX, moveEvent.clientY);
      if (!current) return;
      const rect = {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      };
      setSelectionRect(rect);
      const next = new Set(baseSelection);
      for (const [id, pos] of Object.entries(layout.positions)) {
        const size = layout.sizes[id];
        if (!size) continue;
        if (
          pos.x < rect.x + rect.width &&
          pos.x + size.width > rect.x &&
          pos.y < rect.y + rect.height &&
          pos.y + size.height > rect.y
        ) {
          next.add(id);
        }
      }
      onSelectionChange(next);
    };
    const handleMouseUp = () => {
      setSelectionRect(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="editorCanvasOuter"
      style={{ width: layout.contentWidth * zoom, height: layout.contentHeight * zoom }}
    >
      <div
        ref={canvasRef}
        className="editorCanvas"
        onMouseDown={beginMarqueeSelection}
        onDoubleClick={(event) => {
          if (event.target !== event.currentTarget || interactionDisabled) return;
          const point = clientToCanvas(event.clientX, event.clientY);
          if (!point) return;
          event.preventDefault();
          onCreateChildAt({
            x: point.x - layout.offset.x,
            y: point.y - layout.offset.y,
          });
        }}
        style={{
          width: layout.contentWidth,
          height: layout.contentHeight,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        <svg
          className="editorLines"
          width={layout.contentWidth}
          height={layout.contentHeight}
        >
          {edges.map((edge) => {
            const from = layout.positions[edge.fromId];
            const to = layout.positions[edge.toId];
            if (!from || !to) return null;
            const key = makeEdgeKey(edge.fromId, edge.toId);
            const endpoints = getEdgeEndpoints(
              from,
              to,
              doc.edgeAnchors[key],
              layout.sizes[edge.fromId],
              layout.sizes[edge.toId],
            );
            const isHighlighted = highlightedEdgeKeys.has(key);
            const isSelected = selectedEdgeKey === key;
            const path = svgPathForEdge(
              endpoints.from,
              endpoints.to,
              endpoints.fromSide,
              endpoints.toSide,
            );
            return (
              <g key={key}>
                <path
                  d={path}
                  className={
                    "edgePath" +
                    (isHighlighted ? " edgePathHighlighted" : "") +
                    (isSelected ? " edgePathSelected" : "")
                  }
                />
                <path
                  d={path}
                  className="edgeHitPath"
                  onMouseDown={(event) => {
                    if (interactionDisabled || event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectEdge(key);
                  }}
                />
              </g>
            );
          })}
          {dragPreview?.guides.map((guide, index) =>
            guide.axis === "x" ? (
              <line
                key={`guide-x-${index}`}
                className="alignmentGuide"
                x1={guide.value + layout.offset.x}
                x2={guide.value + layout.offset.x}
                y1={0}
                y2={layout.contentHeight}
              />
            ) : (
              <line
                key={`guide-y-${index}`}
                className="alignmentGuide"
                x1={0}
                x2={layout.contentWidth}
                y1={guide.value + layout.offset.y}
                y2={guide.value + layout.offset.y}
              />
            ),
          )}
        </svg>
        {selectedEdgeKey && selectedEdgeToolbar ? (
          <button
            type="button"
            className="connectorAutoButton"
            style={{ left: selectedEdgeToolbar.x, top: selectedEdgeToolbar.y }}
            title="Reset connector anchors to auto"
            onMouseDown={(event) => {
              if (interactionDisabled) return;
              event.preventDefault();
              event.stopPropagation();
              onResetEdgeAnchors(selectedEdgeKey);
            }}
          >
            Auto
          </button>
        ) : null}

        {nodeEntries.map(({ node, pos }) => {
          const size = layout.sizes[node.id];
          if (!size) return null;
          const isCursor = node.id === doc.cursorId;
          const isMatch = highlightedNodeIds?.has(node.id) ?? false;
          const isActiveMatch = activeHighlightedNodeId === node.id;
          const jump = getJumpHintState(jumpHints, node.id, jumpPrefix);
          const hasNote = Boolean(node.note);
          const isCollapsible = collapsibleNodeIds.has(node.id);
          const isCollapsed = collapsedNodeIds.has(node.id);
          const hiddenCount = hiddenDescendantCounts[node.id] ?? 0;
          const isMultiSelected = selectedNodeIds.has(node.id);
          const selectedEdgeEndpoint =
            selectedEdge?.fromId === node.id
              ? "from"
              : selectedEdge?.toId === node.id
                ? "to"
                : null;
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              title={node.text}
              className={
                "node" +
                (node.color ? ` nodeColor-${node.color}` : "") +
                (isCursor ? " nodeSelected" : "") +
                (isMultiSelected ? " nodeMultiSelected" : "") +
                (dragPreview?.nodeIds.includes(node.id) ? " nodeDragging" : "") +
                (mode === "insert" && isCursor ? " nodeEditing" : "") +
                (isMatch ? " nodeMatch" : "") +
                (isActiveMatch ? " nodeMatchActive" : "") +
                (jump.isDimmed ? " nodeJumpDimmed" : "")
              }
              style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
              onMouseDown={(event) => beginNodeInteraction(event, node.id)}
            >
              {jump.hint ? (
                <div className={"nodeJumpHint" + (jump.isMatched ? " nodeJumpHintMatched" : "")}>
                  {jump.hint}
                </div>
              ) : null}
              {isCollapsible ? (
                <button
                  type="button"
                  className={
                    "nodeFoldButton" + (isCollapsed ? " nodeFoldButtonCollapsed" : "")
                  }
                  aria-label={isCollapsed ? "Expand branch" : "Collapse branch"}
                  title={isCollapsed ? "Expand branch (zo)" : "Collapse branch (zc)"}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (disabled || mode === "insert" || panGestureActive) return;
                    onToggleCollapse(node.id);
                  }}
                >
                  {isCollapsed ? hiddenCount : "−"}
                </button>
              ) : null}
              {selectedEdgeKey && selectedEdgeEndpoint ? (
                <div className="connectorHandles" aria-hidden="true">
                  {ANCHOR_SIDES.map((side) => {
                    const isActive =
                      doc.edgeAnchors[selectedEdgeKey]?.[selectedEdgeEndpoint] === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        className={
                          `connectorHandle connectorHandle-${side}` +
                          (isActive ? " connectorHandleActive" : "")
                        }
                        title={`${selectedEdgeEndpoint === "from" ? "Parent" : "Child"} ${side}`}
                        onMouseDown={(event) => {
                          if (interactionDisabled) return;
                          event.preventDefault();
                          event.stopPropagation();
                          onChangeEdgeAnchor(selectedEdgeKey, selectedEdgeEndpoint, side);
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
              {hasNote ? (
                <div className="nodeNoteBadge" aria-hidden="true">
                  <svg
                    className="nodeNoteBadgeIcon"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 3.5H11.25C12.2165 3.5 13 4.2835 13 5.25V11.5C13 12.4665 12.2165 13.25 11.25 13.25H5.25C4.2835 13.25 3.5 12.4665 3.5 11.5V5C3.5 4.17157 4.17157 3.5 5 3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 2.75V4.25"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.5 2.75V4.25"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M5.75 7H10.75"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M5.75 9.5H9.25"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              ) : null}
              <div className="nodeText">{node.text || " "}</div>
            </div>
          );
        })}

        {selectionRect ? (
          <div
            className="selectionMarquee"
            style={{
              left: selectionRect.x,
              top: selectionRect.y,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />
        ) : null}

        {Object.entries(exitingNodes).map(([id, { node, pos, size }]) => {
          const isCursor = id === doc.cursorId;
          return (
            <div
              key={`exit-${id}`}
              title={node.text}
              className={
                "node nodeExiting" +
                (node.color ? ` nodeColor-${node.color}` : "") +
                (isCursor ? " nodeSelected" : "") +
                (mode === "insert" && isCursor ? " nodeEditing" : "")
              }
              style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
            >
              {node.note ? (
                <div className="nodeNoteBadge" aria-hidden="true">
                  <svg
                    className="nodeNoteBadgeIcon"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 3.5H11.25C12.2165 3.5 13 4.2835 13 5.25V11.5C13 12.4665 12.2165 13.25 11.25 13.25H5.25C4.2835 13.25 3.5 12.4665 3.5 11.5V5C3.5 4.17157 4.17157 3.5 5 3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 2.75V4.25"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.5 2.75V4.25"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M5.75 7H10.75"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                    <path
                      d="M5.75 9.5H9.25"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              ) : null}
              <div className="nodeText">{node.text || " "}</div>
            </div>
          );
        })}

        {!disabled && mode === "insert" && cursorPos && cursorNode ? (
          <textarea
            ref={inputRef}
            className="nodeInput"
            rows={1}
            value={cursorNode.text}
            onChange={(e) => onChangeText(e.currentTarget.value)}
            onCompositionStart={() => {
              applyEditorEnterEvent({ type: "compositionStart" });
            }}
            onCompositionEnd={(e) => {
              onChangeText(e.currentTarget.value);
              applyEditorEnterEvent({
                type: "compositionEnd",
                timeStamp: e.timeStamp,
              });
            }}
            onBlur={() => {
              applyEditorEnterEvent({ type: "reset" });
            }}
            onKeyUp={(e) => {
              if (e.key !== "Enter") return;
              applyEditorEnterEvent({ type: "enterKeyUp" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                applyEditorEnterEvent({ type: "reset" });
                onEsc();
                return;
              }

              if (e.key === "Enter") {
                const native = e.nativeEvent;
                const decision = applyEditorEnterEvent({
                  type: "enterKeyDown",
                  timeStamp: e.timeStamp,
                  shiftKey: e.shiftKey,
                  nativeIsComposing: native.isComposing,
                  keyCode: native.keyCode,
                  repeat: e.repeat,
                });
                if (decision === "passToIme") {
                  e.stopPropagation();
                  return;
                }

                if (decision === "ignoreEnter") {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }

                if (decision === "lineBreak") {
                  e.stopPropagation();
                  return;
                }

                e.preventDefault();
                e.stopPropagation();
                onEnterCommit();
                return;
              }

              if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: layout.sizes[cursorNode.id]?.width,
              height: layout.sizes[cursorNode.id]?.height,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
