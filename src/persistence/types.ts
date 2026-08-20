import type { Workspace } from "../editor/types";

export interface DocumentRepository {
  name: "tauri" | "unavailable";
  load: () => Promise<Workspace | null>;
  save: (workspace: Workspace) => Promise<void>;
}

/** Compatibility alias while callers migrate to the product-level name. */
export type WorkspaceRepository = DocumentRepository;
