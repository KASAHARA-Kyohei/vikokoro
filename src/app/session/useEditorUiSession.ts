import { useCallback, useState } from "react";
import type { JumpSession } from "../../features/jump/model";

export function useEditorUiSession() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [nodeColorOpen, setNodeColorOpen] = useState(false);
  const [jumpSession, setJumpSession] = useState<JumpSession | null>(null);
  const [jumpPrefix, setJumpPrefix] = useState("");

  const closeJump = useCallback(() => {
    setJumpSession(null);
    setJumpPrefix("");
  }, []);

  const closeAllTransientPanels = useCallback(() => {
    setSearchOpen(false);
    setPaletteOpen(false);
    setNodeColorOpen(false);
    closeJump();
  }, [closeJump]);

  return {
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
    jumpSession,
    setJumpSession,
    jumpPrefix,
    setJumpPrefix,
    jumpActive: jumpSession !== null,
    closeJump,
    closeAllTransientPanels,
  };
}
