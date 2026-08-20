import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace } from "../editor/types";
import type { EditorAction } from "../editor/state";
import type { WorkspaceRepository } from "../persistence/types";
import { createTauriWorkspaceRepository } from "../persistence/tauriWorkspaceRepository";
import { createUnavailableWorkspaceRepository } from "../persistence/unavailableWorkspaceRepository";
import {
  createSaveCoordinator,
  type SaveCoordinator,
  type SaveCoordinatorState,
} from "../persistence/saveCoordinator";

type Params = {
  hydrated: boolean;
  saveRevision: number;
  workspace: Workspace;
  dispatch: (action: EditorAction) => void;
  repository?: WorkspaceRepository;
};

export function useWorkspacePersistence({
  hydrated,
  saveRevision,
  workspace,
  dispatch,
  repository,
}: Params) {
  const [tauriAvailable, setTauriAvailable] = useState(repository?.name !== "unavailable");
  const [saveState, setSaveState] = useState<SaveCoordinatorState>(() => ({
    status: repository?.name === "unavailable" ? "unavailable" : "saved",
    lastSavedRevision: 0,
    lastSavedAt: null,
    pendingRevision: null,
    error: null,
  }));

  const initialRepository = repository ?? createTauriWorkspaceRepository();
  const repositoryRef = useRef<WorkspaceRepository>(initialRepository);

  const coordinatorRef = useRef<SaveCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createSaveCoordinator(initialRepository, {
      onStateChange: setSaveState,
    });
  }

  useEffect(() => {
    if (!repository) return;
    repositoryRef.current = repository;
    coordinatorRef.current?.setRepository(repository);
    const available = repository.name !== "unavailable";
    setTauriAvailable(available);
    if (!available) {
      setSaveState((current) => ({ ...current, status: "unavailable", error: null }));
    }
  }, [repository]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await repositoryRef.current.load();
        if (cancelled) return;
        dispatch({ type: "finishHydration", workspace: loaded });
      } catch {
        if (cancelled) return;
        repositoryRef.current = createUnavailableWorkspaceRepository();
        coordinatorRef.current?.setRepository(repositoryRef.current);
        setTauriAvailable(false);
        setSaveState((current) => ({ ...current, status: "unavailable", error: null }));
        dispatch({ type: "finishHydration", workspace: null });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    return () => {
      coordinatorRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveRevision <= (coordinatorRef.current?.getState().lastSavedRevision ?? 0)) return;
    coordinatorRef.current?.schedule(saveRevision, workspace);
  }, [hydrated, saveRevision, workspace]);

  const saveLabel = tauriAvailable
    ? saveState.status === "saving"
      ? "Saving…"
      : saveState.status === "error"
        ? "Save failed"
        : "Saved"
    : "Local";

  const flushPendingSave = useCallback(
    () => coordinatorRef.current?.flush() ?? Promise.resolve(false),
    [],
  );
  const retrySave = useCallback(
    () => coordinatorRef.current?.retry() ?? Promise.resolve(false),
    [],
  );

  return {
    tauriAvailable,
    saveStatus: saveState.status,
    saveLabel,
    saveError: saveState.error,
    flushPendingSave,
    retrySave,
  };
}
