import type { Workspace } from "../editor/types";

export type WorkspaceRepository = {
  name: "tauri" | "unavailable";
  load: () => Promise<Workspace | null>;
  save: (workspace: Workspace) => Promise<void>;
};
