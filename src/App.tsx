import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./App.scss";
import { executeKeyboardCommand } from "./app/keyboard/executeKeyboardCommand";
import { resolveKeyboardCommand } from "./app/keyboard/resolveKeyboardCommand";
import { useDeleteChord } from "./app/keyboard/useDeleteChord";
import { useEditorUiSession } from "./app/session/useEditorUiSession";
import { EditorView } from "./editor/EditorView";
import { TabBar } from "./editor/TabBar";
import { createInitialAppState, editorReducer } from "./editor/state";
import type { DocumentState } from "./editor/types";
import { buildJumpSession } from "./features/jump/model";
import {
  applyImproveOperationsToDocument,
  buildDocumentStateFromGeneratedTree,
  documentToImproveDocumentState,
} from "./features/llm/apply";
import { buildImprovePreview, type LlmImprovePreview } from "./features/llm/preview";
import {
  parseGenerateRequest,
  parseGenerateResponse,
  parseAndValidateImproveResponse,
  parseImproveRequest,
  type GenerateRequest,
  type ImproveRequest,
} from "./features/llm/schema";
import { parseErrorMessage, runLlmGenerate, runLlmImprove } from "./features/llm/settingsRepository";
import { filterPaletteCommands, type PaletteCommand } from "./features/palette/model";
import { buildSearchResults } from "./features/search/model";
import { useTheme } from "./hooks/useTheme";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useZoomPan } from "./hooks/useZoomPan";
import { createTauriWorkspaceRepository } from "./persistence";
import { CloseConfirmModal } from "./ui/modals/CloseConfirmModal";
import { CommandPaletteModal } from "./ui/modals/CommandPaletteModal";
import { HelpModal } from "./ui/modals/HelpModal";
import { LlmAssistModal, type LlmAssistMode } from "./ui/modals/LlmAssistModal";
import { LlmSettingsModal } from "./ui/modals/LlmSettingsModal";
import { NodeColorModal } from "./ui/modals/NodeColorModal";
import { SearchModal } from "./ui/modals/SearchModal";
import { clamp } from "./utils/number";

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialAppState);
  const { theme, cycleTheme } = useTheme();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { reset: resetDeleteChord, consumeD: consumeDeleteChord } = useDeleteChord();

  const {
    helpOpen,
    setHelpOpen,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchIndex,
    setSearchIndex,
    paletteOpen,
    setPaletteOpen,
    paletteQuery,
    setPaletteQuery,
    paletteIndex,
    setPaletteIndex,
    nodeColorOpen,
    setNodeColorOpen,
    llmSettingsOpen,
    setLlmSettingsOpen,
    llmAssistOpen,
    setLlmAssistOpen,
    jumpSession,
    setJumpSession,
    jumpPrefix,
    setJumpPrefix,
    jumpActive,
    closeJump,
    closeAllTransientPanels,
  } = useEditorUiSession();

  const activeDoc = state.workspace.documents[state.workspace.activeDocId];
  const closeConfirmOpen = state.closeConfirmDocId !== null;
  const [llmAssistMode, setLlmAssistMode] = useState<LlmAssistMode>("generate");
  const [llmAssistRunning, setLlmAssistRunning] = useState(false);
  const [llmAssistError, setLlmAssistError] = useState<string | null>(null);
  const [pendingImproveApply, setPendingImproveApply] = useState<{
    docId: string;
    nextState: DocumentState;
    preview: LlmImprovePreview;
  } | null>(null);

  const openJump = useCallback(() => {
    const session = buildJumpSession(activeDoc);
    if (Object.keys(session.hintToNode).length === 0) return;
    setJumpSession(session);
    setJumpPrefix("");
  }, [activeDoc, setJumpPrefix, setJumpSession]);

  const zoomPan = useZoomPan({
    activeDocId: state.workspace.activeDocId,
    mode: state.mode,
    disabled:
      helpOpen ||
      searchOpen ||
      paletteOpen ||
      nodeColorOpen ||
      llmSettingsOpen ||
      llmAssistOpen ||
      closeConfirmOpen ||
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

  const formatValidationErrors = (errors: string[]): string => {
    return errors.slice(0, 3).join("\n");
  };

  const clearImprovePreview = useCallback(() => {
    setPendingImproveApply(null);
  }, []);

  const applyImprovePreview = useCallback(() => {
    if (!pendingImproveApply) return;
    dispatch({
      type: "applyDocumentState",
      docId: pendingImproveApply.docId,
      nextState: pendingImproveApply.nextState,
    });
    setPendingImproveApply(null);
    setLlmAssistOpen(false);
  }, [dispatch, pendingImproveApply, setLlmAssistOpen]);

  const runLlmAssist = useCallback(
    async (input: string) => {
      const docId = state.workspace.activeDocId;
      const doc = state.workspace.documents[docId];
      if (!doc) {
        setLlmAssistError("アクティブドキュメントが見つかりません。");
        return;
      }

      setLlmAssistRunning(true);
      setLlmAssistError(null);
      if (llmAssistMode === "improve") {
        setPendingImproveApply(null);
      }
      try {
        if (llmAssistMode === "generate") {
          const request: GenerateRequest = {
            version: "1",
            mode: "generate",
            topic: input,
            language: "ja",
            maxDepth: 4,
            maxChildrenPerNode: 6,
            style: "balanced",
            constraints: {
              avoidAbstractOnly: true,
              preferActionable: true,
            },
          };
          const parsedRequest = parseGenerateRequest(request);
          if (!parsedRequest.ok) {
            throw new Error(formatValidationErrors(parsedRequest.errors));
          }
          const rawResponse = await runLlmGenerate(parsedRequest.value);
          const parsedResponse = parseGenerateResponse(rawResponse);
          if (!parsedResponse.ok) {
            throw new Error(formatValidationErrors(parsedResponse.errors));
          }

          const nextState = buildDocumentStateFromGeneratedTree(parsedResponse.value.root);
          dispatch({ type: "applyDocumentState", docId, nextState });
          setPendingImproveApply(null);
          setLlmAssistOpen(false);
          return;
        }

        const improveDocument = documentToImproveDocumentState(doc);
        const request: ImproveRequest = {
          version: "1",
          mode: "improve",
          goal: input,
          document: improveDocument,
          constraints: {
            maxAdditions: 20,
            keepExistingText: true,
            allowReparent: true,
            allowDelete: true,
          },
        };
        const parsedRequest = parseImproveRequest(request);
        if (!parsedRequest.ok) {
          throw new Error(formatValidationErrors(parsedRequest.errors));
        }

        const rawResponse = await runLlmImprove(parsedRequest.value);
        const parsedResponse = parseAndValidateImproveResponse(rawResponse, improveDocument);
        if (!parsedResponse.ok) {
          throw new Error(formatValidationErrors(parsedResponse.errors));
        }

        const applied = applyImproveOperationsToDocument(
          improveDocument,
          parsedResponse.value.operations,
        );
        if (!applied.ok) {
          throw new Error(formatValidationErrors(applied.errors));
        }

        const preview = buildImprovePreview(
          parsedResponse.value.summary,
          parsedResponse.value.warnings,
          parsedResponse.value.operations,
          improveDocument,
        );
        setPendingImproveApply({
          docId,
          nextState: applied.value,
          preview,
        });
      } catch (error) {
        setLlmAssistError(parseErrorMessage(error));
      } finally {
        setLlmAssistRunning(false);
      }
    },
    [
      dispatch,
      llmAssistMode,
      setLlmAssistOpen,
      state.workspace.activeDocId,
      state.workspace.documents,
    ],
  );

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
        id: "llm-settings",
        title: "LLM settings",
        subtitle: "Gemini API key / model",
        run: () => {
          setLlmSettingsOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "llm-generate",
        title: "LLM generate map",
        subtitle: "Replace current map from a topic",
        run: () => {
          setLlmAssistMode("generate");
          setLlmAssistOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "llm-improve",
        title: "LLM improve map",
        subtitle: "Apply improvement diff to current map",
        run: () => {
          setLlmAssistMode("improve");
          setLlmAssistOpen(true);
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
  }, [
    cycleTheme,
    dispatch,
    paletteQuery,
    setHelpOpen,
    setLlmAssistMode,
    setLlmAssistOpen,
    setLlmSettingsOpen,
    setPaletteOpen,
    setSearchOpen,
  ]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, setSearchIndex, state.workspace.activeDocId]);

  useEffect(() => {
    if (!llmAssistOpen) {
      setLlmAssistError(null);
      setLlmAssistRunning(false);
      setPendingImproveApply(null);
    }
    if (llmAssistMode !== "improve") {
      setPendingImproveApply(null);
    }
  }, [llmAssistOpen, llmAssistMode]);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery, setPaletteIndex]);

  useEffect(() => {
    if (!paletteOpen) return;
    setPaletteIndex(0);
  }, [paletteOpen, setPaletteIndex]);

  useEffect(() => {
    setPaletteIndex((idx) => {
      if (paletteItems.length === 0) return 0;
      return clamp(idx, 0, paletteItems.length - 1);
    });
  }, [paletteItems.length, setPaletteIndex]);

  useEffect(() => {
    setSearchIndex((idx) => {
      if (searchResults.length === 0) return 0;
      return clamp(idx, 0, searchResults.length - 1);
    });
  }, [searchResults.length, setSearchIndex]);

  const paletteItemsForModal = useMemo(() => {
    return paletteItems.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle }));
  }, [paletteItems]);

  useEffect(() => {
    if (state.mode === "insert") {
      closeAllTransientPanels();
    }
  }, [closeAllTransientPanels, state.mode]);

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
      llmSettingsOpen ||
      llmAssistOpen ||
      closeConfirmOpen
    ) {
      closeJump();
    }
  }, [
    closeJump,
    closeConfirmOpen,
    helpOpen,
    jumpSession,
    llmSettingsOpen,
    llmAssistOpen,
    nodeColorOpen,
    paletteOpen,
    searchOpen,
    state.mode,
  ]);

  const workspaceRepository = useMemo(() => createTauriWorkspaceRepository(), []);

  const { saveLabel, saveStatus } = useWorkspacePersistence({
    hydrated: state.hydrated,
    saveRevision: state.saveRevision,
    workspace: state.workspace,
    dispatch,
    repository: workspaceRepository,
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!state.hydrated) return;

      const commandLayerActive =
        state.mode === "normal" &&
        !helpOpen &&
        !searchOpen &&
        !paletteOpen &&
        !nodeColorOpen &&
        !llmSettingsOpen &&
        !llmAssistOpen &&
        !closeConfirmOpen &&
        !jumpActive;

      if (state.mode === "insert") {
        resetDeleteChord();
      }

      if (commandLayerActive && event.key !== "d") {
        resetDeleteChord();
      }

      if (commandLayerActive && event.key === "d") {
        event.preventDefault();
        if (consumeDeleteChord()) {
          dispatch({ type: "deleteNode" });
        }
        return;
      }

      const resolution = resolveKeyboardCommand(
        {
          mode: state.mode,
          helpOpen,
          searchOpen,
          paletteOpen,
          nodeColorOpen,
          llmSettingsOpen,
          llmAssistOpen,
          closeConfirmOpen,
          jumpSession,
          jumpPrefix,
        },
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
        },
      );

      if (resolution.command.type === "none" && !resolution.preventDefault) {
        return;
      }

      if (resolution.preventDefault) {
        event.preventDefault();
      }

      executeKeyboardCommand(resolution.command, {
        dispatch,
        setHelpOpen,
        setSearchOpen,
        setPaletteOpen,
        setPaletteQuery,
        setPaletteIndex,
        setNodeColorOpen,
        setLlmSettingsOpen,
        setLlmAssistOpen,
        setJumpPrefix,
        openJump,
        closeJump,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeConfirmOpen,
    closeJump,
    consumeDeleteChord,
    dispatch,
    helpOpen,
    jumpActive,
    jumpPrefix,
    jumpSession,
    nodeColorOpen,
    llmSettingsOpen,
    llmAssistOpen,
    openJump,
    paletteOpen,
    searchOpen,
    setHelpOpen,
    setJumpPrefix,
    setNodeColorOpen,
    setLlmSettingsOpen,
    setLlmAssistOpen,
    setPaletteIndex,
    setPaletteOpen,
    setPaletteQuery,
    setSearchOpen,
    state.hydrated,
    state.mode,
    resetDeleteChord,
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
        disabled={closeConfirmOpen}
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
          disabled={closeConfirmOpen || jumpActive}
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
          open={closeConfirmOpen}
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
        <LlmAssistModal
          open={llmAssistOpen}
          mode={llmAssistMode}
          running={llmAssistRunning}
          errorMessage={llmAssistError}
          improvePreview={llmAssistMode === "improve" ? pendingImproveApply?.preview ?? null : null}
          onChangeMode={setLlmAssistMode}
          onRun={runLlmAssist}
          onApplyImprovePreview={applyImprovePreview}
          onClearImprovePreview={clearImprovePreview}
          onClose={() => setLlmAssistOpen(false)}
        />
        <LlmSettingsModal open={llmSettingsOpen} onClose={() => setLlmSettingsOpen(false)} />
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
              setLlmAssistMode("generate");
              setLlmAssistOpen(true);
            }}
          >
            AI
          </button>
          <button
            type="button"
            className="statusHelpButton"
            onMouseDown={(e) => {
              e.preventDefault();
              setLlmSettingsOpen(true);
            }}
          >
            LLM
          </button>
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
