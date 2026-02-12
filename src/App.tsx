import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./App.css";
import { EditorView } from "./editor/EditorView";
import { TabBar } from "./editor/TabBar";
import { createInitialAppState, editorReducer } from "./editor/state";
import type { NodeColor } from "./editor/types";
import {
  buildJumpSession,
  resolveJumpKey,
  type JumpSession,
} from "./features/jump/model";
import { filterPaletteCommands, type PaletteCommand } from "./features/palette/model";
import { buildSearchResults } from "./features/search/model";
import { useTheme } from "./hooks/useTheme";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useZoomPan } from "./hooks/useZoomPan";
import { CloseConfirmModal } from "./ui/modals/CloseConfirmModal";
import { CommandPaletteModal } from "./ui/modals/CommandPaletteModal";
import { HelpModal } from "./ui/modals/HelpModal";
import { NodeColorModal } from "./ui/modals/NodeColorModal";
import { SearchModal } from "./ui/modals/SearchModal";

import { clamp } from "./utils/number";

const COLOR_SHORTCUTS: Record<string, NodeColor> = {
  "1": "blue",
  "2": "green",
  "3": "yellow",
  "4": "pink",
  "5": "gray",
};

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialAppState);
  const { theme, cycleTheme } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [nodeColorOpen, setNodeColorOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pendingDRef = useRef(false);
  const pendingDTimerRef = useRef<number | null>(null);
  const [jumpSession, setJumpSession] = useState<JumpSession | null>(null);
  const [jumpPrefix, setJumpPrefix] = useState("");

  const activeDoc = state.workspace.documents[state.workspace.activeDocId];
  const jumpActive = jumpSession !== null;

  const closeJump = useCallback(() => {
    setJumpSession(null);
    setJumpPrefix("");
  }, []);

  const openJump = useCallback(() => {
    const session = buildJumpSession(activeDoc);
    if (Object.keys(session.hintToNode).length === 0) return;
    setJumpSession(session);
    setJumpPrefix("");
  }, [activeDoc]);

  const handleJumpKey = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!jumpSession) return false;

      const resolution = resolveJumpKey({
        session: jumpSession,
        prefix: jumpPrefix,
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      });

      event.preventDefault();

      if (resolution.type === "keep") {
        return true;
      }

      if (resolution.type === "cancel") {
        closeJump();
        return true;
      }

      if (resolution.type === "setPrefix") {
        setJumpPrefix(resolution.prefix);
        return true;
      }

      closeJump();
      dispatch({ type: "selectNode", nodeId: resolution.nodeId });
      return true;
    },
    [closeJump, dispatch, jumpPrefix, jumpSession],
  );

  const zoomPan = useZoomPan({
    activeDocId: state.workspace.activeDocId,
    mode: state.mode,
    disabled:
      helpOpen ||
      searchOpen ||
      paletteOpen ||
      nodeColorOpen ||
      state.closeConfirmDocId !== null ||
      jumpActive,
    viewportRef,
  });
  const activeTabIndex = useMemo(() => {
    return state.workspace.tabs.findIndex(
      (tab) => tab.docId === state.workspace.activeDocId,
    );
  }, [state.workspace.activeDocId, state.workspace.tabs]);

  const modeLabel = state.mode === "insert" ? "INSERT" : "NORMAL";

  const searchResults = useMemo(() => {
    return buildSearchResults(activeDoc, searchQuery);
  }, [activeDoc.nodes, searchQuery]);

  const activeSearchNodeId =
    searchResults.length > 0 ? searchResults[searchIndex]?.nodeId ?? null : null;

  const highlightedNodeIds = useMemo(() => {
    if (!searchOpen) return null;
    if (searchResults.length === 0) return null;
    return new Set(searchResults.map((r) => r.nodeId));
  }, [searchOpen, searchResults]);

  const paletteItems = useMemo(() => {
    const commands: PaletteCommand[] = [
      {
        id: "new-tab",
        title: "New tab",
        subtitle: "Ctrl+T",
        run: () => dispatch({ type: "createDoc" }),
      },
      {
        id: "close-tab",
        title: "Close tab",
        subtitle: "Ctrl+W",
        run: () => dispatch({ type: "requestCloseActiveDoc" }),
      },
      {
        id: "search",
        title: "Search",
        subtitle: "Ctrl+F",
        run: () => {
          setSearchOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "help",
        title: "Help",
        subtitle: "?",
        run: () => {
          setHelpOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "move-node-left",
        title: "Move node left",
        subtitle: "Shift+H (outdent)",
        run: () => dispatch({ type: "reparentNode", direction: "left" }),
      },
      {
        id: "move-node-right",
        title: "Move node right",
        subtitle: "Shift+L (indent)",
        run: () => dispatch({ type: "reparentNode", direction: "right" }),
      },
      {
        id: "cycle-theme",
        title: "Cycle theme",
        subtitle: "Theme button",
        run: () => cycleTheme(),
      },
    ];

    return filterPaletteCommands(commands, paletteQuery);
  }, [cycleTheme, dispatch, paletteQuery]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, state.workspace.activeDocId]);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery]);

  useEffect(() => {
    if (!paletteOpen) return;
    setPaletteIndex(0);
  }, [paletteOpen]);

  useEffect(() => {
    setPaletteIndex((idx) => {
      if (paletteItems.length === 0) return 0;
      return clamp(idx, 0, paletteItems.length - 1);
    });
  }, [paletteItems.length]);

  useEffect(() => {
    setSearchIndex((idx) => {
      if (searchResults.length === 0) return 0;
      return clamp(idx, 0, searchResults.length - 1);
    });
  }, [searchResults.length]);

  const paletteItemsForModal = useMemo(() => {
    return paletteItems.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle }));
  }, [paletteItems]);

  useEffect(() => {
    if (state.mode === "insert") {
      setSearchOpen(false);
      setPaletteOpen(false);
      setNodeColorOpen(false);
      closeJump();
    }
  }, [closeJump, state.mode]);

  useEffect(() => {
    closeJump();
  }, [closeJump, state.workspace.activeDocId]);

  useEffect(() => {
    if (!jumpSession) return;
    if (
      state.mode !== "normal" ||
      helpOpen ||
      searchOpen ||
      paletteOpen ||
      nodeColorOpen ||
      state.closeConfirmDocId !== null
    ) {
      closeJump();
    }
  }, [
    closeJump,
    helpOpen,
    jumpSession,
    nodeColorOpen,
    paletteOpen,
    searchOpen,
    state.closeConfirmDocId,
    state.mode,
  ]);

  const { saveLabel, saveStatus } = useWorkspacePersistence({
    hydrated: state.hydrated,
    saveRevision: state.saveRevision,
    workspace: state.workspace,
    dispatch,
  });

  const moveSearch = (delta: number) => {
    if (searchResults.length === 0) return;
    const currentIndex = searchResults.findIndex((r) => r.nodeId === activeDoc.cursorId);
    const len = searchResults.length;
    let nextIndex = 0;
    if (currentIndex === -1) {
      nextIndex = delta >= 0 ? 0 : len - 1;
    } else {
      nextIndex = (currentIndex + delta + len) % len;
    }
    const nodeId = searchResults[nextIndex]?.nodeId;
    if (!nodeId) return;
    setSearchIndex(nextIndex);
    dispatch({ type: "selectNode", nodeId });
  };

  const runPaletteSelected = () => {
    const item = paletteItems[paletteIndex];
    if (!item) return;
    setPaletteOpen(false);
    setPaletteQuery("");
    item.run();
  };

  useEffect(() => {
    if (state.mode === "normal") {
      viewportRef.current?.focus();
    }
  }, [state.mode, state.workspace.activeDocId]);

  useEffect(() => {
    return () => {
      if (pendingDTimerRef.current !== null) {
        window.clearTimeout(pendingDTimerRef.current);
      }
    };
  }, []);

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

      if (searchOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setSearchOpen(false);
          return;
        }

        if (event.ctrlKey && (event.key === "w" || event.key === "t" || event.key === "Tab")) {
          event.preventDefault();
        }
        return;
      }

      if (paletteOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setPaletteOpen(false);
          return;
        }

        if (event.ctrlKey && (event.key === "w" || event.key === "t" || event.key === "Tab")) {
          event.preventDefault();
        }
        return;
      }

      if (nodeColorOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setNodeColorOpen(false);
          return;
        }

        if (event.key === "0") {
          event.preventDefault();
          dispatch({ type: "setCursorColor", color: null });
          setNodeColorOpen(false);
          return;
        }

        const color = COLOR_SHORTCUTS[event.key];
        if (color) {
          event.preventDefault();
          dispatch({ type: "setCursorColor", color });
          setNodeColorOpen(false);
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

      if (handleJumpKey(event)) {
        return;
      }

      if (state.mode === "normal" && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (state.mode === "normal" && event.ctrlKey && (event.key === "f" || event.key === "F")) {
        event.preventDefault();
        setSearchOpen(true);
        setPaletteOpen(false);
        return;
      }

      if (state.mode === "normal" && event.ctrlKey && (event.key === "p" || event.key === "P")) {
        event.preventDefault();
        setPaletteQuery("");
        setPaletteIndex(0);
        setPaletteOpen(true);
        setSearchOpen(false);
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

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "c") {
        event.preventDefault();
        setNodeColorOpen(true);
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

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openJump();
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
      if (event.key === "H") {
        event.preventDefault();
        dispatch({ type: "reparentNode", direction: "left" });
        return;
      }
      if (event.key === "L") {
        event.preventDefault();
        dispatch({ type: "reparentNode", direction: "right" });
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
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleJumpKey,
    closeJump,
    helpOpen,
    nodeColorOpen,
    openJump,
    paletteOpen,
    searchOpen,
    state.closeConfirmDocId,
    state.hydrated,
    state.mode,
  ]);

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
        onCycleTheme={() => cycleTheme()}
      />
      <div
        className={zoomPan.viewportClassName}
        ref={viewportRef}
        onMouseDown={zoomPan.onViewportMouseDown}
        onWheel={zoomPan.onViewportWheel}
        tabIndex={0}
      >
        <EditorView
          doc={activeDoc}
          mode={state.mode}
          disabled={state.closeConfirmDocId !== null || jumpActive}
          zoom={zoomPan.zoom}
          panGestureActive={zoomPan.panGestureActive}
          highlightedNodeIds={highlightedNodeIds}
          activeHighlightedNodeId={activeSearchNodeId}
          jumpHints={jumpSession?.nodeToHint ?? null}
          jumpPrefix={jumpPrefix}
          onSelectNode={(nodeId) => dispatch({ type: "selectNode", nodeId })}
          onChangeText={(text) => dispatch({ type: "setCursorText", text })}
          onEnterContinue={() => dispatch({ type: "commitInsertAndContinue" })}
          onEnterCommit={() => dispatch({ type: "commitInsert" })}
          onEsc={() => dispatch({ type: "commitInsert" })}
        />
        <CloseConfirmModal
          open={state.closeConfirmDocId !== null}
          onConfirm={() => dispatch({ type: "closeActiveDoc" })}
          onCancel={() => dispatch({ type: "cancelCloseConfirm" })}
        />
        <SearchModal
          open={searchOpen}
          query={searchQuery}
          results={searchResults.map((r) => ({ nodeId: r.nodeId, title: r.title, subtitle: r.subtitle }))}
          activeIndex={searchIndex}
          activeNodeId={activeSearchNodeId}
          onChangeQuery={setSearchQuery}
          onSelectNode={(nodeId) => {
            const nextIndex = searchResults.findIndex((r) => r.nodeId === nodeId);
            if (nextIndex >= 0) setSearchIndex(nextIndex);
            dispatch({ type: "selectNode", nodeId });
          }}
          onMoveNext={() => moveSearch(1)}
          onMovePrev={() => moveSearch(-1)}
          onClose={() => setSearchOpen(false)}
        />
        <CommandPaletteModal
          open={paletteOpen}
          query={paletteQuery}
          items={paletteItemsForModal}
          activeIndex={paletteIndex}
          onChangeQuery={setPaletteQuery}
          onMoveIndex={setPaletteIndex}
          onRunActive={runPaletteSelected}
          onRunItem={(id) => {
            const item = paletteItems.find((x) => x.id === id);
            if (!item) return;
            setPaletteOpen(false);
            setPaletteQuery("");
            item.run();
          }}
          onClose={() => setPaletteOpen(false)}
        />
        <NodeColorModal
          open={nodeColorOpen}
          activeColor={activeDoc.nodes[activeDoc.cursorId]?.color ?? null}
          onApplyColor={(color) => {
            dispatch({ type: "setCursorColor", color });
            setNodeColorOpen(false);
          }}
          onClear={() => {
            dispatch({ type: "setCursorColor", color: null });
            setNodeColorOpen(false);
          }}
          onClose={() => setNodeColorOpen(false)}
        />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
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
          <span className="statusDot">•</span>
          <span className="statusLabel">Save</span>
          <span className={"statusValue " + (saveStatus === "saving" ? "statusValueSaving" : "")}>
            {saveLabel}
          </span>
          {jumpActive ? (
            <>
              <span className="statusDot">•</span>
              <span className="statusLabel">Jump</span>
              <span className="statusPill statusPillJump">{jumpPrefix || "..."}</span>
            </>
          ) : null}
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
