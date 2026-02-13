import type { EditorAction } from "../../editor/state";
import type { Mode, NodeColor } from "../../editor/types";

type Dispatch = (action: EditorAction) => void;

type ModalStateParams = {
  event: KeyboardEvent;
  helpOpen: boolean;
  searchOpen: boolean;
  paletteOpen: boolean;
  nodeColorOpen: boolean;
  closeConfirmDocId: string | null;
  colorShortcuts: Record<string, NodeColor>;
  dispatch: Dispatch;
  setHelpOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setNodeColorOpen: (open: boolean) => void;
};

type InsertModeParams = {
  event: KeyboardEvent;
  dispatch: Dispatch;
  resetPendingDelete: () => void;
};

type NormalModeParams = {
  event: KeyboardEvent;
  dispatch: Dispatch;
  openJump: () => void;
  openNodeColor: () => void;
  consumeDeleteChord: (event: KeyboardEvent) => boolean;
};

type GlobalModeParams = {
  event: KeyboardEvent;
  mode: Mode;
  setHelpOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (query: string) => void;
  setPaletteIndex: (index: number) => void;
};

export function shouldPreventModalCtrlCombos(event: KeyboardEvent): boolean {
  return event.ctrlKey && (event.key === "w" || event.key === "t" || event.key === "Tab");
}

export function handleModalStateKeys(params: ModalStateParams): boolean {
  const {
    event,
    helpOpen,
    searchOpen,
    paletteOpen,
    nodeColorOpen,
    closeConfirmDocId,
    colorShortcuts,
    dispatch,
    setHelpOpen,
    setSearchOpen,
    setPaletteOpen,
    setNodeColorOpen,
  } = params;

  if (helpOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      setHelpOpen(false);
      return true;
    }
    event.preventDefault();
    return true;
  }

  if (searchOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
      return true;
    }
    if (shouldPreventModalCtrlCombos(event)) {
      event.preventDefault();
    }
    return true;
  }

  if (paletteOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      setPaletteOpen(false);
      return true;
    }
    if (shouldPreventModalCtrlCombos(event)) {
      event.preventDefault();
    }
    return true;
  }

  if (nodeColorOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      setNodeColorOpen(false);
      return true;
    }

    if (event.key === "0") {
      event.preventDefault();
      dispatch({ type: "setCursorColor", color: null });
      setNodeColorOpen(false);
      return true;
    }

    const color = colorShortcuts[event.key];
    if (color) {
      event.preventDefault();
      dispatch({ type: "setCursorColor", color });
      setNodeColorOpen(false);
      return true;
    }

    event.preventDefault();
    return true;
  }

  if (closeConfirmDocId) {
    const key = event.key;
    if (key === "y" || key === "Y") {
      event.preventDefault();
      dispatch({ type: "closeActiveDoc" });
      return true;
    }
    if (key === "n" || key === "N" || key === "Escape") {
      event.preventDefault();
      dispatch({ type: "cancelCloseConfirm" });
      return true;
    }
    event.preventDefault();
    return true;
  }

  return false;
}

export function handleGlobalModeKeys(params: GlobalModeParams): boolean {
  const {
    event,
    mode,
    setHelpOpen,
    setSearchOpen,
    setPaletteOpen,
    setPaletteQuery,
    setPaletteIndex,
  } = params;

  if (mode === "normal" && (event.key === "?" || (event.key === "/" && event.shiftKey))) {
    event.preventDefault();
    setHelpOpen(true);
    return true;
  }

  if (mode === "normal" && event.ctrlKey && (event.key === "f" || event.key === "F")) {
    event.preventDefault();
    setSearchOpen(true);
    setPaletteOpen(false);
    return true;
  }

  if (mode === "normal" && event.ctrlKey && (event.key === "p" || event.key === "P")) {
    event.preventDefault();
    setPaletteQuery("");
    setPaletteIndex(0);
    setPaletteOpen(true);
    setSearchOpen(false);
    return true;
  }

  return false;
}

export function handleInsertModeKeys({ event, dispatch, resetPendingDelete }: InsertModeParams): boolean {
  resetPendingDelete();

  if (event.key === "Escape") {
    event.preventDefault();
    dispatch({ type: "commitInsert" });
    return true;
  }
  if (event.key === "Tab" || (event.ctrlKey && event.key === "Tab")) {
    event.preventDefault();
    return true;
  }
  if (event.ctrlKey && (event.key === "t" || event.key === "w")) {
    event.preventDefault();
    return true;
  }

  return true;
}

export function handleNormalModeKeys({
  event,
  dispatch,
  openJump,
  openNodeColor,
  consumeDeleteChord,
}: NormalModeParams): boolean {
  if (consumeDeleteChord(event)) {
    dispatch({ type: "deleteNode" });
    return true;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "c") {
    event.preventDefault();
    openNodeColor();
    return true;
  }

  if (event.ctrlKey && (event.key === "t" || event.key === "T")) {
    event.preventDefault();
    dispatch({ type: "createDoc" });
    return true;
  }
  if (event.ctrlKey && (event.key === "w" || event.key === "W")) {
    event.preventDefault();
    dispatch({ type: "requestCloseActiveDoc" });
    return true;
  }

  if (event.ctrlKey && event.key === "Tab") {
    event.preventDefault();
    if (event.shiftKey) {
      dispatch({ type: "switchDocPrev" });
    } else {
      dispatch({ type: "switchDocNext" });
    }
    return true;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    dispatch({ type: "addChildAndInsert" });
    return true;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    dispatch({ type: "addSiblingAndInsert" });
    return true;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    dispatch({ type: "commitInsert" });
    return true;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    openJump();
    return true;
  }

  if (event.key === "i") {
    event.preventDefault();
    dispatch({ type: "enterInsert" });
    return true;
  }

  if (event.key === "h") {
    event.preventDefault();
    dispatch({ type: "moveCursor", direction: "parent" });
    return true;
  }
  if (event.key === "l") {
    event.preventDefault();
    dispatch({ type: "moveCursor", direction: "child" });
    return true;
  }
  if (event.key === "j") {
    event.preventDefault();
    dispatch({ type: "moveCursor", direction: "nextSibling" });
    return true;
  }
  if (event.key === "k") {
    event.preventDefault();
    dispatch({ type: "moveCursor", direction: "prevSibling" });
    return true;
  }
  if (event.key === "J") {
    event.preventDefault();
    dispatch({ type: "swapSibling", direction: "down" });
    return true;
  }
  if (event.key === "K") {
    event.preventDefault();
    dispatch({ type: "swapSibling", direction: "up" });
    return true;
  }
  if (event.key === "H") {
    event.preventDefault();
    dispatch({ type: "reparentNode", direction: "left" });
    return true;
  }
  if (event.key === "L") {
    event.preventDefault();
    dispatch({ type: "reparentNode", direction: "right" });
    return true;
  }

  if (event.key === "u") {
    event.preventDefault();
    dispatch({ type: "undo" });
    return true;
  }
  if (event.ctrlKey && event.key === "r") {
    event.preventDefault();
    dispatch({ type: "redo" });
    return true;
  }

  return false;
}
