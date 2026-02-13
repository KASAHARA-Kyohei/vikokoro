import type { WorkspaceRepository } from "./types";

export function createUnavailableWorkspaceRepository(): WorkspaceRepository {
  return {
    name: "unavailable",
    async load() {
      return null;
    },
    async save() {
      throw new Error("workspace repository is unavailable");
    },
  };
}
