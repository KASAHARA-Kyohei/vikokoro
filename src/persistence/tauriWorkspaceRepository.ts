import { invoke } from "@tauri-apps/api/core";
import type { Workspace } from "../editor/types";
import type { WorkspaceRepository } from "./types";

export function createTauriWorkspaceRepository(): WorkspaceRepository {
  return {
    name: "tauri",
    load: () => invoke<Workspace | null>("load_workspace"),
    save: (workspace) => invoke("save_workspace", { workspace }),
  };
}
