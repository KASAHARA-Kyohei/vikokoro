import { useCallback, useState } from "react";
import type { JumpSession } from "../../features/jump/model";

export type ActiveOverlay =
  | "help"
  | "search"
  | "palette"
  | "nodeColor"
  | "nodeMemo"
  | "settings"
  | null;

export function useEditorUiSession() {
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [jumpSession, setJumpSession] = useState<JumpSession | null>(null);
  const [jumpPrefix, setJumpPrefix] = useState("");

  const closeJump = useCallback(() => {
    setJumpSession(null);
    setJumpPrefix("");
  }, []);

  const setOverlayOpen = useCallback((overlay: Exclude<ActiveOverlay, null>, open: boolean) => {
    setActiveOverlay((current) => open ? overlay : current === overlay ? null : current);
  }, []);
  const setHelpOpen = useCallback((open: boolean) => setOverlayOpen("help", open), [setOverlayOpen]);
  const setSearchOpen = useCallback((open: boolean) => setOverlayOpen("search", open), [setOverlayOpen]);
  const setPaletteOpen = useCallback((open: boolean) => setOverlayOpen("palette", open), [setOverlayOpen]);
  const setNodeColorOpen = useCallback((open: boolean) => setOverlayOpen("nodeColor", open), [setOverlayOpen]);
  const setNodeMemoOpen = useCallback((open: boolean) => setOverlayOpen("nodeMemo", open), [setOverlayOpen]);
  const setSettingsOpen = useCallback((open: boolean) => setOverlayOpen("settings", open), [setOverlayOpen]);

  const closeAllTransientPanels = useCallback(() => {
    setActiveOverlay((current) =>
      current === "search" || current === "palette" || current === "nodeColor" || current === "settings"
        ? null
        : current,
    );
    closeJump();
  }, [closeJump]);

  return {
    activeOverlay,
    helpOpen: activeOverlay === "help",
    setHelpOpen,
    searchOpen: activeOverlay === "search",
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    searchIndex,
    setSearchIndex,
    paletteOpen: activeOverlay === "palette",
    setPaletteOpen,
    paletteQuery,
    setPaletteQuery,
    paletteIndex,
    setPaletteIndex,
    nodeColorOpen: activeOverlay === "nodeColor",
    setNodeColorOpen,
    nodeMemoOpen: activeOverlay === "nodeMemo",
    setNodeMemoOpen,
    settingsOpen: activeOverlay === "settings",
    setSettingsOpen,
    jumpSession,
    setJumpSession,
    jumpPrefix,
    setJumpPrefix,
    jumpActive: jumpSession !== null,
    closeJump,
    closeAllTransientPanels,
  };
}
