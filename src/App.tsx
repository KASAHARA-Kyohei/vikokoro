import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { EditorView } from "./editor/EditorView";
import { TabBar } from "./editor/TabBar";
import { createInitialAppState, editorReducer } from "./editor/state";
import type { Workspace } from "./editor/types";

type ThemeName = "dark" | "light" | "tokyoNight";

function cycleTheme(theme: ThemeName): ThemeName {
  if (theme === "dark") return "light";
  if (theme === "light") return "tokyoNight";
  return "dark";
}

function loadThemeFromStorage(): ThemeName {
  const raw = localStorage.getItem("vikokoro.theme");
  if (raw === "dark" || raw === "light" || raw === "tokyoNight") return raw;
  return "dark";
}

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialAppState);
  const [theme, setTheme] = useState<ThemeName>(() => loadThemeFromStorage());
  const [helpOpen, setHelpOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const lastSavedRevisionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const queuedSaveRef = useRef<{ revision: number; workspace: Workspace } | null>(null);
  const pendingDRef = useRef(false);
  const pendingDTimerRef = useRef<number | null>(null);

  const activeDoc = state.workspace.documents[state.workspace.activeDocId];
  const activeTabIndex = useMemo(() => {
    return state.workspace.tabs.findIndex(
      (tab) => tab.docId === state.workspace.activeDocId,
    );
  }, [state.workspace.activeDocId, state.workspace.tabs]);

  const modeLabel = state.mode === "insert" ? "INSERT" : "NORMAL";

  useEffect(() => {
    if (state.mode === "normal") {
      viewportRef.current?.focus();
    }
  }, [state.mode, state.workspace.activeDocId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await invoke<Workspace | null>("load_workspace");
        if (cancelled) return;
        dispatch({ type: "finishHydration", workspace: loaded });
      } catch {
        if (cancelled) return;
        dispatch({ type: "finishHydration", workspace: null });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vikokoro.theme", theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      if (pendingDTimerRef.current !== null) {
        window.clearTimeout(pendingDTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    if (state.saveRevision <= lastSavedRevisionRef.current) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const revision = state.saveRevision;
    const workspace = state.workspace;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      queuedSaveRef.current = { revision, workspace };

      const flushSaveQueue = async () => {
        if (savingRef.current) return;
        const queued = queuedSaveRef.current;
        if (!queued) return;
        queuedSaveRef.current = null;

        savingRef.current = true;
        try {
          await invoke("save_workspace", { workspace: queued.workspace });
          lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, queued.revision);
        } catch {
          // no-op (e.g. running in browser mode)
        } finally {
          savingRef.current = false;
        }

        void flushSaveQueue();
      };

      void flushSaveQueue();
    }, 250);
  }, [state.hydrated, state.saveRevision, state.workspace]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!state.hydrated) return;

      if (helpOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setHelpOpen(false);
          return;
        }
        event.preventDefault();
        return;
      }

      if (state.closeConfirmDocId) {
        const key = event.key;
        if (key === "y" || key === "Y") {
          event.preventDefault();
          dispatch({ type: "closeActiveDoc" });
          return;
        }
        if (key === "n" || key === "N" || key === "Escape") {
          event.preventDefault();
          dispatch({ type: "cancelCloseConfirm" });
          return;
        }
        event.preventDefault();
        return;
      }

      if (state.mode === "normal" && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (state.mode === "insert") {
        pendingDRef.current = false;
        if (pendingDTimerRef.current !== null) {
          window.clearTimeout(pendingDTimerRef.current);
          pendingDTimerRef.current = null;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          dispatch({ type: "commitInsert" });
        }
        if (event.key === "Tab" || (event.ctrlKey && event.key === "Tab")) {
          event.preventDefault();
        }
        if (event.ctrlKey && (event.key === "t" || event.key === "w")) {
          event.preventDefault();
        }
        return;
      }

      if (event.key !== "d") {
        pendingDRef.current = false;
        if (pendingDTimerRef.current !== null) {
          window.clearTimeout(pendingDTimerRef.current);
          pendingDTimerRef.current = null;
        }
      }

      if (event.key === "d") {
        event.preventDefault();
        if (pendingDRef.current) {
          pendingDRef.current = false;
          if (pendingDTimerRef.current !== null) {
            window.clearTimeout(pendingDTimerRef.current);
            pendingDTimerRef.current = null;
          }
          dispatch({ type: "deleteNode" });
          return;
        }

        pendingDRef.current = true;
        if (pendingDTimerRef.current !== null) {
          window.clearTimeout(pendingDTimerRef.current);
        }
        pendingDTimerRef.current = window.setTimeout(() => {
          pendingDRef.current = false;
          pendingDTimerRef.current = null;
        }, 600);
        return;
      }

      if (event.ctrlKey && (event.key === "t" || event.key === "T")) {
        event.preventDefault();
        dispatch({ type: "createDoc" });
        return;
      }
      if (event.ctrlKey && (event.key === "w" || event.key === "W")) {
        event.preventDefault();
        dispatch({ type: "requestCloseActiveDoc" });
        return;
      }

      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        if (event.shiftKey) {
          dispatch({ type: "switchDocPrev" });
        } else {
          dispatch({ type: "switchDocNext" });
        }
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        dispatch({ type: "addChildAndInsert" });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        dispatch({ type: "addSiblingAndInsert" });
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "commitInsert" });
        return;
      }

      if (event.key === "i") {
        event.preventDefault();
        dispatch({ type: "enterInsert" });
        return;
      }

      if (event.key === "h") {
        event.preventDefault();
        dispatch({ type: "moveCursor", direction: "parent" });
        return;
      }
      if (event.key === "l") {
        event.preventDefault();
        dispatch({ type: "moveCursor", direction: "child" });
        return;
      }
      if (event.key === "j") {
        event.preventDefault();
        dispatch({ type: "moveCursor", direction: "nextSibling" });
        return;
      }
      if (event.key === "k") {
        event.preventDefault();
        dispatch({ type: "moveCursor", direction: "prevSibling" });
        return;
      }
      if (event.key === "J") {
        event.preventDefault();
        dispatch({ type: "swapSibling", direction: "down" });
        return;
      }
      if (event.key === "K") {
        event.preventDefault();
        dispatch({ type: "swapSibling", direction: "up" });
        return;
      }

      if (event.key === "u") {
        event.preventDefault();
        dispatch({ type: "undo" });
        return;
      }
      if (event.ctrlKey && event.key === "r") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [helpOpen, state.closeConfirmDocId, state.hydrated, state.mode]);

  if (!state.hydrated) {
    return (
      <div className="appRoot">
        <div className="loading">Loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="appRoot">
      <TabBar
        tabs={state.workspace.tabs}
        activeDocId={state.workspace.activeDocId}
        documents={state.workspace.documents}
        mode={state.mode}
        disabled={state.closeConfirmDocId !== null}
        onSelect={(docId) => dispatch({ type: "setActiveDoc", docId })}
        onNew={() => dispatch({ type: "createDoc" })}
        theme={theme}
        onCycleTheme={() => setTheme((t) => cycleTheme(t))}
      />
      <div
        className="editorViewport"
        ref={viewportRef}
        onMouseDown={() => viewportRef.current?.focus()}
        tabIndex={0}
      >
        <EditorView
          doc={activeDoc}
          mode={state.mode}
          disabled={state.closeConfirmDocId !== null}
          onSelectNode={(nodeId) => dispatch({ type: "selectNode", nodeId })}
          onChangeText={(text) => dispatch({ type: "setCursorText", text })}
          onEsc={() => dispatch({ type: "commitInsert" })}
        />
        {state.closeConfirmDocId ? (
          <div className="modalOverlay" onMouseDown={(e) => e.preventDefault()}>
            <div className="modal">
              <div className="modalTitle">タブを閉じますか？</div>
              <div className="modalBody">y: 閉じる / n: キャンセル</div>
              <div className="modalActions">
                <button
                  type="button"
                  className="modalButton modalButtonDanger"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    dispatch({ type: "closeActiveDoc" });
                  }}
                >
                  閉じる (y)
                </button>
                <button
                  type="button"
                  className="modalButton"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    dispatch({ type: "cancelCloseConfirm" });
                  }}
                >
                  キャンセル (n)
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {helpOpen ? (
          <div
            className="modalOverlay"
            onMouseDown={(e) => {
              e.preventDefault();
              setHelpOpen(false);
            }}
          >
            <div
              className="modal helpModal"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
            >
              <div className="modalTitle">Help</div>
              <div className="modalBody">
                <div className="helpGrid">
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>Tab</kbd>
                    </div>
                    <div className="helpDesc">Add child (and edit)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>Enter</kbd>
                    </div>
                    <div className="helpDesc">Add sibling (and edit)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>i</kbd> / <kbd>Esc</kbd>
                    </div>
                    <div className="helpDesc">Insert / Commit (back to Normal)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>h</kbd>
                      <kbd>j</kbd>
                      <kbd>k</kbd>
                      <kbd>l</kbd>
                    </div>
                    <div className="helpDesc">Move (parent / next / prev / child)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>J</kbd> / <kbd>K</kbd>
                    </div>
                    <div className="helpDesc">Swap siblings (down / up)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>dd</kbd>
                    </div>
                    <div className="helpDesc">Delete (root is protected)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>u</kbd> / <kbd>Ctrl</kbd>+<kbd>r</kbd>
                    </div>
                    <div className="helpDesc">Undo / Redo</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>Ctrl</kbd>+<kbd>T</kbd> / <kbd>Ctrl</kbd>+<kbd>W</kbd>
                    </div>
                    <div className="helpDesc">New tab / Close tab</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">
                      <kbd>Ctrl</kbd>+<kbd>Tab</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Tab</kbd>
                    </div>
                    <div className="helpDesc">Switch tab (next / prev)</div>
                  </div>
                  <div className="helpRow">
                    <div className="helpKeys">Theme</div>
                    <div className="helpDesc">Cycle on the top right (Dark/Light/Tokyo Night)</div>
                  </div>
                </div>
              </div>

              <div className="modalActions">
                <button
                  type="button"
                  className="modalButton"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setHelpOpen(false);
                  }}
                >
                  Close (Esc)
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="statusBar">
        <div className="statusLeft">
          <span className="statusLabel">Mode</span>
          <span
            className={
              "statusPill " + (state.mode === "insert" ? "statusPillInsert" : "statusPillNormal")
            }
          >
            {modeLabel}
          </span>
          <span className="statusDot">•</span>
          <span className="statusLabel">Doc</span>
          <span className="statusValue">
            {activeTabIndex + 1}/{state.workspace.tabs.length}
          </span>
        </div>
        <div className="statusRight">
          <button
            type="button"
            className="statusHelpButton"
            onMouseDown={(e) => {
              e.preventDefault();
              setHelpOpen(true);
            }}
          >
            ? Help
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
