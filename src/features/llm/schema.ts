import type { NodeColor } from "../../editor/types";

const SCHEMA_VERSION = "1" as const;
const GENERATE_STYLES = ["balanced", "idea", "task"] as const;
const NODE_COLORS = ["blue", "green", "yellow", "pink", "gray"] as const;

export type SchemaVersion = typeof SCHEMA_VERSION;
export type GenerateStyle = (typeof GENERATE_STYLES)[number];
export type LlmNodeColor = NodeColor | null;

export type ParseSuccess<T> = {
  ok: true;
  value: T;
};

export type ParseFailure = {
  ok: false;
  errors: string[];
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export type GenerateRequest = {
  version: SchemaVersion;
  mode: "generate";
  topic: string;
  language: string;
  maxDepth: number;
  maxChildrenPerNode: number;
  style: GenerateStyle;
  constraints: {
    avoidAbstractOnly: boolean;
    preferActionable: boolean;
  };
};

export type GeneratedTreeNode = {
  tempId: string;
  text: string;
  color: LlmNodeColor;
  children: GeneratedTreeNode[];
};

export type GenerateResponse = {
  version: SchemaVersion;
  mode: "generate";
  root: GeneratedTreeNode;
};

export type ImproveDocumentNode = {
  id: string;
  text: string;
  parentId: string | null;
  childrenIds: string[];
  color: LlmNodeColor;
};

export type ImproveDocumentState = {
  rootId: string;
  cursorId: string;
  nodes: Record<string, ImproveDocumentNode>;
};

export type ImproveRequest = {
  version: SchemaVersion;
  mode: "improve";
  goal: string;
  document: ImproveDocumentState;
  constraints: {
    maxAdditions: number;
    keepExistingText: boolean;
    allowReparent: boolean;
    allowDelete: boolean;
  };
};

export type ImproveAddOperation = {
  op: "add";
  parentId: string;
  index: number;
  node: {
    tempId: string;
    text: string;
    color: LlmNodeColor;
  };
};

export type ImproveUpdateTextOperation = {
  op: "updateText";
  nodeId: string;
  text: string;
};

export type ImproveSetColorOperation = {
  op: "setColor";
  nodeId: string;
  color: LlmNodeColor;
};

export type ImproveMoveOperation = {
  op: "move";
  nodeId: string;
  newParentId: string;
  index: number;
};

export type ImproveDeleteOperation = {
  op: "delete";
  nodeId: string;
  strategy: "promoteChildren";
};

export type ImproveOperation =
  | ImproveAddOperation
  | ImproveUpdateTextOperation
  | ImproveSetColorOperation
  | ImproveMoveOperation
  | ImproveDeleteOperation;

export type ImproveResponse = {
  version: SchemaVersion;
  mode: "improve";
  summary: string;
  operations: ImproveOperation[];
  warnings: string[];
};

type TreeNodeLike = {
  parentId: string | null;
  childrenIds: string[];
};

type SimNode = {
  parentId: string | null;
  childrenIds: string[];
};

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function fail<T>(errors: string[]): ParseResult<T> {
  return { ok: false, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeColor(value: unknown): value is NodeColor {
  return typeof value === "string" && (NODE_COLORS as readonly string[]).includes(value);
}

function pathFor(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function pathForIndex(path: string, index: number): string {
  return `${path}[${index}]`;
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function expectRecord(
  value: unknown,
  path: string,
  errors: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  return value;
}

function readString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  minLength = 0,
): string | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (typeof value !== "string") {
    errors.push(`${nextPath} must be a string (got ${describeType(value)})`);
    return null;
  }
  if (value.length < minLength) {
    errors.push(`${nextPath} must have length >= ${minLength}`);
    return null;
  }
  return value;
}

function readNullableString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  minLength = 0,
): string | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (value === null) return null;
  if (typeof value !== "string") {
    errors.push(`${nextPath} must be string|null (got ${describeType(value)})`);
    return null;
  }
  if (value.length < minLength) {
    errors.push(`${nextPath} must have length >= ${minLength}`);
    return null;
  }
  return value;
}

function readBoolean(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
): boolean | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (typeof value !== "boolean") {
    errors.push(`${nextPath} must be a boolean (got ${describeType(value)})`);
    return null;
  }
  return value;
}

function readInteger(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  min: number,
): number | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (!Number.isInteger(value)) {
    errors.push(`${nextPath} must be an integer (got ${describeType(value)})`);
    return null;
  }
  if ((value as number) < min) {
    errors.push(`${nextPath} must be >= ${min}`);
    return null;
  }
  return value as number;
}

function readLiteral(
  obj: Record<string, unknown>,
  key: string,
  expected: string,
  path: string,
  errors: string[],
): string | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (value !== expected) {
    errors.push(`${nextPath} must be "${expected}"`);
    return null;
  }
  return expected;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
  errors: string[],
): T | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    errors.push(`${nextPath} must be one of: ${allowed.join(", ")}`);
    return null;
  }
  return value as T;
}

function readStringArray(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
  itemMinLength = 0,
): string[] | null {
  const value = obj[key];
  const nextPath = pathFor(path, key);
  if (!Array.isArray(value)) {
    errors.push(`${nextPath} must be an array`);
    return null;
  }
  const list: string[] = [];
  value.forEach((item, index) => {
    const itemPath = pathForIndex(nextPath, index);
    if (typeof item !== "string") {
      errors.push(`${itemPath} must be a string (got ${describeType(item)})`);
      return;
    }
    if (item.length < itemMinLength) {
      errors.push(`${itemPath} must have length >= ${itemMinLength}`);
      return;
    }
    list.push(item);
  });
  return list;
}

function parseNodeColor(
  value: unknown,
  path: string,
  errors: string[],
  allowUndefinedAsNull: boolean,
): LlmNodeColor {
  if (value === undefined && allowUndefinedAsNull) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (isNodeColor(value)) {
    return value;
  }
  errors.push(`${path} must be one of ${NODE_COLORS.join(", ")} or null`);
  return null;
}

function parseGeneratedTreeNode(
  value: unknown,
  path: string,
  errors: string[],
  usedTempIds: Set<string>,
): GeneratedTreeNode | null {
  const obj = expectRecord(value, path, errors);
  if (!obj) return null;

  const tempId = readString(obj, "tempId", path, errors, 1);
  const text = readString(obj, "text", path, errors);
  const color = parseNodeColor(obj.color, pathFor(path, "color"), errors, true);

  const childrenRaw = obj.children;
  const childrenPath = pathFor(path, "children");
  if (!Array.isArray(childrenRaw)) {
    errors.push(`${childrenPath} must be an array`);
    return null;
  }

  const children: GeneratedTreeNode[] = [];
  childrenRaw.forEach((child, index) => {
    const parsed = parseGeneratedTreeNode(child, pathForIndex(childrenPath, index), errors, usedTempIds);
    if (parsed) children.push(parsed);
  });

  if (!tempId || !text) return null;

  if (usedTempIds.has(tempId)) {
    errors.push(`${pathFor(path, "tempId")} must be unique`);
    return null;
  }
  usedTempIds.add(tempId);

  return {
    tempId,
    text,
    color,
    children,
  };
}

function parseImproveDocumentNode(
  value: unknown,
  path: string,
  keyId: string,
  errors: string[],
): ImproveDocumentNode | null {
  const obj = expectRecord(value, path, errors);
  if (!obj) return null;

  const id = readString(obj, "id", path, errors, 1);
  const text = readString(obj, "text", path, errors);
  const parentId = readNullableString(obj, "parentId", path, errors, 1);
  const childrenIds = readStringArray(obj, "childrenIds", path, errors, 1);
  const color = parseNodeColor(obj.color, pathFor(path, "color"), errors, true);

  if (!id || !text || !childrenIds) return null;
  if (id !== keyId) {
    errors.push(`${pathFor(path, "id")} must match node key "${keyId}"`);
    return null;
  }

  return {
    id,
    text,
    parentId,
    childrenIds,
    color,
  };
}

function validateTreeIntegrity(
  rootId: string,
  nodes: Record<string, TreeNodeLike>,
  path: string,
): string[] {
  const errors: string[] = [];
  const ids = Object.keys(nodes);
  const incomingCount: Record<string, number> = {};
  ids.forEach((id) => {
    incomingCount[id] = 0;
  });

  if (!nodes[rootId]) {
    errors.push(`${path}.rootId must exist in ${path}.nodes`);
    return errors;
  }
  if (nodes[rootId].parentId !== null) {
    errors.push(`${path}.nodes.${rootId}.parentId must be null for root node`);
  }

  ids.forEach((id) => {
    const node = nodes[id];
    if (id !== rootId && node.parentId === null) {
      errors.push(`${path}.nodes.${id}.parentId must not be null for non-root node`);
    }
    if (node.parentId !== null && !nodes[node.parentId]) {
      errors.push(`${path}.nodes.${id}.parentId references missing node "${node.parentId}"`);
    }
    const localChildren = new Set<string>();
    node.childrenIds.forEach((childId, index) => {
      const childPath = `${path}.nodes.${id}.childrenIds[${index}]`;
      if (localChildren.has(childId)) {
        errors.push(`${childPath} duplicates child "${childId}" in the same parent`);
      } else {
        localChildren.add(childId);
      }
      const child = nodes[childId];
      if (!child) {
        errors.push(`${childPath} references missing node "${childId}"`);
        return;
      }
      incomingCount[childId] += 1;
      if (child.parentId !== id) {
        errors.push(`${path}.nodes.${childId}.parentId must be "${id}"`);
      }
    });
  });

  ids.forEach((id) => {
    const expectedIncoming = id === rootId ? 0 : 1;
    if (incomingCount[id] !== expectedIncoming) {
      errors.push(
        `${path}.nodes.${id} must have incoming count ${expectedIncoming} (got ${incomingCount[id]})`,
      );
    }
  });

  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    const node = nodes[id];
    for (const childId of node.childrenIds) {
      if (!nodes[childId]) continue;
      const childState = state.get(childId) ?? 0;
      if (childState === 1) {
        errors.push(`${path}.nodes.${childId} creates a cycle (back-edge from "${id}")`);
        continue;
      }
      if (childState === 0) {
        visit(childId);
      }
    }
    state.set(id, 2);
  };
  visit(rootId);

  ids.forEach((id) => {
    if ((state.get(id) ?? 0) === 0) {
      errors.push(`${path}.nodes.${id} is unreachable from rootId "${rootId}"`);
    }
  });

  return errors;
}

function validateDocumentStateIntegrity(document: ImproveDocumentState, path: string): string[] {
  const errors: string[] = [];
  if (!document.nodes[document.rootId]) {
    errors.push(`${path}.rootId "${document.rootId}" does not exist in nodes`);
  }
  if (!document.nodes[document.cursorId]) {
    errors.push(`${path}.cursorId "${document.cursorId}" does not exist in nodes`);
  }
  errors.push(...validateTreeIntegrity(document.rootId, document.nodes, path));
  return errors;
}

function cloneSimNodes(document: ImproveDocumentState): Record<string, SimNode> {
  const next: Record<string, SimNode> = {};
  Object.entries(document.nodes).forEach(([id, node]) => {
    next[id] = {
      parentId: node.parentId,
      childrenIds: [...node.childrenIds],
    };
  });
  return next;
}

function resolveNodeId(
  nodeRef: string,
  simNodes: Record<string, SimNode>,
  tempIdToNodeId: Record<string, string>,
): string | null {
  if (simNodes[nodeRef]) return nodeRef;
  const mapped = tempIdToNodeId[nodeRef];
  if (mapped && simNodes[mapped]) return mapped;
  return null;
}

function isAncestor(
  ancestorCandidate: string,
  descendantCandidate: string,
  simNodes: Record<string, SimNode>,
): boolean {
  let current: SimNode | undefined = simNodes[descendantCandidate];
  let depth = 0;
  const maxDepth = Object.keys(simNodes).length + 1;
  while (current?.parentId) {
    if (current.parentId === ancestorCandidate) {
      return true;
    }
    current = simNodes[current.parentId];
    depth += 1;
    if (depth > maxDepth) break;
  }
  return false;
}

function parseImproveOperation(
  value: unknown,
  path: string,
  errors: string[],
): ImproveOperation | null {
  const obj = expectRecord(value, path, errors);
  if (!obj) return null;

  const op = readString(obj, "op", path, errors, 1);
  if (!op) return null;

  if (op === "add") {
    const parentId = readString(obj, "parentId", path, errors, 1);
    const index = readInteger(obj, "index", path, errors, 0);
    const nodeObj = expectRecord(obj.node, pathFor(path, "node"), errors);
    if (!parentId || index === null || !nodeObj) return null;
    const tempId = readString(nodeObj, "tempId", pathFor(path, "node"), errors, 1);
    const text = readString(nodeObj, "text", pathFor(path, "node"), errors);
    const color = parseNodeColor(
      nodeObj.color,
      pathFor(pathFor(path, "node"), "color"),
      errors,
      true,
    );
    if (!tempId || !text) return null;
    return {
      op: "add",
      parentId,
      index,
      node: {
        tempId,
        text,
        color,
      },
    };
  }

  if (op === "updateText") {
    const nodeId = readString(obj, "nodeId", path, errors, 1);
    const text = readString(obj, "text", path, errors);
    if (!nodeId || !text) return null;
    return { op: "updateText", nodeId, text };
  }

  if (op === "setColor") {
    const nodeId = readString(obj, "nodeId", path, errors, 1);
    const color = parseNodeColor(obj.color, pathFor(path, "color"), errors, true);
    if (!nodeId) return null;
    return { op: "setColor", nodeId, color };
  }

  if (op === "move") {
    const nodeId = readString(obj, "nodeId", path, errors, 1);
    const newParentId = readString(obj, "newParentId", path, errors, 1);
    const index = readInteger(obj, "index", path, errors, 0);
    if (!nodeId || !newParentId || index === null) return null;
    return { op: "move", nodeId, newParentId, index };
  }

  if (op === "delete") {
    const nodeId = readString(obj, "nodeId", path, errors, 1);
    const strategy = readLiteral(obj, "strategy", "promoteChildren", path, errors);
    if (!nodeId || !strategy) return null;
    return { op: "delete", nodeId, strategy: "promoteChildren" };
  }

  errors.push(`${pathFor(path, "op")} must be one of: add, updateText, setColor, move, delete`);
  return null;
}

export function parseGenerateRequest(input: unknown): ParseResult<GenerateRequest> {
  const errors: string[] = [];
  const root = expectRecord(input, "input", errors);
  if (!root) return fail(errors);

  const version = readLiteral(root, "version", SCHEMA_VERSION, "input", errors);
  const mode = readLiteral(root, "mode", "generate", "input", errors);
  const topic = readString(root, "topic", "input", errors);
  const language = readString(root, "language", "input", errors, 1);
  const maxDepth = readInteger(root, "maxDepth", "input", errors, 1);
  const maxChildrenPerNode = readInteger(root, "maxChildrenPerNode", "input", errors, 1);
  const style = readEnum(root, "style", GENERATE_STYLES, "input", errors);
  const constraintsObj = expectRecord(root.constraints, "input.constraints", errors);

  let avoidAbstractOnly: boolean | null = null;
  let preferActionable: boolean | null = null;
  if (constraintsObj) {
    avoidAbstractOnly = readBoolean(
      constraintsObj,
      "avoidAbstractOnly",
      "input.constraints",
      errors,
    );
    preferActionable = readBoolean(
      constraintsObj,
      "preferActionable",
      "input.constraints",
      errors,
    );
  }

  if (
    !version ||
    !mode ||
    !topic ||
    !language ||
    maxDepth === null ||
    maxChildrenPerNode === null ||
    !style ||
    avoidAbstractOnly === null ||
    preferActionable === null
  ) {
    return fail(errors);
  }

  return ok({
    version: "1",
    mode: "generate",
    topic,
    language,
    maxDepth,
    maxChildrenPerNode,
    style,
    constraints: {
      avoidAbstractOnly,
      preferActionable,
    },
  });
}

export function parseGenerateResponse(input: unknown): ParseResult<GenerateResponse> {
  const errors: string[] = [];
  const root = expectRecord(input, "input", errors);
  if (!root) return fail(errors);

  const version = readLiteral(root, "version", SCHEMA_VERSION, "input", errors);
  const mode = readLiteral(root, "mode", "generate", "input", errors);
  const usedTempIds = new Set<string>();
  const parsedRoot = parseGeneratedTreeNode(root.root, "input.root", errors, usedTempIds);

  if (!version || !mode || !parsedRoot) {
    return fail(errors);
  }

  return ok({
    version: "1",
    mode: "generate",
    root: parsedRoot,
  });
}

export function parseImproveRequest(input: unknown): ParseResult<ImproveRequest> {
  const errors: string[] = [];
  const root = expectRecord(input, "input", errors);
  if (!root) return fail(errors);

  const version = readLiteral(root, "version", SCHEMA_VERSION, "input", errors);
  const mode = readLiteral(root, "mode", "improve", "input", errors);
  const goal = readString(root, "goal", "input", errors, 1);

  const documentObj = expectRecord(root.document, "input.document", errors);
  const constraintsObj = expectRecord(root.constraints, "input.constraints", errors);

  let document: ImproveDocumentState | null = null;
  if (documentObj) {
    const rootId = readString(documentObj, "rootId", "input.document", errors, 1);
    const cursorId = readString(documentObj, "cursorId", "input.document", errors, 1);
    const nodesObj = expectRecord(documentObj.nodes, "input.document.nodes", errors);
    const nodes: Record<string, ImproveDocumentNode> = {};
    if (nodesObj) {
      Object.entries(nodesObj).forEach(([key, nodeValue]) => {
        const parsed = parseImproveDocumentNode(
          nodeValue,
          `input.document.nodes.${key}`,
          key,
          errors,
        );
        if (parsed) {
          nodes[key] = parsed;
        }
      });
    }
    if (rootId && cursorId && nodesObj) {
      document = { rootId, cursorId, nodes };
      errors.push(...validateDocumentStateIntegrity(document, "input.document"));
    }
  }

  let maxAdditions: number | null = null;
  let keepExistingText: boolean | null = null;
  let allowReparent: boolean | null = null;
  let allowDelete: boolean | null = null;
  if (constraintsObj) {
    maxAdditions = readInteger(constraintsObj, "maxAdditions", "input.constraints", errors, 0);
    keepExistingText = readBoolean(
      constraintsObj,
      "keepExistingText",
      "input.constraints",
      errors,
    );
    allowReparent = readBoolean(constraintsObj, "allowReparent", "input.constraints", errors);
    allowDelete = readBoolean(constraintsObj, "allowDelete", "input.constraints", errors);
  }

  if (
    !version ||
    !mode ||
    !goal ||
    !document ||
    maxAdditions === null ||
    keepExistingText === null ||
    allowReparent === null ||
    allowDelete === null
  ) {
    return fail(errors);
  }
  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    version: "1",
    mode: "improve",
    goal,
    document,
    constraints: {
      maxAdditions,
      keepExistingText,
      allowReparent,
      allowDelete,
    },
  });
}

export function parseImproveResponse(input: unknown): ParseResult<ImproveResponse> {
  const errors: string[] = [];
  const root = expectRecord(input, "input", errors);
  if (!root) return fail(errors);

  const version = readLiteral(root, "version", SCHEMA_VERSION, "input", errors);
  const mode = readLiteral(root, "mode", "improve", "input", errors);
  const summary = readString(root, "summary", "input", errors);

  const warningsValue = root.warnings;
  let warnings: string[] = [];
  if (warningsValue === undefined) {
    warnings = [];
  } else if (Array.isArray(warningsValue)) {
    warnings = [];
    warningsValue.forEach((item, index) => {
      const itemPath = `input.warnings[${index}]`;
      if (typeof item !== "string") {
        errors.push(`${itemPath} must be a string (got ${describeType(item)})`);
        return;
      }
      warnings.push(item);
    });
  } else {
    errors.push(`input.warnings must be an array`);
  }

  if (!Array.isArray(root.operations)) {
    errors.push("input.operations must be an array");
    return fail(errors);
  }

  const operations: ImproveOperation[] = [];
  root.operations.forEach((opValue, index) => {
    const parsed = parseImproveOperation(opValue, `input.operations[${index}]`, errors);
    if (parsed) operations.push(parsed);
  });

  if (!version || !mode || !summary) {
    return fail(errors);
  }
  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    version: "1",
    mode: "improve",
    summary,
    operations,
    warnings,
  });
}

export function validateImproveResponseAgainstDocument(
  response: ImproveResponse,
  document: ImproveDocumentState,
): string[] {
  const errors = validateDocumentStateIntegrity(document, "document");
  if (errors.length > 0) return errors;

  const simNodes = cloneSimNodes(document);
  const tempIdToNodeId: Record<string, string> = {};

  response.operations.forEach((op, index) => {
    const opPath = `operations[${index}]`;

    if (op.op === "add") {
      const parentId = resolveNodeId(op.parentId, simNodes, tempIdToNodeId);
      if (!parentId) {
        errors.push(`${opPath}.parentId references unknown node "${op.parentId}"`);
        return;
      }
      if (tempIdToNodeId[op.node.tempId]) {
        errors.push(`${opPath}.node.tempId "${op.node.tempId}" must be unique`);
        return;
      }
      const parent = simNodes[parentId];
      if (op.index > parent.childrenIds.length) {
        errors.push(
          `${opPath}.index must be between 0 and ${parent.childrenIds.length} for parent "${op.parentId}"`,
        );
        return;
      }
      const simId = `@temp:${op.node.tempId}`;
      simNodes[simId] = {
        parentId,
        childrenIds: [],
      };
      parent.childrenIds.splice(op.index, 0, simId);
      tempIdToNodeId[op.node.tempId] = simId;
      return;
    }

    if (op.op === "updateText" || op.op === "setColor") {
      const nodeRef = op.nodeId;
      const resolved = resolveNodeId(nodeRef, simNodes, tempIdToNodeId);
      if (!resolved) {
        errors.push(`${opPath}.nodeId references unknown node "${nodeRef}"`);
      }
      return;
    }

    if (op.op === "move") {
      const nodeId = resolveNodeId(op.nodeId, simNodes, tempIdToNodeId);
      if (!nodeId) {
        errors.push(`${opPath}.nodeId references unknown node "${op.nodeId}"`);
        return;
      }
      if (nodeId === document.rootId) {
        errors.push(`${opPath}.nodeId cannot move root node`);
        return;
      }
      const newParentId = resolveNodeId(op.newParentId, simNodes, tempIdToNodeId);
      if (!newParentId) {
        errors.push(`${opPath}.newParentId references unknown node "${op.newParentId}"`);
        return;
      }
      if (nodeId === newParentId) {
        errors.push(`${opPath} cannot move a node under itself`);
        return;
      }
      if (isAncestor(nodeId, newParentId, simNodes)) {
        errors.push(`${opPath} would create a cycle`);
        return;
      }

      const moving = simNodes[nodeId];
      if (!moving.parentId || !simNodes[moving.parentId]) {
        errors.push(`${opPath}.nodeId has invalid current parent`);
        return;
      }

      const sourceSiblings = simNodes[moving.parentId].childrenIds;
      const sourceIndex = sourceSiblings.indexOf(nodeId);
      if (sourceIndex === -1) {
        errors.push(`${opPath}.nodeId is not present in current parent's childrenIds`);
        return;
      }

      const targetSiblings = simNodes[newParentId].childrenIds;
      const targetLengthAfterRemoval =
        moving.parentId === newParentId ? targetSiblings.length - 1 : targetSiblings.length;
      if (op.index > targetLengthAfterRemoval) {
        errors.push(
          `${opPath}.index must be between 0 and ${targetLengthAfterRemoval} for new parent "${op.newParentId}"`,
        );
        return;
      }

      sourceSiblings.splice(sourceIndex, 1);
      targetSiblings.splice(op.index, 0, nodeId);
      moving.parentId = newParentId;
      return;
    }

    const nodeId = resolveNodeId(op.nodeId, simNodes, tempIdToNodeId);
    if (!nodeId) {
      errors.push(`${opPath}.nodeId references unknown node "${op.nodeId}"`);
      return;
    }
    if (nodeId === document.rootId) {
      errors.push(`${opPath}.nodeId cannot delete root node`);
      return;
    }
    const deleting = simNodes[nodeId];
    if (!deleting.parentId || !simNodes[deleting.parentId]) {
      errors.push(`${opPath}.nodeId has invalid parent`);
      return;
    }
    const parent = simNodes[deleting.parentId];
    const indexInParent = parent.childrenIds.indexOf(nodeId);
    if (indexInParent === -1) {
      errors.push(`${opPath}.nodeId is not present in parent's childrenIds`);
      return;
    }
    parent.childrenIds.splice(indexInParent, 1, ...deleting.childrenIds);
    deleting.childrenIds.forEach((childId) => {
      const child = simNodes[childId];
      if (!child) {
        errors.push(`${opPath} references missing child "${childId}" during delete`);
        return;
      }
      child.parentId = deleting.parentId;
    });
    delete simNodes[nodeId];
    Object.entries(tempIdToNodeId).forEach(([tempId, mapped]) => {
      if (mapped === nodeId) {
        delete tempIdToNodeId[tempId];
      }
    });
  });

  errors.push(...validateTreeIntegrity(document.rootId, simNodes, "result"));
  return errors;
}

export function parseAndValidateImproveResponse(
  input: unknown,
  document: ImproveDocumentState,
): ParseResult<ImproveResponse> {
  const parsed = parseImproveResponse(input);
  if (!parsed.ok) return parsed;
  const errors = validateImproveResponseAgainstDocument(parsed.value, document);
  if (errors.length > 0) return fail(errors);
  return parsed;
}
