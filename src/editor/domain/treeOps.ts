import type { Document, Node, NodeId } from "../types";
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
  const tmp = nextChildren[index];
  nextChildren[index] = nextChildren[swapWith];
  nextChildren[swapWith] = tmp;

  return {
    ...doc,
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

    return {
      ...doc,
      nodes: {
        ...doc.nodes,
        [cursor.id]: { ...cursor, parentId: prevSibling.id },
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

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [cursor.id]: { ...cursor, parentId: grandParent.id },
      [parent.id]: { ...parent, childrenIds: nextParentChildren },
      [grandParent.id]: { ...grandParent, childrenIds: nextGrandParentChildren },
    },
  };
}

export function addChild(doc: Document): { updated: Document; newNodeId: NodeId } {
  const cursor = doc.nodes[doc.cursorId];
  if (!cursor) return { updated: doc, newNodeId: doc.cursorId };

  const newId = generateId();
  const newNode: Node = { id: newId, text: "", parentId: cursor.id, childrenIds: [] };
  const nextCursorChildren = [...cursor.childrenIds, newId];

  return {
    updated: {
      ...doc,
      cursorId: newId,
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
  const newNode: Node = { id: newId, text: "", parentId: parent.id, childrenIds: [] };
  const nextChildren = [...parent.childrenIds];
  nextChildren.splice(index + 1, 0, newId);

  return {
    updated: {
      ...doc,
      cursorId: newId,
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
  delete nextNodes[deleting.id];
  nextNodes[parent.id] = { ...parent, childrenIds: nextParentChildren };

  for (const childId of promotedIds) {
    const child = nextNodes[childId];
    if (!child) continue;
    nextNodes[childId] = { ...child, parentId: parent.id };
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
  };
}
