import { computeLayout } from "../../editor/layout";
import type { Document, NodeId } from "../../editor/types";

const JUMP_HINT_KEYS = [
  "f",
  "j",
  "d",
  "k",
  "s",
  "l",
  "a",
  "g",
  "h",
  "r",
  "u",
  "e",
  "i",
  "w",
  "o",
  "q",
  "p",
  "v",
  "m",
  "c",
  "n",
  "x",
  "b",
  "z",
  "y",
  "t",
] as const;

type JumpHintMap = Record<string, NodeId>;

export type JumpSession = {
  nodeToHint: Record<NodeId, string>;
  hintToNode: JumpHintMap;
  prefixes: Set<string>;
};

type ResolveJumpKeyParams = {
  session: JumpSession;
  prefix: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};

export type JumpKeyResolution =
  | { type: "cancel" }
  | { type: "keep" }
  | { type: "setPrefix"; prefix: string }
  | { type: "select"; nodeId: NodeId };

function buildJumpHints(count: number): string[] {
  if (count <= 0) return [];

  const base = JUMP_HINT_KEYS.length;
  let length = 1;
  let capacity = base;
  while (capacity < count) {
    length += 1;
    capacity *= base;
  }

  const hints: string[] = [];
  const append = (prefix: string, depth: number) => {
    if (hints.length >= count) return;
    if (depth === 0) {
      hints.push(prefix);
      return;
    }
    for (const key of JUMP_HINT_KEYS) {
      append(prefix + key, depth - 1);
      if (hints.length >= count) return;
    }
  };

  append("", length);
  return hints;
}

function normalizeJumpKey(key: string): string | null {
  if (key.length !== 1) return null;
  const normalized = key.toLowerCase();
  return (JUMP_HINT_KEYS as readonly string[]).includes(normalized) ? normalized : null;
}

export function buildJumpSession(doc: Document): JumpSession {
  const layout = computeLayout(doc);
  const cursorPos = layout.positions[doc.cursorId];

  const orderedNodeIds = (Object.keys(doc.nodes) as NodeId[])
    .filter((nodeId) => Boolean(layout.positions[nodeId]))
    .sort((a, b) => {
      const posA = layout.positions[a]!;
      const posB = layout.positions[b]!;

      const dxA = cursorPos ? posA.x - cursorPos.x : posA.x;
      const dyA = cursorPos ? posA.y - cursorPos.y : posA.y;
      const dxB = cursorPos ? posB.x - cursorPos.x : posB.x;
      const dyB = cursorPos ? posB.y - cursorPos.y : posB.y;
      const distA = dxA * dxA + dyA * dyA;
      const distB = dxB * dxB + dyB * dyB;

      if (distA !== distB) return distA - distB;
      if (posA.depth !== posB.depth) return posA.depth - posB.depth;
      if (posA.y !== posB.y) return posA.y - posB.y;
      if (posA.x !== posB.x) return posA.x - posB.x;
      return a.localeCompare(b);
    });

  const hints = buildJumpHints(orderedNodeIds.length);
  const nodeToHint: Record<NodeId, string> = {};
  const hintToNode: JumpHintMap = {};
  const prefixes = new Set<string>();

  for (let i = 0; i < orderedNodeIds.length; i += 1) {
    const nodeId = orderedNodeIds[i];
    const hint = hints[i];
    if (!hint) continue;
    nodeToHint[nodeId] = hint;
    hintToNode[hint] = nodeId;
    for (let j = 1; j < hint.length; j += 1) {
      prefixes.add(hint.slice(0, j));
    }
  }

  return { nodeToHint, hintToNode, prefixes };
}

export function resolveJumpKey({
  session,
  prefix,
  key,
  ctrlKey,
  metaKey,
  altKey,
}: ResolveJumpKeyParams): JumpKeyResolution {
  if (key === "Escape") {
    return { type: "cancel" };
  }

  if (key === "Backspace") {
    return { type: "setPrefix", prefix: prefix.slice(0, -1) };
  }

  if (ctrlKey || metaKey || altKey) {
    return { type: "keep" };
  }

  const normalized = normalizeJumpKey(key);
  if (!normalized) {
    return { type: "keep" };
  }

  const nextPrefix = prefix + normalized;
  const exactMatchNodeId = session.hintToNode[nextPrefix];
  if (exactMatchNodeId) {
    return { type: "select", nodeId: exactMatchNodeId };
  }
  if (session.prefixes.has(nextPrefix)) {
    return { type: "setPrefix", prefix: nextPrefix };
  }

  const restartMatchNodeId = session.hintToNode[normalized];
  if (restartMatchNodeId) {
    return { type: "select", nodeId: restartMatchNodeId };
  }
  if (session.prefixes.has(normalized)) {
    return { type: "setPrefix", prefix: normalized };
  }

  return { type: "setPrefix", prefix: "" };
}
