import { useEffect, useMemo, useRef, useState } from "react";
import type { Document, Mode, Node, NodeId } from "./types";
import "./EditorView.scss";
import {
  computeLayout,
  NODE_HEIGHT,
  NODE_WIDTH,
  svgPathForEdge,
} from "./layout";
import type { NodePosition } from "./layout";

type Props = {
  doc: Document;
  mode: Mode;
  disabled: boolean;
  zoom: number;
  panGestureActive: boolean;
  highlightedNodeIds: Set<NodeId> | null;
  activeHighlightedNodeId: NodeId | null;
  jumpHints: Record<NodeId, string> | null;
  jumpPrefix: string;
  onSelectNode: (nodeId: NodeId) => void;
  onChangeText: (text: string) => void;
  onEnterCommit: () => void;
  onEsc: () => void;
};

type ExitingNode = { node: Node; pos: NodePosition };

type JumpHintState = {
  hint: string | null;
  isDimmed: boolean;
  isMatched: boolean;
};

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
  mode,
  disabled,
  zoom,
  panGestureActive,
  highlightedNodeIds,
  activeHighlightedNodeId,
  jumpHints,
  jumpPrefix,
  onSelectNode,
  onChangeText,
  onEnterCommit,
  onEsc,
}: Props) {
  const layout = useMemo(() => computeLayout(doc), [doc]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const pendingCompositionEnterRef = useRef(false);
  const pendingCompositionTextRef = useRef<string | null>(null);
  const compositionEnterTimerRef = useRef<number | null>(null);
  const prevNodesRef = useRef<Record<NodeId, Node> | null>(null);
  const prevPositionsRef = useRef<Record<NodeId, NodePosition> | null>(null);
  const [exitingNodes, setExitingNodes] = useState<Record<NodeId, ExitingNode>>({});

  const cursorPos = layout.positions[doc.cursorId];
  const cursorNode = doc.nodes[doc.cursorId];

  const clearCompositionEnterTimer = () => {
    if (compositionEnterTimerRef.current === null) return;
    window.clearTimeout(compositionEnterTimerRef.current);
    compositionEnterTimerRef.current = null;
  };

  const resetCompositionEnter = () => {
    pendingCompositionEnterRef.current = false;
    pendingCompositionTextRef.current = null;
    clearCompositionEnterTimer();
  };

  const commitPendingCompositionEnter = (text: string | null) => {
    if (!pendingCompositionEnterRef.current) return;

    pendingCompositionEnterRef.current = false;
    pendingCompositionTextRef.current = null;
    clearCompositionEnterTimer();
    if (text !== null) {
      onChangeText(text);
    }

    compositionEnterTimerRef.current = window.setTimeout(() => {
      compositionEnterTimerRef.current = null;
      onEnterCommit();
    }, 0);
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
    const root = canvasRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-node-id="${doc.cursorId}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [doc.cursorId]);

  useEffect(() => {
    const prevNodes = prevNodesRef.current;
    const prevPositions = prevPositionsRef.current;
    if (prevNodes && prevPositions) {
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
            if (!node || !pos) continue;
            next[id] = { node, pos };
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

    setExitingNodes((current) => {
      const next: Record<NodeId, ExitingNode> = {};
      for (const [id, entry] of Object.entries(current)) {
        if (!doc.nodes[id]) next[id] = entry;
      }
      return next;
    });
  }, [doc.nodes, layout.positions]);

  useEffect(() => {
    return () => {
      clearCompositionEnterTimer();
    };
  }, []);

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
      chainEdges.push(`${current.parentId}-${current.id}`);
      current = doc.nodes[current.parentId];
    }
    for (const key of chainEdges) set.add(key);

    for (const edge of edges) {
      if (edge.fromId === doc.cursorId || edge.toId === doc.cursorId) {
        set.add(`${edge.fromId}-${edge.toId}`);
      }
    }

    return set;
  }, [doc.cursorId, edges]);

  return (
    <div
      className="editorCanvasOuter"
      style={{ width: layout.contentWidth * zoom, height: layout.contentHeight * zoom }}
    >
      <div
        ref={canvasRef}
        className="editorCanvas"
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
            const fromPoint = {
              x: from.x + NODE_WIDTH,
              y: from.y + NODE_HEIGHT / 2,
            };
            const toPoint = { x: to.x, y: to.y + NODE_HEIGHT / 2 };
            const key = `${edge.fromId}-${edge.toId}`;
            const isHighlighted = highlightedEdgeKeys.has(key);
            return (
              <path
                key={key}
                d={svgPathForEdge(fromPoint, toPoint)}
                className={"edgePath" + (isHighlighted ? " edgePathSelected" : "")}
              />
            );
          })}
        </svg>

        {nodeEntries.map(({ node, pos }) => {
          const isCursor = node.id === doc.cursorId;
          const isMatch = highlightedNodeIds?.has(node.id) ?? false;
          const isActiveMatch = activeHighlightedNodeId === node.id;
          const jump = getJumpHintState(jumpHints, node.id, jumpPrefix);
          const hasNote = Boolean(node.note);
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              title={node.text}
              className={
                "node" +
                (node.color ? ` nodeColor-${node.color}` : "") +
                (isCursor ? " nodeSelected" : "") +
                (mode === "insert" && isCursor ? " nodeEditing" : "") +
                (isMatch ? " nodeMatch" : "") +
                (isActiveMatch ? " nodeMatchActive" : "") +
                (jump.isDimmed ? " nodeJumpDimmed" : "")
              }
              style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (disabled || mode === "insert" || panGestureActive) return;
                onSelectNode(node.id);
              }}
            >
              {jump.hint ? (
                <div className={"nodeJumpHint" + (jump.isMatched ? " nodeJumpHintMatched" : "")}>
                  {jump.hint}
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

        {Object.entries(exitingNodes).map(([id, { node, pos }]) => {
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
              style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
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
          <input
            ref={inputRef}
            className="nodeInput"
            value={cursorNode.text}
            onChange={(e) => onChangeText(e.currentTarget.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
              resetCompositionEnter();
            }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              commitPendingCompositionEnter(e.currentTarget.value);
            }}
            onBlur={() => {
              isComposingRef.current = false;
              resetCompositionEnter();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                resetCompositionEnter();
                onEsc();
                return;
              }

              if (e.key === "Enter") {
                const native = e.nativeEvent;
                const imeComposing =
                  isComposingRef.current || native.isComposing || native.keyCode === 229;
                if (imeComposing) {
                  // Let the IME receive Enter, then commit this edit when composition ends.
                  e.stopPropagation();
                  pendingCompositionEnterRef.current = true;
                  pendingCompositionTextRef.current = e.currentTarget.value;
                  clearCompositionEnterTimer();
                  compositionEnterTimerRef.current = window.setTimeout(() => {
                    compositionEnterTimerRef.current = null;
                    if (isComposingRef.current) return;
                    commitPendingCompositionEnter(pendingCompositionTextRef.current);
                  }, 0);
                  return;
                }

                resetCompositionEnter();
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
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
