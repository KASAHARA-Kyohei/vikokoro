import { useEffect, useMemo, useRef, useState } from "react";
import type { Document, Mode, Node, NodeId } from "./types";
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
  onSelectNode: (nodeId: NodeId) => void;
  onChangeText: (text: string) => void;
  onEnterContinue: () => void;
  onEnterCommit: () => void;
  onEsc: () => void;
};

type ExitingNode = { node: Node; pos: NodePosition };

export function EditorView({
  doc,
  mode,
  disabled,
  zoom,
  panGestureActive,
  highlightedNodeIds,
  activeHighlightedNodeId,
  onSelectNode,
  onChangeText,
  onEnterContinue,
  onEnterCommit,
  onEsc,
}: Props) {
  const layout = useMemo(() => computeLayout(doc), [doc]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const didUseCompositionRef = useRef(false);
  const prevNodesRef = useRef<Record<NodeId, Node> | null>(null);
  const prevPositionsRef = useRef<Record<NodeId, NodePosition> | null>(null);
  const [exitingNodes, setExitingNodes] = useState<Record<NodeId, ExitingNode>>({});

  const cursorPos = layout.positions[doc.cursorId];
  const cursorNode = doc.nodes[doc.cursorId];

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
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              title={node.text}
              className={
                "node" +
                (isCursor ? " nodeSelected" : "") +
                (mode === "insert" && isCursor ? " nodeEditing" : "") +
                (isMatch ? " nodeMatch" : "") +
                (isActiveMatch ? " nodeMatchActive" : "")
              }
              style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (disabled || mode === "insert" || panGestureActive) return;
                onSelectNode(node.id);
              }}
            >
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
                (isCursor ? " nodeSelected" : "") +
                (mode === "insert" && isCursor ? " nodeEditing" : "")
              }
              style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
            >
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
              didUseCompositionRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onBlur={() => {
              isComposingRef.current = false;
              didUseCompositionRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onEsc();
                return;
              }

              if (e.key === "Enter") {
                if (isComposingRef.current) {
                  return;
                }

                const didUseComposition = didUseCompositionRef.current;
                didUseCompositionRef.current = false;
                e.preventDefault();
                e.stopPropagation();
                if (didUseComposition) {
                  onEnterContinue();
                } else {
                  onEnterCommit();
                }
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
