import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Workspace } from "../editor/types";
import type { EditorAction } from "../editor/state";
import type { PersistenceIssue, WorkspaceRepository } from "../persistence/types";
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
  const [loadIssue, setLoadIssue] = useState<PersistenceIssue | null>(null);
  const [recoveredFromBackup, setRecoveredFromBackup] = useState(false);
  const [loadBlocked, setLoadBlocked] = useState(false);
  const [saveState, setSaveState] = useState<SaveCoordinatorState>(() => ({
    status: repository?.name === "unavailable" ? "unavailable" : "saved",
    lastSavedRevision: 0,
    lastSavedAt: null,
    pendingRevision: null,
    error: null,
  }));

  const initialRepository = repository ?? createTauriWorkspaceRepository();
  const repositoryRef = useRef<WorkspaceRepository>(initialRepository);
  const latestWorkspaceRef = useRef({ revision: saveRevision, workspace });

  const coordinatorRef = useRef<SaveCoordinator | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createSaveCoordinator(initialRepository, {
      onStateChange: setSaveState,
    });
  }

  useLayoutEffect(() => {
    latestWorkspaceRef.current = { revision: saveRevision, workspace };
  }, [saveRevision, workspace]);

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
        if (loaded.kind === "loaded") {
          dispatch({ type: "finishHydration", workspace: loaded.workspace });
          return;
        }
        if (loaded.kind === "recovered") {
          setRecoveredFromBackup(true);
          setLoadIssue(loaded.issue);
          dispatch({ type: "finishHydration", workspace: loaded.workspace });
          return;
        }
        if (loaded.kind === "empty") {
          dispatch({ type: "finishHydration", workspace: null });
          return;
        }
        if (loaded.kind === "unavailable" && loaded.issue.code === "unavailable") {
          setLoadBlocked(true);
          setLoadIssue(null);
          repositoryRef.current = createUnavailableWorkspaceRepository();
          coordinatorRef.current?.setRepository(repositoryRef.current);
          setTauriAvailable(false);
          setSaveState((current) => ({ ...current, status: "unavailable", error: null }));
          dispatch({ type: "finishHydration", workspace: null });
          return;
        }
        setLoadIssue(loaded.issue);
        setLoadBlocked(true);
        repositoryRef.current = createUnavailableWorkspaceRepository();
        coordinatorRef.current?.setRepository(repositoryRef.current);
        setTauriAvailable(false);
        setSaveState((current) => ({ ...current, status: "unavailable", error: null }));
        dispatch({ type: "finishHydration", workspace: null });
      } catch (error) {
        if (cancelled) return;
        setLoadIssue({
          code: "io",
          message: error instanceof Error ? error.message : "ワークスペースを読み込めませんでした。",
        });
        setLoadBlocked(true);
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
    if (!hydrated || loadBlocked) return;
    if (saveRevision <= (coordinatorRef.current?.getState().lastSavedRevision ?? 0)) return;
    coordinatorRef.current?.schedule(saveRevision, workspace);
  }, [hydrated, loadBlocked, saveRevision, workspace]);

  const flushPendingSave = useCallback(
    () => {
      const latest = latestWorkspaceRef.current;
      return coordinatorRef.current?.flushLatest(latest.revision, latest.workspace) ?? Promise.resolve(false);
    },
    [],
  );
  const retrySave = useCallback(
    () => coordinatorRef.current?.retry() ?? Promise.resolve(false),
    [],
  );
  const startFreshPersistence = useCallback(() => {
    repositoryRef.current = initialRepository;
    coordinatorRef.current?.setRepository(initialRepository);
    setLoadBlocked(false);
    setLoadIssue(null);
    setRecoveredFromBackup(false);
    setTauriAvailable(initialRepository.name !== "unavailable");
  }, [initialRepository]);

  return {
    tauriAvailable,
    saveStatus: saveState.status,
    saveError: saveState.error,
    loadIssue,
    recoveredFromBackup,
    loadBlocked,
    flushPendingSave,
    retrySave,
    startFreshPersistence,
  };
}
