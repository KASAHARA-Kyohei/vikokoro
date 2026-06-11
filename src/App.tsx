import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./App.scss";
import { executeKeyboardCommand } from "./app/keyboard/executeKeyboardCommand";
import { resolveKeyboardCommand } from "./app/keyboard/resolveKeyboardCommand";
import { useDeleteChord } from "./app/keyboard/useDeleteChord";
import { useFoldChord } from "./app/keyboard/useFoldChord";
import { useEditorUiSession } from "./app/session/useEditorUiSession";
import { EditorView } from "./editor/EditorView";
import { TabBar } from "./editor/TabBar";
import { makeEdgeKey } from "./editor/domain/edgeAnchors";
import { createInitialAppState, editorReducer } from "./editor/state";
import type { AnchorSide, Document, DocumentState, NodeId } from "./editor/types";
import {
  buildVisibleTreeProjection,
  getBreadcrumbNodeIds,
} from "./editor/domain/visibleTree";
import { buildJumpSession } from "./features/jump/model";
import {
  applyImproveOperationsToDocument,
  buildDocumentStateFromGeneratedTree,
  documentToImproveDocumentState,
} from "./features/llm/apply";
import {
  buildImprovePreview,
  buildReviewResult,
  type LlmImprovePreview,
  type LlmReviewResult,
} from "./features/llm/preview";
import {
  formatLlmDocumentIntegrityError,
  formatLlmResponseValidationError,
  formatLlmRuntimeError,
  formatLlmValidationErrors,
} from "./features/llm/errorFormatter";
import {
  parseGenerateRequest,
  parseGenerateResponse,
  parseAndValidateImproveResponse,
  parseAndValidateReviewResponse,
  parseImproveRequest,
  parseReviewRequest,
  validateLlmDocumentState,
  type GenerateRequest,
  type ImproveRequest,
  type ReviewRequest,
} from "./features/llm/schema";
import {
  parseErrorMessage,
  runLlmGenerate,
  runLlmImprove,
  runLlmReview,
} from "./features/llm/settingsRepository";
import { filterPaletteCommands, type PaletteCommand } from "./features/palette/model";
import { buildSearchResults } from "./features/search/model";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useZoomPan } from "./hooks/useZoomPan";
import { APP_TEXT, getAiRunningLabel, getModeLabel, getSaveStatusLabel } from "./i18n/uiText";
import { createTauriWorkspaceRepository } from "./persistence";
import { CloseConfirmModal } from "./ui/modals/CloseConfirmModal";
import { CommandPaletteModal } from "./ui/modals/CommandPaletteModal";
import { HelpModal } from "./ui/modals/HelpModal";
import { LlmAssistModal, type LlmAssistMode } from "./ui/modals/LlmAssistModal";
import { NodeColorModal } from "./ui/modals/NodeColorModal";
import { NodeMemoModal } from "./ui/modals/NodeMemoModal";
import { SearchModal } from "./ui/modals/SearchModal";
import { SettingsModal } from "./ui/modals/SettingsModal";
import { clamp } from "./utils/number";

function App() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialAppState);
  const { theme, setTheme, language, setLanguage } = useAppPreferences();
  const text = APP_TEXT[language];
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { reset: resetDeleteChord, consumeD: consumeDeleteChord } = useDeleteChord();
  const { reset: resetFoldChord, consume: consumeFoldChord } = useFoldChord();

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
    nodeMemoOpen,
    setNodeMemoOpen,
    settingsOpen,
    setSettingsOpen,
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
  const visibleProjection = useMemo(
    () => buildVisibleTreeProjection(activeDoc, state.focusRootId),
    [activeDoc, state.focusRootId],
  );
  const visibleDoc = useMemo<Document>(
    () => ({ ...activeDoc, ...visibleProjection.state }),
    [activeDoc, visibleProjection.state],
  );
  const collapsibleNodeIds = useMemo(() => {
    const ids = new Set<NodeId>();
    for (const nodeId of visibleProjection.visibleNodeIds) {
      if (activeDoc.nodes[nodeId]?.childrenIds.length) ids.add(nodeId);
    }
    return ids;
  }, [activeDoc.nodes, visibleProjection.visibleNodeIds]);
  const collapsedNodeIds = useMemo(
    () => new Set(activeDoc.collapsedNodeIds),
    [activeDoc.collapsedNodeIds],
  );
  const focusBreadcrumbIds = useMemo(
    () =>
      state.focusRootId
        ? getBreadcrumbNodeIds(activeDoc, state.focusRootId)
        : [],
    [activeDoc, state.focusRootId],
  );
  const closeConfirmOpen = state.closeConfirmDocId !== null;
  const [llmAssistMode, setLlmAssistMode] = useState<LlmAssistMode>("generate");
  const [llmAssistRunning, setLlmAssistRunning] = useState(false);
  const [llmAssistError, setLlmAssistError] = useState<string | null>(null);
  const [pendingImproveApply, setPendingImproveApply] = useState<{
    docId: string;
    nextState: DocumentState;
    preview: LlmImprovePreview;
  } | null>(null);
  const [reviewResult, setReviewResult] = useState<LlmReviewResult | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<NodeId>>(new Set());
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);

  const openJump = useCallback(() => {
    const session = buildJumpSession(visibleDoc);
    if (Object.keys(session.hintToNode).length === 0) return;
    setJumpSession(session);
    setJumpPrefix("");
  }, [setJumpPrefix, setJumpSession, visibleDoc]);

  const zoomPan = useZoomPan({
    activeDocId: state.workspace.activeDocId,
    mode: state.mode,
    disabled:
      helpOpen ||
      searchOpen ||
      paletteOpen ||
      nodeColorOpen ||
      nodeMemoOpen ||
      settingsOpen ||
      llmAssistOpen ||
      closeConfirmOpen ||
      jumpActive,
    viewportRef,
  });

  useEffect(() => {
    setSelectedNodeIds(new Set());
    setSelectedEdgeKey(null);
  }, [state.workspace.activeDocId, state.focusRootId]);

  useEffect(() => {
    if (!selectedEdgeKey) return;
    const exists = Object.values(visibleDoc.nodes).some((node) =>
      node.childrenIds.some((childId) => makeEdgeKey(node.id, childId) === selectedEdgeKey),
    );
    if (!exists) setSelectedEdgeKey(null);
  }, [selectedEdgeKey, visibleDoc.nodes]);

  const changeEdgeAnchor = useCallback(
    (edgeKey: string, endpoint: "from" | "to", side: AnchorSide) => {
      dispatch({ type: "setEdgeAnchor", edgeKey, endpoint, side });
    },
    [],
  );

  const activeTabIndex = useMemo(() => {
    return state.workspace.tabs.findIndex((tab) => tab.docId === state.workspace.activeDocId);
  }, [state.workspace.activeDocId, state.workspace.tabs]);

  const modeLabel = getModeLabel(state.mode, language);

  const searchResults = useMemo(() => {
    return buildSearchResults(activeDoc, searchQuery, language);
  }, [activeDoc, language, searchQuery]);

  const activeSearchNodeId =
    searchResults.length > 0 ? searchResults[searchIndex]?.nodeId ?? null : null;

  const highlightedNodeIds = useMemo(() => {
    if (!searchOpen) return null;
    if (searchResults.length === 0) return null;
    return new Set(searchResults.map((r) => r.nodeId));
  }, [searchOpen, searchResults]);

  const clearImprovePreview = useCallback(() => {
    setPendingImproveApply(null);
  }, []);

  const clearReviewResult = useCallback(() => {
    setReviewResult(null);
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
  }, [pendingImproveApply, setLlmAssistOpen]);

  const runLlmAssist = useCallback(
    async (input: string) => {
      const docId = state.workspace.activeDocId;
      const doc = state.workspace.documents[docId];
      if (!doc) {
        setLlmAssistError(
          language === "ja"
            ? "アクティブドキュメントが見つかりません。"
            : "The active document could not be found.",
        );
        return;
      }

      setLlmAssistRunning(true);
      setLlmAssistError(null);
      if (llmAssistMode === "improve") {
        setPendingImproveApply(null);
      }
      if (llmAssistMode === "review") {
        setReviewResult(null);
      }

      const isRetryableRuntimeError = (message: string) => {
        return (
          message.startsWith("Gemini response was cut off before the JSON finished.") ||
          message.startsWith("Gemini returned invalid JSON:")
        );
      };

      try {
        if (llmAssistMode === "generate") {
          const request: GenerateRequest = {
            version: "1",
            mode: "generate",
            topic: input,
            language,
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
            throw new Error(formatLlmValidationErrors(parsedRequest.errors, language));
          }
          const rawResponse = await runLlmGenerate(parsedRequest.value);
          const parsedResponse = parseGenerateResponse(rawResponse);
          if (!parsedResponse.ok) {
            throw new Error(
              formatLlmResponseValidationError("generate", parsedResponse.errors, language),
            );
          }

          const nextState = buildDocumentStateFromGeneratedTree(parsedResponse.value.root);
          dispatch({ type: "applyDocumentState", docId, nextState });
          setPendingImproveApply(null);
          setLlmAssistOpen(false);
          return;
        }

        const improveDocument = documentToImproveDocumentState(doc);
        const documentErrors = validateLlmDocumentState(improveDocument);
        if (documentErrors.length > 0) {
          throw new Error(formatLlmDocumentIntegrityError(doc, documentErrors, language));
        }

        if (llmAssistMode === "review") {
          const request: ReviewRequest = {
            version: "1",
            mode: "review",
            focus: input,
            document: improveDocument,
            constraints: {
              maxFindings: 6,
              includeStrengths: true,
              includeNextActions: true,
            },
          };
          const parsedRequest = parseReviewRequest(request);
          if (!parsedRequest.ok) {
            throw new Error(formatLlmValidationErrors(parsedRequest.errors, language));
          }

          const rawResponse = await runLlmReview(parsedRequest.value);
          const parsedResponse = parseAndValidateReviewResponse(rawResponse, improveDocument);
          if (!parsedResponse.ok) {
            throw new Error(
              formatLlmResponseValidationError("review", parsedResponse.errors, language),
            );
          }

          setReviewResult(buildReviewResult(parsedResponse.value, improveDocument, language));
          return;
        }

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
          throw new Error(formatLlmValidationErrors(parsedRequest.errors, language));
        }

        const parseImproveWithRetry = async () => {
          let lastErrors: string[] = [];
          for (let attempt = 0; attempt < 2; attempt += 1) {
            let rawResponse: unknown;
            try {
              rawResponse = await runLlmImprove(parsedRequest.value);
            } catch (error) {
              const message = parseErrorMessage(error);
              if (attempt === 0 && isRetryableRuntimeError(message)) {
                continue;
              }
              throw error;
            }
            const parsedResponse = parseAndValidateImproveResponse(rawResponse, improveDocument);
            if (parsedResponse.ok) {
              return parsedResponse.value;
            }
            lastErrors = parsedResponse.errors;
          }
          throw new Error(
            formatLlmResponseValidationError("improve", lastErrors, language),
          );
        };

        const improveResponse = await parseImproveWithRetry();

        const applied = applyImproveOperationsToDocument(
          improveDocument,
          improveResponse.operations,
          doc.nodePositions,
        );
        if (!applied.ok) {
          throw new Error(formatLlmValidationErrors(applied.errors, language));
        }

        const preview = buildImprovePreview(
          improveResponse.summary,
          improveResponse.warnings,
          improveResponse.operations,
          improveDocument,
          language,
        );
        setPendingImproveApply({
          docId,
          nextState: applied.value,
          preview,
        });
      } catch (error) {
        setLlmAssistError(formatLlmRuntimeError(parseErrorMessage(error), language));
      } finally {
        setLlmAssistRunning(false);
      }
    },
    [
      language,
      llmAssistMode,
      setLlmAssistOpen,
      state.workspace.activeDocId,
      state.workspace.documents,
    ],
  );

  const paletteItems = useMemo(() => {
    const paletteText = text.palette;
    const commands: PaletteCommand[] = [
      {
        id: "new-tab",
        title: paletteText.newTabTitle,
        subtitle: paletteText.newTabSubtitle,
        run: () => dispatch({ type: "createDoc" }),
      },
      {
        id: "close-tab",
        title: paletteText.closeTabTitle,
        subtitle: paletteText.closeTabSubtitle,
        run: () => dispatch({ type: "requestCloseActiveDoc" }),
      },
      {
        id: "search",
        title: paletteText.searchTitle,
        subtitle: paletteText.searchSubtitle,
        run: () => {
          setSearchOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "help",
        title: paletteText.helpTitle,
        subtitle: paletteText.helpSubtitle,
        run: () => {
          setHelpOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "settings",
        title: paletteText.settingsTitle,
        subtitle: paletteText.settingsSubtitle,
        run: () => {
          setSettingsOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "llm-generate",
        title: paletteText.aiGenerateTitle,
        subtitle: paletteText.aiGenerateSubtitle,
        run: () => {
          setLlmAssistMode("generate");
          setLlmAssistOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "llm-improve",
        title: paletteText.aiImproveTitle,
        subtitle: paletteText.aiImproveSubtitle,
        run: () => {
          setLlmAssistMode("improve");
          setLlmAssistOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "llm-review",
        title: paletteText.aiReviewTitle,
        subtitle: paletteText.aiReviewSubtitle,
        run: () => {
          setLlmAssistMode("review");
          setLlmAssistOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "move-node-left",
        title: paletteText.moveNodeLeftTitle,
        subtitle: paletteText.moveNodeLeftSubtitle,
        run: () => dispatch({ type: "reparentNode", direction: "left" }),
      },
      {
        id: "move-node-right",
        title: paletteText.moveNodeRightTitle,
        subtitle: paletteText.moveNodeRightSubtitle,
        run: () => dispatch({ type: "reparentNode", direction: "right" }),
      },
      {
        id: "toggle-collapse",
        title: paletteText.toggleCollapseTitle,
        subtitle: "za",
        run: () => dispatch({ type: "toggleNodeCollapsed" }),
      },
      {
        id: "collapse-branch",
        title: paletteText.collapseBranchTitle,
        subtitle: "zc",
        run: () => dispatch({ type: "collapseNode" }),
      },
      {
        id: "expand-branch",
        title: paletteText.expandBranchTitle,
        subtitle: "zo",
        run: () => dispatch({ type: "expandNode" }),
      },
      {
        id: "collapse-all",
        title: paletteText.collapseAllTitle,
        subtitle: "zM",
        run: () => dispatch({ type: "collapseAllVisible" }),
      },
      {
        id: "expand-all",
        title: paletteText.expandAllTitle,
        subtitle: "zR",
        run: () => dispatch({ type: "expandAllVisible" }),
      },
      {
        id: "focus-branch",
        title: paletteText.focusBranchTitle,
        subtitle: "F",
        run: () => dispatch({ type: "enterFocus" }),
      },
      {
        id: "layout-branch",
        title: paletteText.layoutBranchTitle,
        subtitle: "=",
        run: () => dispatch({ type: "autoLayout", scope: "branch" }),
      },
      {
        id: "layout-all",
        title: paletteText.layoutAllTitle,
        subtitle: "+",
        run: () => dispatch({ type: "autoLayout", scope: "all" }),
      },
      ...(selectedEdgeKey
        ? [{
            id: "reset-connector-anchors",
            title: paletteText.resetConnectorAnchorsTitle,
            subtitle: paletteText.resetConnectorAnchorsSubtitle,
            run: () => dispatch({ type: "resetEdgeAnchors" as const, edgeKey: selectedEdgeKey }),
          }]
        : []),
      ...(state.focusRootId
        ? [{
            id: "exit-focus",
            title: paletteText.exitFocusTitle,
            subtitle: "Esc",
            run: () => dispatch({ type: "exitFocus" as const }),
          }]
        : []),
    ];

    return filterPaletteCommands(commands, paletteQuery);
  }, [
    dispatch,
    paletteQuery,
    selectedEdgeKey,
    setHelpOpen,
    setLlmAssistOpen,
    setPaletteOpen,
    setSearchOpen,
    setSettingsOpen,
    state.focusRootId,
    text.palette,
  ]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, setSearchIndex, state.workspace.activeDocId]);

  useEffect(() => {
    if (!llmAssistOpen) {
      setLlmAssistError(null);
      setLlmAssistRunning(false);
      setPendingImproveApply(null);
      setReviewResult(null);
    }
    if (llmAssistMode !== "improve") {
      setPendingImproveApply(null);
    }
    if (llmAssistMode !== "review") {
      setReviewResult(null);
    }
  }, [llmAssistMode, llmAssistOpen]);

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
    return paletteItems.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
    }));
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
      nodeMemoOpen ||
      settingsOpen ||
      llmAssistOpen ||
      closeConfirmOpen
    ) {
      closeJump();
    }
  }, [
    closeConfirmOpen,
    closeJump,
    helpOpen,
    jumpSession,
    llmAssistOpen,
    nodeMemoOpen,
    nodeColorOpen,
    paletteOpen,
    searchOpen,
    settingsOpen,
    state.mode,
  ]);

  const workspaceRepository = useMemo(() => createTauriWorkspaceRepository(), []);

  const { saveStatus } = useWorkspacePersistence({
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
    dispatch({ type: "selectNodeReveal", nodeId });
  };

  const runPaletteSelected = () => {
    const item = paletteItems[paletteIndex];
    if (!item) return;
    setPaletteOpen(false);
    setPaletteQuery("");
    item.run();
  };

  const llmRunningLabel = useMemo(() => {
    if (!llmAssistRunning) return null;
    return getAiRunningLabel(llmAssistMode, language);
  }, [language, llmAssistMode, llmAssistRunning]);

  const saveStatusLabel = getSaveStatusLabel(saveStatus, language);

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
        !nodeMemoOpen &&
        !settingsOpen &&
        !llmAssistOpen &&
        !closeConfirmOpen &&
        !jumpActive;

      if (state.mode === "insert") {
        resetDeleteChord();
        resetFoldChord();
      }

      if (!commandLayerActive) {
        resetFoldChord();
      }

      if (commandLayerActive && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const foldAction = consumeFoldChord(event.key);
        if (foldAction) {
          event.preventDefault();
          if (foldAction === "toggle") dispatch({ type: "toggleNodeCollapsed" });
          if (foldAction === "collapse") dispatch({ type: "collapseNode" });
          if (foldAction === "expand") dispatch({ type: "expandNode" });
          if (foldAction === "collapseAll") dispatch({ type: "collapseAllVisible" });
          if (foldAction === "expandAll") dispatch({ type: "expandAllVisible" });
          return;
        }
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
          nodeMemoOpen,
          settingsOpen,
          llmAssistOpen,
          closeConfirmOpen,
          focusActive: state.focusRootId !== null,
          jumpSession,
          jumpPrefix,
        },
        {
          key: event.key,
          code: event.code,
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
        setNodeMemoOpen,
        setSettingsOpen,
        setLlmAssistOpen,
        setJumpPrefix,
        openJump,
        closeJump,
        nudgeSelection: (dx, dy) => {
          const selected = selectedNodeIds.has(activeDoc.cursorId)
            ? [...selectedNodeIds].filter((id) => Boolean(activeDoc.nodes[id]))
            : [activeDoc.cursorId];
          dispatch({ type: "moveNodes", nodeIds: selected, dx, dy });
        },
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
    consumeFoldChord,
    dispatch,
    helpOpen,
    jumpActive,
    jumpPrefix,
    jumpSession,
    llmAssistOpen,
    nodeMemoOpen,
    nodeColorOpen,
    openJump,
    paletteOpen,
    resetDeleteChord,
    resetFoldChord,
    searchOpen,
    setHelpOpen,
    setJumpPrefix,
    setLlmAssistOpen,
    setNodeMemoOpen,
    setNodeColorOpen,
    setPaletteIndex,
    setPaletteOpen,
    setPaletteQuery,
    setSearchOpen,
    setSettingsOpen,
    settingsOpen,
    state.hydrated,
    state.focusRootId,
    state.mode,
    selectedNodeIds,
    activeDoc,
  ]);

  if (!state.hydrated) {
    return (
      <div className="appRoot">
        <div className="loading">{text.loadingWorkspace}</div>
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
        disabled={closeConfirmOpen || nodeMemoOpen}
        onSelect={(docId) => dispatch({ type: "setActiveDoc", docId })}
        onNew={() => dispatch({ type: "createDoc" })}
        language={language}
      />
      {state.focusRootId ? (
        <div className="focusBreadcrumb" aria-label={text.focus.breadcrumbLabel}>
          <button
            type="button"
            className="focusBreadcrumbButton"
            onMouseDown={(event) => {
              event.preventDefault();
              dispatch({ type: "exitFocus" });
            }}
          >
            {text.focus.all}
          </button>
          {focusBreadcrumbIds.map((nodeId) => {
            const node = activeDoc.nodes[nodeId];
            if (!node) return null;
            const isCurrent = nodeId === state.focusRootId;
            return (
              <span className="focusBreadcrumbSegment" key={nodeId}>
                <span className="focusBreadcrumbSeparator">›</span>
                <button
                  type="button"
                  className={
                    "focusBreadcrumbButton" +
                    (isCurrent ? " focusBreadcrumbButtonCurrent" : "")
                  }
                  disabled={isCurrent}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    dispatch({ type: "setFocusRoot", nodeId });
                  }}
                >
                  {node.text.trim() || text.focus.empty}
                </button>
              </span>
            );
          })}
          <span className="focusBreadcrumbHint">{text.focus.exitHint}</span>
        </div>
      ) : null}
      <div
        className={zoomPan.viewportClassName}
        ref={viewportRef}
        onMouseDown={zoomPan.onViewportMouseDown}
        onWheel={zoomPan.onViewportWheel}
        tabIndex={0}
      >
        <EditorView
          doc={visibleProjection.state}
          sourceDoc={activeDoc}
          mode={state.mode}
          disabled={
            closeConfirmOpen ||
            jumpActive ||
            nodeMemoOpen ||
            helpOpen ||
            searchOpen ||
            paletteOpen ||
            nodeColorOpen ||
            settingsOpen ||
            llmAssistOpen
          }
          zoom={zoomPan.zoom}
          viewportRef={viewportRef}
          panGestureActive={zoomPan.panGestureActive}
          viewSessionKey={`${state.workspace.activeDocId}:${visibleProjection.state.rootId}`}
          highlightedNodeIds={highlightedNodeIds}
          activeHighlightedNodeId={activeSearchNodeId}
          jumpHints={jumpSession?.nodeToHint ?? null}
          jumpPrefix={jumpPrefix}
          collapsibleNodeIds={collapsibleNodeIds}
          collapsedNodeIds={collapsedNodeIds}
          hiddenDescendantCounts={visibleProjection.hiddenDescendantCounts}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeKey={selectedEdgeKey}
          onSelectNode={(nodeId) => {
            setSelectedEdgeKey(null);
            dispatch({ type: "selectNode", nodeId });
          }}
          onSelectionChange={setSelectedNodeIds}
          onSelectEdge={(edgeKey) => {
            setSelectedNodeIds(new Set());
            setSelectedEdgeKey(edgeKey);
          }}
          onChangeEdgeAnchor={changeEdgeAnchor}
          onResetEdgeAnchors={(edgeKey) =>
            dispatch({ type: "resetEdgeAnchors", edgeKey })
          }
          onMoveNodes={(nodeIds, dx, dy) =>
            dispatch({ type: "moveNodes", nodeIds, dx, dy })
          }
          onCreateChildAt={(point) => {
            setSelectedNodeIds(new Set());
            setSelectedEdgeKey(null);
            dispatch({ type: "addChildAtPosition", point });
          }}
          onToggleCollapse={(nodeId) =>
            dispatch({ type: "toggleNodeCollapsed", nodeId })
          }
          onChangeText={(nodeText) => dispatch({ type: "setCursorText", text: nodeText })}
          onEnterCommit={() => dispatch({ type: "commitInsert" })}
          onEsc={() => dispatch({ type: "commitInsert" })}
        />
        <CloseConfirmModal
          open={closeConfirmOpen}
          language={language}
          onConfirm={() => dispatch({ type: "closeActiveDoc" })}
          onCancel={() => dispatch({ type: "cancelCloseConfirm" })}
        />
        <SearchModal
          open={searchOpen}
          language={language}
          query={searchQuery}
          results={searchResults.map((r) => ({
            nodeId: r.nodeId,
            title: r.title,
            subtitle: r.subtitle,
          }))}
          activeIndex={searchIndex}
          activeNodeId={activeSearchNodeId}
          onChangeQuery={setSearchQuery}
          onSelectNode={(nodeId) => {
            const nextIndex = searchResults.findIndex((r) => r.nodeId === nodeId);
            if (nextIndex >= 0) setSearchIndex(nextIndex);
            dispatch({ type: "selectNodeReveal", nodeId });
          }}
          onMoveNext={() => moveSearch(1)}
          onMovePrev={() => moveSearch(-1)}
          onClose={() => setSearchOpen(false)}
        />
        <CommandPaletteModal
          open={paletteOpen}
          language={language}
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
          language={language}
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
        <NodeMemoModal
          open={nodeMemoOpen}
          language={language}
          nodeTitle={activeDoc.nodes[activeDoc.cursorId]?.text || (language === "ja" ? "(空)" : "(empty)")}
          note={activeDoc.nodes[activeDoc.cursorId]?.note ?? ""}
          onChangeNote={(note) => dispatch({ type: "setCursorNote", note })}
          onClose={() => {
            dispatch({ type: "commitNoteEdit" });
            setNodeMemoOpen(false);
          }}
        />
        <LlmAssistModal
          open={llmAssistOpen}
          mode={llmAssistMode}
          language={language}
          running={llmAssistRunning}
          errorMessage={llmAssistError}
          improvePreview={llmAssistMode === "improve" ? pendingImproveApply?.preview ?? null : null}
          reviewResult={llmAssistMode === "review" ? reviewResult : null}
          onChangeMode={setLlmAssistMode}
          onRun={runLlmAssist}
          onApplyImprovePreview={applyImprovePreview}
          onClearImprovePreview={clearImprovePreview}
          onClearReviewResult={clearReviewResult}
          onClose={() => setLlmAssistOpen(false)}
        />
        <SettingsModal
          open={settingsOpen}
          language={language}
          theme={theme}
          onChangeLanguage={setLanguage}
          onChangeTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
        <HelpModal open={helpOpen} language={language} onClose={() => setHelpOpen(false)} />
      </div>
      <div className="statusBar">
        <div className="statusLeft">
          <span className="statusLabel">{text.status.mode}</span>
          <span
            className={
              "statusPill " + (state.mode === "insert" ? "statusPillInsert" : "statusPillNormal")
            }
          >
            {modeLabel}
          </span>
          <span className="statusDot">•</span>
          <span className="statusLabel">{text.status.doc}</span>
          <span className="statusValue">
            {activeTabIndex + 1}/{state.workspace.tabs.length}
          </span>
          <span className="statusDot">•</span>
          <span className="statusLabel">{text.status.save}</span>
          <span className={"statusValue " + (saveStatus === "saving" ? "statusValueSaving" : "")}>
            {saveStatusLabel}
          </span>
          {llmRunningLabel ? (
            <>
              <span className="statusDot">•</span>
              <span className="statusLabel">{text.status.ai}</span>
              <span className="statusPill statusPillLlm">{llmRunningLabel}</span>
            </>
          ) : null}
          {jumpActive ? (
            <>
              <span className="statusDot">•</span>
              <span className="statusLabel">{text.status.jump}</span>
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
            {text.footer.aiAssist}
          </button>
          <button
            type="button"
            className="statusHelpButton"
            onMouseDown={(e) => {
              e.preventDefault();
              setSettingsOpen(true);
            }}
          >
            {text.footer.settings}
          </button>
          <button
            type="button"
            className="statusHelpButton"
            onMouseDown={(e) => {
              e.preventDefault();
              setHelpOpen(true);
            }}
          >
            {text.footer.help}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
