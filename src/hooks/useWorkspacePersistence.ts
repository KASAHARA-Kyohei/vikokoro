import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../editor/types";
import type { EditorAction } from "../editor/state";
import type { WorkspaceRepository } from "../persistence/types";
import { createTauriWorkspaceRepository } from "../persistence/tauriWorkspaceRepository";
import { createUnavailableWorkspaceRepository } from "../persistence/unavailableWorkspaceRepository";

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
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unavailable">("saved");

  const repositoryRef = useRef<WorkspaceRepository>(
    repository ?? createTauriWorkspaceRepository(),
  );

  const lastSavedRevisionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const queuedSaveRef = useRef<{ revision: number; workspace: Workspace } | null>(null);

  useEffect(() => {
    if (!repository) return;
    repositoryRef.current = repository;
    const available = repository.name !== "unavailable";
    setTauriAvailable(available);
    if (!available) {
      setSaveStatus("unavailable");
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
        setTauriAvailable(false);
        setSaveStatus("unavailable");
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
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveRevision <= lastSavedRevisionRef.current) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const revision = saveRevision;
    const snapshot = workspace;

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      queuedSaveRef.current = { revision, workspace: snapshot };

      if (repositoryRef.current.name === "unavailable") {
        lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, revision);
        setSaveStatus("unavailable");
        return;
      }

      setSaveStatus("saving");

      const flushSaveQueue = async () => {
        if (savingRef.current) return;
        const queued = queuedSaveRef.current;
        if (!queued) return;
        queuedSaveRef.current = null;

        savingRef.current = true;
        try {
          await repositoryRef.current.save(queued.workspace);
          lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, queued.revision);
          setSaveStatus("saved");
        } catch {
          lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, queued.revision);
          repositoryRef.current = createUnavailableWorkspaceRepository();
          setTauriAvailable(false);
          setSaveStatus("unavailable");
        } finally {
          savingRef.current = false;
        }

        void flushSaveQueue();
      };

      void flushSaveQueue();
    }, 250);
  }, [hydrated, saveRevision, workspace]);

  useEffect(() => {
    if (!tauriAvailable) return;
    if (saveRevision <= lastSavedRevisionRef.current) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
  }, [saveRevision, tauriAvailable]);

  const saveLabel = tauriAvailable
    ? saveStatus === "saving"
      ? "Saving…"
      : "Saved"
    : "Local";

  return {
    tauriAvailable,
    saveStatus,
    saveLabel,
  };
}
