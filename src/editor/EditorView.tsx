import { useEffect, useMemo, useRef } from "react";
import type { Document, Mode, NodeId } from "./types";
import {
  computeLayout,
  NODE_HEIGHT,
  NODE_WIDTH,
  svgPathForEdge,
} from "./layout";
import { useExitingNodes } from "./hooks/useExitingNodes";
import { buildEdges, buildHighlightedEdgeKeys, buildNodeEntries } from "./selectors";

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
  onEnterContinue: () => void;
  onEnterCommit: () => void;
  onEsc: () => void;
};


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
  onEnterContinue,
  onEnterCommit,
  onEsc,
}: Props) {
  const layout = useMemo(() => computeLayout(doc), [doc]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const didUseCompositionRef = useRef(false);
  const compositionConfirmConsumedRef = useRef(false);
  const exitingNodes = useExitingNodes(doc.nodes, layout.positions);

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

  const nodeEntries = useMemo(() => buildNodeEntries(doc, layout.positions), [doc, layout.positions]);

  const edges = useMemo(() => buildEdges(doc), [doc]);

  const highlightedEdgeKeys = useMemo(() => buildHighlightedEdgeKeys(doc, edges), [doc, edges]);

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
              compositionConfirmConsumedRef.current = false;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onBlur={() => {
              isComposingRef.current = false;
              didUseCompositionRef.current = false;
              compositionConfirmConsumedRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onEsc();
                return;
              }

              if (e.key === "Enter") {
                const native = e.nativeEvent;
                const imeComposing =
                  isComposingRef.current || native.isComposing || native.keyCode === 229;
                if (imeComposing) {
                  // Windows IME can consume the first Enter for conversion commit.
                  compositionConfirmConsumedRef.current = true;
                  return;
                }

                const didUseComposition = didUseCompositionRef.current;
                const consumedByImeConfirm = compositionConfirmConsumedRef.current;
                didUseCompositionRef.current = false;
                compositionConfirmConsumedRef.current = false;
                e.preventDefault();
                e.stopPropagation();
                if (didUseComposition && !consumedByImeConfirm) {
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
