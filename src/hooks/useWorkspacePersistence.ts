import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../editor/types";
import type { EditorAction } from "../editor/state";

type Params = {
  hydrated: boolean;
  saveRevision: number;
  workspace: Workspace;
  dispatch: (action: EditorAction) => void;
};

export function useWorkspacePersistence({ hydrated, saveRevision, workspace, dispatch }: Params) {
  const [tauriAvailable, setTauriAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unavailable">("saved");

  const lastSavedRevisionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const queuedSaveRef = useRef<{ revision: number; workspace: Workspace } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await invoke<Workspace | null>("load_workspace");
        if (cancelled) return;
        dispatch({ type: "finishHydration", workspace: loaded });
      } catch {
        if (cancelled) return;
        setTauriAvailable(false);
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

      if (!tauriAvailable) {
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
          await invoke("save_workspace", { workspace: queued.workspace });
          lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, queued.revision);
          setSaveStatus("saved");
        } catch {
          lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, queued.revision);
          setTauriAvailable(false);
          setSaveStatus("unavailable");
        } finally {
          savingRef.current = false;
        }

        void flushSaveQueue();
      };

      void flushSaveQueue();
    }, 250);
  }, [hydrated, saveRevision, tauriAvailable, workspace]);

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

