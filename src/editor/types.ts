export type NodeId = string;
export type DocId = string;

export type Mode = "normal" | "insert";

export type NodeColor = "blue" | "green" | "yellow" | "pink" | "gray";
export type CanvasPoint = { x: number; y: number };
export type CanvasSize = { width: number; height: number };
export type Viewport = { x: number; y: number; zoom: number; initialized?: boolean };
export type Selection = {
  cardIds: NodeId[];
  lastEditedCardId: NodeId | null;
};
export type AnchorSide = "top" | "right" | "bottom" | "left";
export type EdgeAnchor = {
  from: AnchorSide | null;
  to: AnchorSide | null;
};
export type CustomLink = {
  id: string;
  fromId: NodeId;
  toId: NodeId;
};
export type StickyNote = {
  id: string;
  text: string;
  position: CanvasPoint;
};

export type Node = {
  id: NodeId;
  text: string;
  note?: string;
  parentId: NodeId | null;
  childrenIds: NodeId[];
  color?: NodeColor;
};

export type DocumentState = {
  rootId: NodeId;
  cursorId: NodeId;
  nodes: Record<NodeId, Node>;
  nodePositions: Record<NodeId, CanvasPoint>;
  edgeAnchors: Record<string, EdgeAnchor>;
  customLinks: Record<string, CustomLink>;
  stickyNotes: Record<string, StickyNote>;
  cardSizes: Record<NodeId, CanvasSize>;
};

export type Document = DocumentState & {
  id: DocId;
  collapsedNodeIds: NodeId[];
  undoStack: DocumentState[];
  redoStack: DocumentState[];
  viewport: Viewport;
  selection: Selection;
};

export type History<T> = {
  past: T[];
  future: T[];
};

export type Tab = {
  docId: DocId;
};

export type Workspace = {
  schemaVersion?: 2;
  tabs: Tab[];
  activeDocId: DocId;
  documents: Record<DocId, Document>;
};
