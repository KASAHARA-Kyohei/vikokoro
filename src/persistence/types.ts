import type { Workspace } from "../editor/types";

export type PersistenceIssueCode =
  | "corrupt"
  | "invalid-schema"
  | "io"
  | "unavailable";

export type PersistenceIssue = {
  code: PersistenceIssueCode;
  message: string;
};

export type WorkspaceLoadResult =
  | { kind: "loaded"; workspace: Workspace; source: "primary" }
  | { kind: "recovered"; workspace: Workspace; source: "backup"; issue: PersistenceIssue }
  | { kind: "empty" }
  | { kind: "unavailable"; issue: PersistenceIssue }
  | { kind: "invalid"; issue: PersistenceIssue };

export interface DocumentRepository {
  name: "tauri" | "unavailable";
  load: () => Promise<WorkspaceLoadResult>;
  save: (workspace: Workspace) => Promise<void>;
}

/** Compatibility alias while callers migrate to the product-level name. */
export type WorkspaceRepository = DocumentRepository;
