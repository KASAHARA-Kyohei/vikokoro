import type {
  ImproveDocumentState,
  ImproveOperation,
  ReviewFindingSeverity,
  ReviewResponse,
} from "./schema";
import type { AppLanguage } from "../../hooks/useAppPreferences";
import {
  getEmptyNodeLabel,
  getSearchPathPrefix,
  getSearchRootLabel,
} from "../../i18n/uiText";

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

export type LlmReviewResult = {
  summary: string;
  strengths: string[];
  findings: {
    severity: ReviewFindingSeverity;
    title: string;
    detail: string;
    suggestion: string;
    refs: {
      nodeId: string;
      title: string;
      path: string;
    }[];
  }[];
  nextActions: string[];
};

const REVIEW_SEVERITY_ORDER: Record<ReviewFindingSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function labelText(text: string, language: AppLanguage): string {
  const trimmed = text.trim();
  const label = trimmed === "" ? getEmptyNodeLabel(language) : trimmed;
  return language === "ja" ? `「${label}」` : `"${label}"`;
}

function summarizeNodeTitle(text: string, language: AppLanguage): string {
  const trimmed = text.trim();
  return trimmed === "" ? getEmptyNodeLabel(language) : trimmed;
}

function buildNodePath(
  document: ImproveDocumentState,
  nodeId: string,
  language: AppLanguage,
): string {
  const labels: string[] = [];
  let depth = 0;
  let current = document.nodes[nodeId];
  while (current) {
    labels.push(summarizeNodeTitle(current.text, language));
    if (!current.parentId) break;
    current = document.nodes[current.parentId];
    depth += 1;
    if (depth > 1000) break;
  }

  labels.reverse();
  const ancestors = labels.slice(0, -1);
  if (ancestors.length === 0) {
    return `${getSearchPathPrefix(language)}: ${getSearchRootLabel(language)}`;
  }
  if (ancestors.length > 3) {
    const tail = ancestors.slice(-3);
    return `${getSearchPathPrefix(language)}: ${["…", ...tail].join(" › ")}`;
  }
  return `${getSearchPathPrefix(language)}: ${ancestors.join(" › ")}`;
}

function getPreviewText(language: AppLanguage) {
  if (language === "ja") {
    return {
      parent: "親",
      root: "(root)",
      add: "追加",
      rename: "名前変更",
      color: "色変更",
      move: "移動",
      delete: "削除",
      clearColor: "解除",
      addSentence: (newLabel: string, parentLabel: string, index: number) =>
        `追加: ${newLabel} を ${parentLabel} の ${index + 1} 番目に追加`,
      renameSentence: (fromLabel: string, toLabel: string) => `名前変更: ${fromLabel} -> ${toLabel}`,
      colorSentence: (nodeLabel: string, color: string) => `色変更: ${nodeLabel} を ${color} に設定`,
      moveSentence: (nodeLabel: string, parentLabel: string, index: number) =>
        `移動: ${nodeLabel} を ${parentLabel} の ${index + 1} 番目へ`,
      deleteSentence: (nodeLabel: string) => `削除: ${nodeLabel}（子は繰り上げ）`,
    };
  }

  return {
    parent: "Parent",
    root: "(root)",
    add: "Add",
    rename: "Rename",
    color: "Color",
    move: "Move",
    delete: "Delete",
    clearColor: "clear",
    addSentence: (newLabel: string, parentLabel: string, index: number) =>
      `Add: place ${newLabel} under ${parentLabel} at position ${index + 1}`,
    renameSentence: (fromLabel: string, toLabel: string) => `Rename: ${fromLabel} -> ${toLabel}`,
    colorSentence: (nodeLabel: string, color: string) => `Color: set ${nodeLabel} to ${color}`,
    moveSentence: (nodeLabel: string, parentLabel: string, index: number) =>
      `Move: place ${nodeLabel} under ${parentLabel} at position ${index + 1}`,
    deleteSentence: (nodeLabel: string) => `Delete: remove ${nodeLabel} and promote its children`,
  };
}

export function buildImprovePreview(
  summary: string,
  warnings: string[],
  operations: ImproveOperation[],
  document: ImproveDocumentState,
  language: AppLanguage = "ja",
): LlmImprovePreview {
  const MAX_CHANGES = 12;
  const text = getPreviewText(language);
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
    if (nodeId) return labelText(simNodes[nodeId].text, language);
    if (tempRefToText[nodeRef] !== undefined) return labelText(tempRefToText[nodeRef], language);
    return `ID:${nodeRef}`;
  };

  const parentGroupLabel = (parentRef: string | undefined): string => {
    return parentRef
      ? `${text.parent}: ${labelNodeRef(parentRef)}`
      : `${text.parent}: ${text.root}`;
  };

  operations.forEach((op) => {
    if (op.op === "add") {
      counts.add += 1;
      const parentLabel = labelNodeRef(op.parentId);
      const newLabel = labelText(op.node.text, language);
      changes.push({
        groupLabel: parentGroupLabel(op.parentId),
        text: text.addSentence(newLabel, parentLabel, op.index),
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
      const toLabel = labelText(op.text, language);
      changes.push({
        groupLabel: parentGroupLabel(parentRef),
        text: text.renameSentence(fromLabel, toLabel),
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
        text: text.colorSentence(nodeLabel, op.color ?? text.clearColor),
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
        text: text.moveSentence(nodeLabel, parentLabel, op.index),
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
      text: text.deleteSentence(nodeLabel),
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

export function buildReviewResult(
  response: ReviewResponse,
  document: ImproveDocumentState,
  language: AppLanguage = "ja",
): LlmReviewResult {
  const findings = [...response.findings]
    .sort((a, b) => REVIEW_SEVERITY_ORDER[a.severity] - REVIEW_SEVERITY_ORDER[b.severity])
    .map((finding) => ({
      severity: finding.severity,
      title: finding.title,
      detail: finding.detail,
      suggestion: finding.suggestion,
      refs: finding.nodeRefs
        .map((nodeId) => {
          const node = document.nodes[nodeId];
          if (!node) return null;
          return {
            nodeId,
            title: summarizeNodeTitle(node.text, language),
            path: buildNodePath(document, nodeId, language),
          };
        })
        .filter((ref): ref is NonNullable<typeof ref> => ref !== null),
    }));

  return {
    summary: response.summary,
    strengths: response.strengths,
    findings,
    nextActions: response.nextActions,
  };
}
