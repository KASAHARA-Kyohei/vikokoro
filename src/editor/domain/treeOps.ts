import type { BranchDirection, Document, Node, NodeId } from "../types";
import { getNodeSize, getNodeSizes } from "../layout";
import {
  collectSubtreeNodeIds,
  directionalChildPosition,
  findAvailablePositionInDirection,
  moveNodePositions,
} from "./freeLayout";
import {
  inferBranchDirection,
  nextBranchTone,
  preferredChildDirection,
} from "./branchDirections";
import { generateId } from "./id";

export function moveCursor(
  doc: Document,
  direction: "parent" | "child" | "nextSibling" | "prevSibling",
): Document {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return doc;

  if (direction === "parent") {
    if (!cursor.parentId) return doc;
    return { ...doc, cursorId: cursor.parentId };
  }

  if (direction === "child") {
    const childId = cursor.childrenIds[0];
    if (!childId) return doc;
    return { ...doc, cursorId: childId };
  }

  const parentId = cursor.parentId;
  if (!parentId) return doc;
  const parent = doc.nodes[parentId];
  if (!parent) return doc;
  const index = parent.childrenIds.indexOf(cursor.id);
  if (index === -1) return doc;

  if (direction === "nextSibling") {
    const nextId = parent.childrenIds[index + 1];
    if (!nextId) return doc;
    return { ...doc, cursorId: nextId };
  }

  const prevId = parent.childrenIds[index - 1];
  if (!prevId) return doc;
  return { ...doc, cursorId: prevId };
}

export function swapSibling(doc: Document, direction: "up" | "down"): Document {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor?.parentId) return doc;
  const parent = doc.nodes[cursor.parentId];
  if (!parent) return doc;
  const index = parent.childrenIds.indexOf(cursor.id);
  if (index === -1) return doc;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= parent.childrenIds.length) return doc;

  const nextChildren = [...parent.childrenIds];
  const otherId = nextChildren[swapWith];
  const tmp = nextChildren[index];
  nextChildren[index] = nextChildren[swapWith];
  nextChildren[swapWith] = tmp;

  const cursorPoint = doc.nodePositions[cursor.id];
  const otherPoint = doc.nodePositions[otherId];
  let nodePositions = doc.nodePositions;
  if (cursorPoint && otherPoint) {
    const dx = otherPoint.x - cursorPoint.x;
    const dy = otherPoint.y - cursorPoint.y;
    nodePositions = moveNodePositions(
      nodePositions,
      collectSubtreeNodeIds(doc, cursor.id),
      dx,
      dy,
    );
    nodePositions = moveNodePositions(
      nodePositions,
      collectSubtreeNodeIds(doc, otherId),
      -dx,
      -dy,
    );
  }

  return {
    ...doc,
    nodePositions,
    nodes: {
      ...doc.nodes,
      [parent.id]: { ...parent, childrenIds: nextChildren },
    },
  };
}

export function reparentNode(doc: Document, direction: "left" | "right"): Document {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor || !cursor.parentId) return doc;

  const parent = doc.nodes[cursor.parentId];
  if (!parent) return doc;
  const cursorIndex = parent.childrenIds.indexOf(cursor.id);
  if (cursorIndex === -1) return doc;

  if (direction === "right") {
    if (cursorIndex === 0) return doc;
    const prevSiblingId = parent.childrenIds[cursorIndex - 1];
    const prevSibling = doc.nodes[prevSiblingId];
    if (!prevSibling) return doc;

    const nextParentChildren = [...parent.childrenIds];
    nextParentChildren.splice(cursorIndex, 1);
    const nextPrevSiblingChildren = [...prevSibling.childrenIds, cursor.id];
    const sizes = getNodeSizes(doc.nodes);
    const branchDirection = inferBranchDirection(
      doc.nodePositions?.[prevSibling.id] ?? { x: 0, y: 0 },
      doc.nodePositions?.[cursor.id] ?? { x: 0, y: 0 },
      sizes[prevSibling.id],
      sizes[cursor.id],
      doc.branchDirections?.[cursor.id] ?? "e",
    );

    return {
      ...doc,
      branchDirections: { ...doc.branchDirections, [cursor.id]: branchDirection },
      nodes: {
        ...doc.nodes,
        [cursor.id]: { ...cursor, parentId: prevSibling.id, branchTone: undefined },
        [parent.id]: { ...parent, childrenIds: nextParentChildren },
        [prevSibling.id]: { ...prevSibling, childrenIds: nextPrevSiblingChildren },
      },
    };
  }

  if (!parent.parentId) return doc;
  const grandParent = doc.nodes[parent.parentId];
  if (!grandParent) return doc;
  const parentIndex = grandParent.childrenIds.indexOf(parent.id);
  if (parentIndex === -1) return doc;

  const nextParentChildren = [...parent.childrenIds];
  nextParentChildren.splice(cursorIndex, 1);

  const nextGrandParentChildren = [...grandParent.childrenIds];
  nextGrandParentChildren.splice(parentIndex + 1, 0, cursor.id);
  const sizes = getNodeSizes(doc.nodes);
  const branchDirection = inferBranchDirection(
    doc.nodePositions?.[grandParent.id] ?? { x: 0, y: 0 },
    doc.nodePositions?.[cursor.id] ?? { x: 0, y: 0 },
    sizes[grandParent.id],
    sizes[cursor.id],
    doc.branchDirections?.[cursor.id] ?? "e",
  );
  const nextCursor = {
    ...cursor,
    parentId: grandParent.id,
    branchTone: grandParent.id === doc.rootId ? cursor.branchTone ?? nextBranchTone(doc) : undefined,
  };

  return {
    ...doc,
    branchDirections: { ...doc.branchDirections, [cursor.id]: branchDirection },
    nodes: {
      ...doc.nodes,
      [cursor.id]: nextCursor,
      [parent.id]: { ...parent, childrenIds: nextParentChildren },
      [grandParent.id]: { ...grandParent, childrenIds: nextGrandParentChildren },
    },
  };
}

export function addChild(
  doc: Document,
  requestedDirection?: BranchDirection,
): { updated: Document; newNodeId: NodeId } {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return { updated: doc, newNodeId: doc.cursorId };

  const newId = generateId();
  const direction = requestedDirection ?? preferredChildDirection(doc, cursor.id);
  const newNode: Node = {
    id: newId,
    text: "",
    parentId: cursor.id,
    childrenIds: [],
    branchTone: cursor.id === doc.rootId ? nextBranchTone(doc) : undefined,
  };
  const nextCursorChildren = [...cursor.childrenIds, newId];
  const currentPositions = doc.nodePositions ?? {};
  const parentPoint = currentPositions[cursor.id] ?? { x: 0, y: 0 };
  const sizes = getNodeSizes(doc.nodes);
  const parentSize = sizes[cursor.id] ?? getNodeSize(cursor);
  const newNodeSize = getNodeSize(newNode);
  const preferred = directionalChildPosition(parentPoint, parentSize, newNodeSize, direction);
  const point = findAvailablePositionInDirection(
    preferred,
    direction,
    currentPositions,
    sizes,
    newNodeSize,
  );

  return {
    updated: {
      ...doc,
      cursorId: newId,
      nodePositions: { ...currentPositions, [newId]: point },
      branchDirections: { ...doc.branchDirections, [newId]: direction },
      nodes: {
        ...doc.nodes,
        [newId]: newNode,
        [cursor.id]: { ...cursor, childrenIds: nextCursorChildren },
      },
    },
    newNodeId: newId,
  };
}

export function addSibling(doc: Document): { updated: Document; newNodeId: NodeId } {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return { updated: doc, newNodeId: doc.cursorId };

  if (!cursor.parentId) {
    return addChild(doc);
  }

  const parent = doc.nodes[cursor.parentId];
  if (!parent) return { updated: doc, newNodeId: doc.cursorId };
  const index = parent.childrenIds.indexOf(cursor.id);
  if (index === -1) return { updated: doc, newNodeId: doc.cursorId };

  const newId = generateId();
  const direction = doc.branchDirections?.[cursor.id] ?? preferredChildDirection(doc, parent.id);
  const newNode: Node = {
    id: newId,
    text: "",
    parentId: parent.id,
    childrenIds: [],
    branchTone: parent.id === doc.rootId ? nextBranchTone(doc) : undefined,
  };
  const nextChildren = [...parent.childrenIds];
  nextChildren.splice(index + 1, 0, newId);
  const currentPositions = doc.nodePositions ?? {};
  const parentPoint = currentPositions[parent.id] ?? { x: 0, y: 0 };
  const sizes = getNodeSizes(doc.nodes);
  const parentSize = sizes[parent.id] ?? getNodeSize(parent);
  const newNodeSize = getNodeSize(newNode);
  const preferred = directionalChildPosition(parentPoint, parentSize, newNodeSize, direction);
  const point = findAvailablePositionInDirection(
    preferred,
    direction,
    currentPositions,
    sizes,
    newNodeSize,
  );

  return {
    updated: {
      ...doc,
      cursorId: newId,
      nodePositions: { ...currentPositions, [newId]: point },
      branchDirections: { ...doc.branchDirections, [newId]: direction },
      nodes: {
        ...doc.nodes,
        [newId]: newNode,
        [parent.id]: { ...parent, childrenIds: nextChildren },
      },
    },
    newNodeId: newId,
  };
}

export function deleteCursorNodeAndPromoteChildren(doc: Document): Document {
  if (doc.cursorId === doc.rootId) return doc;
  const deleting = doc.nodes[doc.cursorId];
  if (!deleting?.parentId) return doc;
  const parent = doc.nodes[deleting.parentId];
  if (!parent) return doc;
  const index = parent.childrenIds.indexOf(deleting.id);
  if (index === -1) return doc;

  const promotedIds = deleting.childrenIds;
  const nextParentChildren = [
    ...parent.childrenIds.slice(0, index),
    ...promotedIds,
    ...parent.childrenIds.slice(index + 1),
  ];

  const nextNodes: Record<NodeId, Node> = { ...doc.nodes };
  const nextNodePositions = { ...(doc.nodePositions ?? {}) };
  const nextBranchDirections = { ...(doc.branchDirections ?? {}) };
  delete nextNodes[deleting.id];
  delete nextNodePositions[deleting.id];
  delete nextBranchDirections[deleting.id];
  nextNodes[parent.id] = { ...parent, childrenIds: nextParentChildren };

  for (const childId of promotedIds) {
    const child = nextNodes[childId];
    if (!child) continue;
    const sizes = getNodeSizes(nextNodes);
    nextBranchDirections[childId] = inferBranchDirection(
      nextNodePositions[parent.id] ?? { x: 0, y: 0 },
      nextNodePositions[childId] ?? { x: 0, y: 0 },
      sizes[parent.id],
      sizes[childId],
      nextBranchDirections[childId] ?? "e",
    );
    nextNodes[childId] = {
      ...child,
      parentId: parent.id,
      branchTone:
        parent.id === doc.rootId
          ? child.branchTone ?? nextBranchTone({ ...doc, nodes: nextNodes })
          : undefined,
    };
  }

  let nextCursorId: NodeId = parent.id;
  if (promotedIds.length > 0) {
    nextCursorId = promotedIds[0];
  } else {
    const siblingAtIndex = nextParentChildren[index];
    if (siblingAtIndex) {
      nextCursorId = siblingAtIndex;
    } else {
      const prevSibling = nextParentChildren[index - 1];
      if (prevSibling) nextCursorId = prevSibling;
    }
  }

  return {
    ...doc,
    cursorId: nextCursorId,
    nodes: nextNodes,
    nodePositions: nextNodePositions,
    branchDirections: nextBranchDirections,
  };
}
