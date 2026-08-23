import { invoke } from "@tauri-apps/api/core";
import { parsePersistedWorkspace } from "./workspaceParser";
import type { WorkspaceLoadResult, WorkspaceRepository } from "./types";

type RawLoadResult =
  | { kind: "loaded"; workspace: unknown; source: "primary" | "backup"; warning?: "corrupt" | null }
  | { kind: "empty"; warning?: "corrupt" | null };

function normalizeLoadResult(raw: RawLoadResult): WorkspaceLoadResult {
  if (raw.kind === "empty") {
    if (raw.warning === "corrupt") {
      return {
        kind: "invalid",
        issue: { code: "corrupt", message: "保存データを読み込めませんでした。元ファイルは退避されています。" },
      };
    }
    return { kind: "empty" };
  }

  const workspace = parsePersistedWorkspace(raw.workspace);
  if (!workspace) {
    return {
      kind: "invalid",
      issue: { code: "invalid-schema", message: "保存データの構造が正しくありません。元ファイルは上書きしません。" },
    };
  }
  if (raw.source === "backup") {
    return {
      kind: "recovered",
      source: "backup",
      workspace,
      issue: { code: "corrupt", message: "最新のバックアップからワークスペースを復元しました。" },
    };
  }
  return { kind: "loaded", source: "primary", workspace };
}

export function createTauriWorkspaceRepository(): WorkspaceRepository {
  return {
    name: "tauri",
    async load() {
      try {
        const raw = await invoke<RawLoadResult>("load_workspace");
        return normalizeLoadResult(raw);
      } catch (error) {
        return {
          kind: "unavailable",
          issue: {
            code: "io",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
    save: (workspace) => invoke("save_workspace", { workspace }),
  };
}
