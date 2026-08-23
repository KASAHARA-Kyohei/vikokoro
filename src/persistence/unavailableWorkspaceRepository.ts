import type { WorkspaceRepository } from "./types";

export function createUnavailableWorkspaceRepository(): WorkspaceRepository {
  return {
    name: "unavailable",
    async load() {
      return {
        kind: "unavailable" as const,
        issue: {
          code: "unavailable" as const,
          message: "ブラウザモードではワークスペースを保存できません。",
        },
      };
    },
    async save() {
      throw new Error("workspace repository is unavailable");
    },
  };
}
