import type { ImproveDocumentState, ImproveOperation } from "./schema";

export type LlmImprovePreview = {
  summary: string;
  warnings: string[];
  operationCounts: {
    add: number;
    updateText: number;
    setColor: number;
    move: number;
    delete: number;
  };
  changes: {
    groupLabel: string;
    text: string;
    nodeRef?: string;
    parentRef?: string;
  }[];
  hiddenChangeCount: number;
};

export function buildImprovePreview(
  summary: string,
  warnings: string[],
  operations: ImproveOperation[],
  document: ImproveDocumentState,
): LlmImprovePreview {
  const MAX_CHANGES = 12;
  const counts = {
    add: 0,
    updateText: 0,
    setColor: 0,
    move: 0,
    delete: 0,
  };
  const changes: LlmImprovePreview["changes"] = [];

  const simNodes: Record<string, { text: string; parentId: string | null; childrenIds: string[] }> = {};
  Object.entries(document.nodes).forEach(([id, node]) => {
    simNodes[id] = {
      text: node.text,
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
    };
  });

  const tempRefToNodeId: Record<string, string> = {};
  const tempRefToText: Record<string, string> = {};

  const labelText = (text: string): string => {
    const trimmed = text.trim();
    return `「${trimmed === "" ? "(empty)" : trimmed}」`;
  };

  const parentRefOrUndefined = (parentId: string | null): string | undefined => {
    return parentId ?? undefined;
  };

  const resolveNodeId = (nodeRef: string): string | null => {
    if (simNodes[nodeRef]) return nodeRef;
    const mapped = tempRefToNodeId[nodeRef];
    if (mapped && simNodes[mapped]) return mapped;
    return null;
  };

  const labelNodeRef = (nodeRef: string): string => {
    const nodeId = resolveNodeId(nodeRef);
    if (nodeId) return labelText(simNodes[nodeId].text);
    if (tempRefToText[nodeRef] !== undefined) return labelText(tempRefToText[nodeRef]);
    return `ID:${nodeRef}`;
  };

  const parentGroupLabel = (parentRef: string | undefined): string => {
    return parentRef ? `親: ${labelNodeRef(parentRef)}` : "親: (root)";
  };

  operations.forEach((op) => {
    if (op.op === "add") {
      counts.add += 1;
      const parentLabel = labelNodeRef(op.parentId);
      const newLabel = labelText(op.node.text);
      changes.push({
        groupLabel: parentGroupLabel(op.parentId),
        text: `追加: ${newLabel} を ${parentLabel} の ${op.index + 1} 番目に追加`,
        nodeRef: op.node.tempId,
        parentRef: op.parentId,
      });

      const parentId = resolveNodeId(op.parentId);
      const simId = `@tmp:${op.node.tempId}`;
      tempRefToNodeId[op.node.tempId] = simId;
      tempRefToText[op.node.tempId] = op.node.text;
      simNodes[simId] = {
        text: op.node.text,
        parentId,
        childrenIds: [],
      };
      if (parentId && simNodes[parentId]) {
        const children = simNodes[parentId].childrenIds;
        const index = Math.max(0, Math.min(op.index, children.length));
        children.splice(index, 0, simId);
      }
      return;
    }

    if (op.op === "updateText") {
      counts.updateText += 1;
      const nodeId = resolveNodeId(op.nodeId);
      const parentRef = parentRefOrUndefined(nodeId ? simNodes[nodeId]?.parentId ?? null : null);
      const fromLabel = labelNodeRef(op.nodeId);
      const toLabel = labelText(op.text);
      changes.push({
        groupLabel: parentGroupLabel(parentRef),
        text: `名前変更: ${fromLabel} -> ${toLabel}`,
        nodeRef: op.nodeId,
        parentRef,
      });

      if (nodeId && simNodes[nodeId]) {
        simNodes[nodeId].text = op.text;
      } else if (tempRefToText[op.nodeId] !== undefined) {
        tempRefToText[op.nodeId] = op.text;
      }
      return;
    }

    if (op.op === "setColor") {
      counts.setColor += 1;
      const nodeId = resolveNodeId(op.nodeId);
      const parentRef = parentRefOrUndefined(nodeId ? simNodes[nodeId]?.parentId ?? null : null);
      const nodeLabel = labelNodeRef(op.nodeId);
      changes.push({
        groupLabel: parentGroupLabel(parentRef),
        text: `色変更: ${nodeLabel} を ${op.color ?? "clear"} に設定`,
        nodeRef: op.nodeId,
        parentRef,
      });
      return;
    }

    if (op.op === "move") {
      counts.move += 1;
      const nodeLabel = labelNodeRef(op.nodeId);
      const parentLabel = labelNodeRef(op.newParentId);
      changes.push({
        groupLabel: parentGroupLabel(op.newParentId),
        text: `移動: ${nodeLabel} を ${parentLabel} の ${op.index + 1} 番目へ`,
        nodeRef: op.nodeId,
        parentRef: op.newParentId,
      });

      const nodeId = resolveNodeId(op.nodeId);
      const newParentId = resolveNodeId(op.newParentId);
      if (nodeId && newParentId && simNodes[nodeId] && simNodes[newParentId]) {
        const currentParentId = simNodes[nodeId].parentId;
        if (currentParentId && simNodes[currentParentId]) {
          const siblings = simNodes[currentParentId].childrenIds;
          const currentIndex = siblings.indexOf(nodeId);
          if (currentIndex >= 0) siblings.splice(currentIndex, 1);
        }
        const targetSiblings = simNodes[newParentId].childrenIds;
        const targetIndex = Math.max(0, Math.min(op.index, targetSiblings.length));
        targetSiblings.splice(targetIndex, 0, nodeId);
        simNodes[nodeId].parentId = newParentId;
      }
      return;
    }

    counts.delete += 1;
    const deletingId = resolveNodeId(op.nodeId);
    const parentRef = parentRefOrUndefined(
      deletingId && simNodes[deletingId] ? simNodes[deletingId].parentId : null,
    );
    const nodeLabel = labelNodeRef(op.nodeId);
    changes.push({
      groupLabel: parentGroupLabel(parentRef),
      text: `削除: ${nodeLabel}（子は繰り上げ）`,
      nodeRef: op.nodeId,
      parentRef,
    });

    if (!deletingId || !simNodes[deletingId]) return;
    const deleting = simNodes[deletingId];
    if (deleting.parentId && simNodes[deleting.parentId]) {
      const parent = simNodes[deleting.parentId];
      const index = parent.childrenIds.indexOf(deletingId);
      if (index >= 0) {
        parent.childrenIds.splice(index, 1, ...deleting.childrenIds);
      }
      deleting.childrenIds.forEach((childId) => {
        if (simNodes[childId]) {
          simNodes[childId].parentId = deleting.parentId;
        }
      });
    }
    delete simNodes[deletingId];
  });

  const clippedChanges = changes.slice(0, MAX_CHANGES);
  const hiddenChangeCount = Math.max(0, changes.length - clippedChanges.length);
  return {
    summary,
    warnings,
    operationCounts: counts,
    changes: clippedChanges,
    hiddenChangeCount,
  };
}
