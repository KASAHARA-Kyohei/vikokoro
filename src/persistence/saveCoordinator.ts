import type { Workspace } from "../editor/types";
import type { WorkspaceRepository } from "./types";

export type SaveStatus = "saved" | "saving" | "error" | "unavailable";

export type SaveCoordinatorState = {
  status: SaveStatus;
  lastSavedRevision: number;
  lastSavedAt: number | null;
  pendingRevision: number | null;
  error: Error | null;
};

type QueuedSave = { revision: number; workspace: Workspace };

type Options = {
  debounceMs?: number;
  onStateChange?: (state: SaveCoordinatorState) => void;
};

export type SaveCoordinator = {
  setRepository: (repository: WorkspaceRepository) => void;
  schedule: (revision: number, workspace: Workspace) => void;
  flush: () => Promise<boolean>;
  flushLatest: (revision: number, workspace: Workspace) => Promise<boolean>;
  retry: () => Promise<boolean>;
  dispose: () => void;
  getState: () => SaveCoordinatorState;
};

function cloneState(state: SaveCoordinatorState): SaveCoordinatorState {
  return { ...state };
}

export function createSaveCoordinator(
  initialRepository: WorkspaceRepository,
  { debounceMs = 250, onStateChange }: Options = {},
): SaveCoordinator {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;
  let queued: QueuedSave | null = null;
  let disposed = false;
  let repository = initialRepository;
  let state: SaveCoordinatorState = {
    status: repository.name === "unavailable" ? "unavailable" : "saved",
    lastSavedRevision: 0,
    lastSavedAt: null,
    pendingRevision: null,
    error: null,
  };

  const publish = (next: Partial<SaveCoordinatorState>) => {
    state = { ...state, ...next };
    onStateChange?.(cloneState(state));
  };

  const clearTimer = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const queueLatest = (next: QueuedSave) => {
    if (!queued || next.revision >= queued.revision) queued = next;
  };

  const saveQueued = async (): Promise<boolean> => {
    if (disposed || repository.name === "unavailable" || !queued) return false;
    const current = queued;
    queued = null;
    publish({ status: "saving", pendingRevision: null, error: null });
    try {
      await repository.save(current.workspace);
      const pending = queued as QueuedSave | null;
      const pendingRevision = pending?.revision ?? null;
      publish({
        status: pendingRevision === null ? "saved" : "saving",
        lastSavedRevision: Math.max(state.lastSavedRevision, current.revision),
        lastSavedAt: Date.now(),
        pendingRevision,
        error: null,
      });
      return true;
    } catch (error) {
      queueLatest(current);
      const resolved = error instanceof Error ? error : new Error(String(error));
      const pending = queued as QueuedSave | null;
      publish({ status: "error", pendingRevision: pending?.revision ?? current.revision, error: resolved });
      return false;
    }
  };

  const flush = async (): Promise<boolean> => {
    clearTimer();
    if (disposed || repository.name === "unavailable") return false;
    if (inFlight) await inFlight;
    while (queued) {
      inFlight = saveQueued();
      try {
        const saved = await inFlight;
        if (!saved) return false;
      } finally {
        inFlight = null;
      }
    }
    return state.status === "saved";
  };

  const schedule = (revision: number, workspace: Workspace) => {
    if (disposed || revision <= state.lastSavedRevision) return;
    if (repository.name === "unavailable") {
      publish({ status: "unavailable", pendingRevision: null, error: null });
      return;
    }
    queueLatest({ revision, workspace });
    publish({ status: "saving", pendingRevision: queued?.revision ?? revision, error: null });
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  };

  return {
    setRepository: (nextRepository) => {
      repository = nextRepository;
      if (repository.name === "unavailable") {
        clearTimer();
        queued = null;
        publish({ status: "unavailable", pendingRevision: null, error: null });
      }
    },
    schedule,
    flush,
    flushLatest: async (revision, workspace) => {
      if (disposed || repository.name === "unavailable") return false;
      const effectiveRevision = Math.max(
        revision,
        state.lastSavedRevision + 1,
        (queued?.revision ?? 0) + 1,
      );
      queueLatest({ revision: effectiveRevision, workspace });
      publish({ status: "saving", pendingRevision: queued?.revision ?? effectiveRevision, error: null });
      return flush();
    },
    retry: flush,
    dispose: () => {
      disposed = true;
      clearTimer();
    },
    getState: () => cloneState(state),
  };
}
