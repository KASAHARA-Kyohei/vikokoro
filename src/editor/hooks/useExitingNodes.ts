import { useEffect, useRef, useState } from "react";
import type { NodePosition } from "../layout";
import type { Node, NodeId } from "../types";

type ExitingNode = { node: Node; pos: NodePosition };

export function useExitingNodes(docNodes: Record<NodeId, Node>, positions: Record<NodeId, NodePosition>) {
  const prevNodesRef = useRef<Record<NodeId, Node> | null>(null);
  const prevPositionsRef = useRef<Record<NodeId, NodePosition> | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const [exitingNodes, setExitingNodes] = useState<Record<NodeId, ExitingNode>>({});

  useEffect(() => {
    const prevNodes = prevNodesRef.current;
    const prevPositions = prevPositionsRef.current;
    if (prevNodes && prevPositions) {
      const currentIds = new Set(Object.keys(docNodes));
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
            const timeoutId = window.setTimeout(() => {
              setExitingNodes((latest) => {
                if (!latest[id]) return latest;
                const { [id]: _, ...rest } = latest;
                return rest;
              });
            }, 180);
            timeoutIdsRef.current.push(timeoutId);
          }
          return next;
        });
      }
    }

    prevNodesRef.current = docNodes;
    prevPositionsRef.current = positions;

    setExitingNodes((current) => {
      const next: Record<NodeId, ExitingNode> = {};
      for (const [id, entry] of Object.entries(current)) {
        if (!docNodes[id]) next[id] = entry;
      }
      return next;
    });
  }, [docNodes, positions]);

  useEffect(() => {
    return () => {
      for (const id of timeoutIdsRef.current) {
        window.clearTimeout(id);
      }
      timeoutIdsRef.current = [];
    };
  }, []);

  return exitingNodes;
}
