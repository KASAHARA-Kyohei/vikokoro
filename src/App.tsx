import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./App.scss";
import { executeKeyboardCommand } from "./app/keyboard/executeKeyboardCommand";
import { resolveKeyboardCommand } from "./app/keyboard/resolveKeyboardCommand";
import { useDeleteChord } from "./app/keyboard/useDeleteChord";
import { useFoldChord } from "./app/keyboard/useFoldChord";
import { useEditorUiSession } from "./app/session/useEditorUiSession";
import { EditorView } from "./editor/EditorView";
import { computeLayout } from "./editor/layout";
import { TabBar } from "./editor/TabBar";
import { canCreateCustomLink } from "./editor/domain/customLinks";
import { makeEdgeKey } from "./editor/domain/edgeAnchors";
import { resolveDirectionPickerKey } from "./editor/domain/branchDirections";
import { hasSavedViewport } from "./editor/domain/viewport";
import { generateId } from "./editor/domain/id";
import { createInitialAppState, editorReducer } from "./editor/state";
import type {
  AnchorSide,
  BranchDirection,
  CanvasPoint,
  Document,
  NodeId,
  Viewport,
} from "./editor/types";
import {
  buildVisibleTreeProjection,
  getBreadcrumbNodeIds,
} from "./editor/domain/visibleTree";
import { buildJumpSession } from "./features/jump/model";
import { filterPaletteCommands, type PaletteCommand } from "./features/palette/model";
import { createMockThoughtOrganizer } from "./features/organizer/mockThoughtOrganizer";
import type { OrganizePreview } from "./features/organizer/types";
import { buildSearchResults } from "./features/search/model";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useZoomPan } from "./hooks/useZoomPan";
import { APP_TEXT, getModeLabel, getSaveStatusLabel } from "./i18n/uiText";
import { createTauriWorkspaceRepository } from "./persistence";
import { CloseConfirmModal } from "./ui/modals/CloseConfirmModal";
import { CommandPaletteModal } from "./ui/modals/CommandPaletteModal";
import { HelpModal } from "./ui/modals/HelpModal";
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
  const [centerCursorRequest, setCenterCursorRequest] = useState(0);
  const [directionPickerNodeId, setDirectionPickerNodeId] = useState<NodeId | null>(null);

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
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<NodeId>>(new Set());
  const [organizePreview, setOrganizePreview] = useState<OrganizePreview | null>(null);
  const thoughtOrganizer = useMemo(() => createMockThoughtOrganizer(), []);

  const requestOrganizePreview = useCallback(async () => {
    const cards = [...selectedNodeIds]
      .map((id) => activeDoc.nodes[id])
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
      .map(({ id, text: cardText }) => ({ id, text: cardText }));
    if (cards.length === 0) return;
    const request = { cards, instruction: "選択した思考を自然なまとまりに整理してください" };
    const suggestion = await thoughtOrganizer.organize(request);
    setOrganizePreview({ request, suggestion });
  }, [activeDoc.nodes, selectedNodeIds, thoughtOrganizer]);

  const applySelection = useCallback((cardIds: Iterable<NodeId>) => {
    const nextIds = [...cardIds].filter((id) => activeDoc.nodes[id]);
    setSelectedNodeIds(new Set(nextIds));
    dispatch({
      type: "setSelection",
      selection: {
        cardIds: nextIds,
        lastEditedCardId: activeDoc.selection?.lastEditedCardId ?? activeDoc.cursorId,
      },
    });
  }, [activeDoc.cursorId, activeDoc.nodes, activeDoc.selection?.lastEditedCardId]);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [selectedCustomLinkId, setSelectedCustomLinkId] = useState<string | null>(null);
  const [selectedStickyNoteId, setSelectedStickyNoteId] = useState<string | null>(null);
  const [editingStickyNoteId, setEditingStickyNoteId] = useState<string | null>(null);
  const [stickyPlacementActive, setStickyPlacementActive] = useState(false);
  const [relatedLinkSourceNodeId, setRelatedLinkSourceNodeId] = useState<NodeId | null>(null);
  const [relatedLinkJumpSourceNodeId, setRelatedLinkJumpSourceNodeId] = useState<NodeId | null>(null);

  const openJump = useCallback(() => {
    const session = buildJumpSession(visibleDoc);
    if (Object.keys(session.hintToNode).length === 0) return;
    setRelatedLinkJumpSourceNodeId(null);
    setJumpSession(session);
    setJumpPrefix("");
  }, [setJumpPrefix, setJumpSession, visibleDoc]);

  const openRelatedLinkJump = useCallback(() => {
    const sourceNodeId = activeDoc.cursorId;
    const candidateNodeIds = new Set(
      Object.keys(visibleDoc.nodes).filter((nodeId) =>
        canCreateCustomLink(activeDoc, sourceNodeId, nodeId),
      ),
    );
    if (candidateNodeIds.size === 0) return;
    const session = buildJumpSession(visibleDoc, candidateNodeIds);
    if (Object.keys(session.hintToNode).length === 0) return;
    setSelectedEdgeKey(null);
    setSelectedCustomLinkId(null);
    setRelatedLinkJumpSourceNodeId(sourceNodeId);
    setJumpSession(session);
    setJumpPrefix("");
  }, [activeDoc, setJumpPrefix, setJumpSession, visibleDoc]);

  const persistViewport = useCallback(
    (viewport: Viewport) => {
      dispatch({ type: "setViewport", viewport });
    },
    [],
  );

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
      closeConfirmOpen ||
      jumpActive,
    viewportRef,
    initialViewport: activeDoc.viewport ?? { x: 0, y: 0, zoom: 1, initialized: false },
    onViewportChange: persistViewport,
  });

  useEffect(() => {
    setSelectedEdgeKey(null);
    setSelectedCustomLinkId(null);
    setSelectedStickyNoteId(null);
    setEditingStickyNoteId(null);
    setStickyPlacementActive(false);
    setRelatedLinkSourceNodeId(null);
    setRelatedLinkJumpSourceNodeId(null);
  }, [state.workspace.activeDocId, state.focusRootId]);

  useEffect(() => {
    setDirectionPickerNodeId(null);
  }, [
    activeDoc.cursorId,
    closeConfirmOpen,
    editingStickyNoteId,
    helpOpen,
    jumpActive,
    nodeColorOpen,
    nodeMemoOpen,
    paletteOpen,
    searchOpen,
    settingsOpen,
    state.mode,
    state.workspace.activeDocId,
    state.focusRootId,
  ]);

  const createChildInDirection = useCallback(
    (parentId: NodeId, direction: BranchDirection) => {
      setDirectionPickerNodeId(null);
      applySelection([]);
      setSelectedEdgeKey(null);
      setSelectedCustomLinkId(null);
      setSelectedStickyNoteId(null);
      dispatch({ type: "addChildInDirectionAndInsert", parentId, direction });
    },
    [applySelection],
  );

  useEffect(() => {
    setSelectedNodeIds(new Set(activeDoc.selection?.cardIds ?? []));
  }, [activeDoc.selection]);

  useEffect(() => {
    if (!selectedEdgeKey) return;
    const exists = Object.values(visibleDoc.nodes).some((node) =>
      node.childrenIds.some((childId) => makeEdgeKey(node.id, childId) === selectedEdgeKey),
    );
    if (!exists) setSelectedEdgeKey(null);
  }, [selectedEdgeKey, visibleDoc.nodes]);

  useEffect(() => {
    if (!selectedCustomLinkId) return;
    if (!visibleDoc.customLinks[selectedCustomLinkId]) setSelectedCustomLinkId(null);
  }, [selectedCustomLinkId, visibleDoc.customLinks]);

  useEffect(() => {
    if (selectedStickyNoteId && !activeDoc.stickyNotes[selectedStickyNoteId]) {
      setSelectedStickyNoteId(null);
    }
    if (editingStickyNoteId && !activeDoc.stickyNotes[editingStickyNoteId]) {
      setEditingStickyNoteId(null);
    }
  }, [activeDoc.stickyNotes, editingStickyNoteId, selectedStickyNoteId]);

  useEffect(() => {
    if (!relatedLinkSourceNodeId) return;
    if (!activeDoc.nodes[relatedLinkSourceNodeId]) {
      setRelatedLinkSourceNodeId(null);
      setSearchOpen(false);
    }
  }, [activeDoc.nodes, relatedLinkSourceNodeId, setSearchOpen]);

  useEffect(() => {
    if (!searchOpen) setRelatedLinkSourceNodeId(null);
  }, [searchOpen]);

  useEffect(() => {
    if (!jumpSession) setRelatedLinkJumpSourceNodeId(null);
  }, [jumpSession]);

  useEffect(() => {
    if (!relatedLinkJumpSourceNodeId) return;
    if (!activeDoc.nodes[relatedLinkJumpSourceNodeId]) {
      setRelatedLinkJumpSourceNodeId(null);
      closeJump();
    }
  }, [activeDoc.nodes, closeJump, relatedLinkJumpSourceNodeId]);

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
    const results = buildSearchResults(activeDoc, searchQuery, language);
    if (!relatedLinkSourceNodeId) return results;
    return results.filter((result) =>
      canCreateCustomLink(activeDoc, relatedLinkSourceNodeId, result.nodeId),
    );
  }, [activeDoc, language, relatedLinkSourceNodeId, searchQuery]);

  const activeSearchNodeId =
    searchResults.length > 0 ? searchResults[searchIndex]?.nodeId ?? null : null;

  const highlightedNodeIds = useMemo(() => {
    if (!searchOpen) return null;
    if (searchResults.length === 0) return null;
    return new Set(searchResults.map((r) => r.nodeId));
  }, [searchOpen, searchResults]);

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
          setRelatedLinkSourceNodeId(null);
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
        id: "add-related-link",
        title: paletteText.addRelatedLinkTitle,
        subtitle: paletteText.addRelatedLinkSubtitle,
        run: () => {
          setRelatedLinkSourceNodeId(activeDoc.cursorId);
          setSearchQuery("");
          setSearchIndex(0);
          setSelectedEdgeKey(null);
          setSelectedCustomLinkId(null);
          setSearchOpen(true);
          setPaletteOpen(false);
        },
      },
      {
        id: "add-sticky-note",
        title: paletteText.addStickyNoteTitle,
        subtitle: paletteText.addStickyNoteSubtitle,
        run: () => {
          setStickyPlacementActive(true);
          applySelection([]);
          setSelectedEdgeKey(null);
          setSelectedCustomLinkId(null);
          setSelectedStickyNoteId(null);
          setPaletteOpen(false);
        },
      },
      ...(selectedCustomLinkId
        ? [{
            id: "delete-related-link",
            title: paletteText.deleteRelatedLinkTitle,
            subtitle: paletteText.deleteRelatedLinkSubtitle,
            run: () => {
              dispatch({ type: "deleteCustomLink" as const, linkId: selectedCustomLinkId });
              setSelectedCustomLinkId(null);
            },
          }]
        : []),
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
    activeDoc.cursorId,
    applySelection,
    dispatch,
    paletteQuery,
    selectedCustomLinkId,
    selectedEdgeKey,
    setHelpOpen,
    setSearchIndex,
    setPaletteOpen,
    setSearchQuery,
    setSearchOpen,
    setSettingsOpen,
    state.focusRootId,
    text.palette,
  ]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, setSearchIndex, state.workspace.activeDocId]);

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
      closeConfirmOpen
    ) {
      closeJump();
    }
  }, [
    closeConfirmOpen,
    closeJump,
    helpOpen,
    jumpSession,
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

  const moveRelatedLinkSearch = (delta: number) => {
    if (searchResults.length === 0) return;
    const len = searchResults.length;
    setSearchIndex((index) => (index + delta + len) % len);
  };

  const addRelatedLinkToNode = (nodeId: NodeId) => {
    if (!relatedLinkSourceNodeId) return;
    dispatch({ type: "addCustomLink", fromId: relatedLinkSourceNodeId, toId: nodeId });
    setRelatedLinkSourceNodeId(null);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const runRelatedLinkSearchActive = () => {
    const nodeId = searchResults[searchIndex]?.nodeId;
    if (!nodeId) return;
    addRelatedLinkToNode(nodeId);
  };

  const createStickyNoteAt = (point: CanvasPoint) => {
    const noteId = generateId();
    const noteText = language === "ja" ? "付箋メモ" : "Sticky note";
    dispatch({
      type: "addStickyNote",
      note: {
        id: noteId,
        text: noteText,
        position: point,
      },
    });
    applySelection([]);
    setSelectedEdgeKey(null);
    setSelectedCustomLinkId(null);
    setSelectedStickyNoteId(noteId);
    setEditingStickyNoteId(noteId);
    dispatch({ type: "beginStickyEdit" });
  };

  const runPaletteSelected = () => {
    const item = paletteItems[paletteIndex];
    if (!item) return;
    setPaletteOpen(false);
    setPaletteQuery("");
    item.run();
  };

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
        !closeConfirmOpen &&
        !jumpActive &&
        !editingStickyNoteId;

      if (state.mode === "insert") {
        resetDeleteChord();
        resetFoldChord();
      }

      if (!commandLayerActive) {
        resetFoldChord();
      }

      if (directionPickerNodeId) {
        event.preventDefault();
        const directionCommand = resolveDirectionPickerKey(
          event.key,
          event.ctrlKey || event.metaKey || event.altKey,
        );
        if (directionCommand === "cancel") {
          setDirectionPickerNodeId(null);
          return;
        }
        if (directionCommand) {
          createChildInDirection(directionPickerNodeId, directionCommand);
        }
        return;
      }

      if (
        commandLayerActive &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        setDirectionPickerNodeId(activeDoc.cursorId);
        return;
      }

      if (commandLayerActive && stickyPlacementActive && event.key === "Escape") {
        event.preventDefault();
        setStickyPlacementActive(false);
        return;
      }

      const commandKey = event.metaKey || event.ctrlKey;
      if (commandLayerActive && commandKey && event.key === "Enter") {
        event.preventDefault();
        const viewport = viewportRef.current;
        if (!viewport) return;
        const layout = computeLayout(visibleDoc);
        dispatch({
          type: "addChildAtPosition",
          point: {
            x: (viewport.scrollLeft + viewport.clientWidth / 2) / zoomPan.zoom - layout.offset.x,
            y: (viewport.scrollTop + viewport.clientHeight / 2) / zoomPan.zoom - layout.offset.y,
          },
        });
        return;
      }

      if (commandLayerActive && commandKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const ids = selectedNodeIds.size > 0 ? [...selectedNodeIds] : [activeDoc.cursorId];
        dispatch({ type: "duplicateNodes", nodeIds: ids });
        return;
      }

      if (commandLayerActive && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const foldAction = consumeFoldChord(event.key);
        if (foldAction) {
          event.preventDefault();
          if (foldAction === "center") setCenterCursorRequest((current) => current + 1);
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

      if (
        commandLayerActive &&
        (selectedStickyNoteId || selectedCustomLinkId) &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        if (selectedStickyNoteId) {
          dispatch({ type: "deleteStickyNote", noteId: selectedStickyNoteId });
          setSelectedStickyNoteId(null);
          setEditingStickyNoteId(null);
        } else if (selectedCustomLinkId) {
          dispatch({ type: "deleteCustomLink", linkId: selectedCustomLinkId });
          setSelectedCustomLinkId(null);
        }
        return;
      }

      if (
        commandLayerActive &&
        !selectedStickyNoteId &&
        !selectedCustomLinkId &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedNodeIds.size > 0
      ) {
        event.preventDefault();
        dispatch({ type: "deleteNodes", nodeIds: [...selectedNodeIds] });
        return;
      }

      if (commandLayerActive && event.key === "d") {
        event.preventDefault();
        if (consumeDeleteChord()) {
          if (selectedStickyNoteId) {
            dispatch({ type: "deleteStickyNote", noteId: selectedStickyNoteId });
            setSelectedStickyNoteId(null);
            setEditingStickyNoteId(null);
          } else if (selectedCustomLinkId) {
            dispatch({ type: "deleteCustomLink", linkId: selectedCustomLinkId });
            setSelectedCustomLinkId(null);
          } else {
            dispatch({ type: "deleteNode" });
          }
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
        setJumpPrefix,
        openJump,
        openRelatedLinkJump,
        closeJump,
        selectNode: (nodeId) => {
          if (relatedLinkJumpSourceNodeId) {
            dispatch({
              type: "addCustomLink",
              fromId: relatedLinkJumpSourceNodeId,
              toId: nodeId,
            });
            setRelatedLinkJumpSourceNodeId(null);
            return;
          }
          dispatch({ type: "selectNode", nodeId });
        },
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
    createChildInDirection,
    dispatch,
    helpOpen,
    jumpActive,
    jumpPrefix,
    jumpSession,
    nodeMemoOpen,
    nodeColorOpen,
    openJump,
    openRelatedLinkJump,
    paletteOpen,
    relatedLinkJumpSourceNodeId,
    resetDeleteChord,
    resetFoldChord,
    searchOpen,
    setHelpOpen,
    setJumpPrefix,
    setNodeMemoOpen,
    setNodeColorOpen,
    setPaletteIndex,
    setPaletteOpen,
    setPaletteQuery,
    setSearchOpen,
    setSettingsOpen,
    settingsOpen,
    stickyPlacementActive,
    state.hydrated,
    state.focusRootId,
    state.mode,
    editingStickyNoteId,
    directionPickerNodeId,
    selectedCustomLinkId,
    selectedStickyNoteId,
    selectedNodeIds,
    activeDoc,
    visibleDoc,
    zoomPan.zoom,
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
      <div className="canvasToolbar" aria-label="マインドマップの操作">
        <div className="canvasToolbarRight">
          <button
            type="button"
            className="organizeButton"
            disabled={selectedNodeIds.size === 0}
            onClick={() => void requestOrganizePreview()}
          >
            整理案
          </button>
          <span className="canvasToolbarHint">⌘Enter ノード · Space ドラッグ</span>
          <div className="zoomControls" aria-label="ズーム">
            <button type="button" onClick={zoomPan.zoomOut} aria-label="ズームアウト">−</button>
            <button type="button" onClick={zoomPan.resetZoom}>{Math.round(zoomPan.zoom * 100)}%</button>
            <button type="button" onClick={zoomPan.zoomIn} aria-label="ズームイン">＋</button>
          </div>
        </div>
      </div>
      {organizePreview ? (
        <aside className="organizePreview" aria-label="AI整理案のプレビュー">
          <div>
            <strong>整理案（モック）</strong>
            <span>{organizePreview.suggestion.summary}</span>
          </div>
          <div className="organizePreviewGroups">
            {organizePreview.suggestion.groups.map((group) => (
              <span key={`${group.title}:${group.cardIds.join("-")}`}>{group.title} · {group.cardIds.length}枚</span>
            ))}
          </div>
          <div className="organizePreviewActions">
            <button type="button" onClick={() => setOrganizePreview(null)}>閉じる</button>
          </div>
        </aside>
      ) : null}
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
            settingsOpen
          }
          zoom={zoomPan.zoom}
          viewportRef={viewportRef}
          panGestureActive={zoomPan.panGestureActive}
          viewSessionKey={`${state.workspace.activeDocId}:${visibleProjection.state.rootId}`}
          centerRootOnInitialView={!hasSavedViewport(activeDoc.viewport)}
          centerCursorRequest={centerCursorRequest}
          highlightedNodeIds={highlightedNodeIds}
          activeHighlightedNodeId={activeSearchNodeId}
          jumpHints={jumpSession?.nodeToHint ?? null}
          jumpPrefix={jumpPrefix}
          collapsibleNodeIds={collapsibleNodeIds}
          collapsedNodeIds={collapsedNodeIds}
          hiddenDescendantCounts={visibleProjection.hiddenDescendantCounts}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeKey={selectedEdgeKey}
          selectedCustomLinkId={selectedCustomLinkId}
          selectedStickyNoteId={selectedStickyNoteId}
          editingStickyNoteId={editingStickyNoteId}
          stickyPlacementActive={stickyPlacementActive}
          directionPickerNodeId={directionPickerNodeId}
          onSelectNode={(nodeId) => {
            setSelectedEdgeKey(null);
            setSelectedCustomLinkId(null);
            setSelectedStickyNoteId(null);
            dispatch({ type: "selectNode", nodeId });
          }}
          onBeginCardEdit={(nodeId) => {
            dispatch({ type: "selectNode", nodeId });
            dispatch({ type: "enterInsert" });
          }}
          onSelectionChange={(nodeIds) => applySelection(nodeIds)}
          onSelectEdge={(edgeKey) => {
            applySelection([]);
            setSelectedEdgeKey(edgeKey);
            setSelectedCustomLinkId(null);
            setSelectedStickyNoteId(null);
          }}
          onSelectCustomLink={(linkId) => {
            applySelection([]);
            setSelectedEdgeKey(null);
            setSelectedCustomLinkId(linkId);
            setSelectedStickyNoteId(null);
          }}
          onSelectStickyNote={(noteId) => {
            applySelection([]);
            setSelectedEdgeKey(null);
            setSelectedCustomLinkId(null);
            setSelectedStickyNoteId(noteId);
          }}
          onClearSelection={() => {
            applySelection([]);
            setSelectedEdgeKey(null);
            setSelectedCustomLinkId(null);
            setSelectedStickyNoteId(null);
          }}
          onBeginStickyEdit={(noteId) => {
            applySelection([]);
            setSelectedEdgeKey(null);
            setSelectedCustomLinkId(null);
            setSelectedStickyNoteId(noteId);
            setEditingStickyNoteId(noteId);
            dispatch({ type: "beginStickyEdit" });
          }}
          onChangeStickyText={(noteId, noteText) =>
            dispatch({ type: "setStickyNoteText", noteId, text: noteText })
          }
          onCommitStickyEdit={(noteId) => {
            dispatch({ type: "commitStickyEdit", noteId });
            setEditingStickyNoteId(null);
          }}
          onChangeEdgeAnchor={changeEdgeAnchor}
          onResetEdgeAnchors={(edgeKey) =>
            dispatch({ type: "resetEdgeAnchors", edgeKey })
          }
          onMoveNodes={(nodeIds, dx, dy) =>
            dispatch({ type: "moveNodes", nodeIds, dx, dy })
          }
          onCreateChildAt={(point) => {
            applySelection([]);
            setSelectedEdgeKey(null);
            setSelectedCustomLinkId(null);
            setSelectedStickyNoteId(null);
            dispatch({ type: "addChildAtPosition", point });
          }}
          onCreateChildInDirection={createChildInDirection}
          onCloseDirectionPicker={() => setDirectionPickerNodeId(null)}
          onCreateStickyNoteAt={createStickyNoteAt}
          onMoveStickyNote={(noteId, dx, dy) =>
            dispatch({ type: "moveStickyNote", noteId, dx, dy })
          }
          onToggleCollapse={(nodeId) =>
            dispatch({ type: "toggleNodeCollapsed", nodeId })
          }
          onChangeText={(nodeText) => dispatch({ type: "setCursorText", text: nodeText })}
          onEnterCommit={() => dispatch({ type: "commitInsert" })}
          onEsc={() => dispatch({ type: "cancelInsert" })}
          onViewportChange={persistViewport}
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
          title={
            relatedLinkSourceNodeId
              ? language === "ja"
                ? "補助線の接続先を選択"
                : "Select related link target"
              : undefined
          }
          placeholder={
            relatedLinkSourceNodeId
              ? language === "ja"
                ? "接続先ノードを検索..."
                : "Search target node..."
              : undefined
          }
          prevLabel={
            relatedLinkSourceNodeId
              ? language === "ja"
                ? "前の候補"
                : "Previous target"
              : undefined
          }
          nextLabel={
            relatedLinkSourceNodeId
              ? language === "ja"
                ? "この候補に接続 (Enter)"
                : "Connect to target (Enter)"
              : undefined
          }
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
            if (relatedLinkSourceNodeId) {
              addRelatedLinkToNode(nodeId);
              return;
            }
            dispatch({ type: "selectNodeReveal", nodeId });
          }}
          onMoveNext={() =>
            relatedLinkSourceNodeId ? runRelatedLinkSearchActive() : moveSearch(1)
          }
          onMovePrev={() =>
            relatedLinkSourceNodeId ? moveRelatedLinkSearch(-1) : moveSearch(-1)
          }
          onClose={() => {
            setRelatedLinkSourceNodeId(null);
            setSearchOpen(false);
          }}
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
          {jumpActive ? (
            <>
              <span className="statusDot">•</span>
              <span className="statusLabel">{text.status.jump}</span>
              <span className="statusPill statusPillJump">{jumpPrefix || "..."}</span>
            </>
          ) : null}
          {stickyPlacementActive ? (
            <>
              <span className="statusDot">•</span>
              <span className="statusLabel">{text.status.sticky}</span>
              <span className="statusPill statusPillSticky">{text.status.stickyPlacement}</span>
            </>
          ) : null}
        </div>
        <div className="statusRight">
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
